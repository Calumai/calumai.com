(function attachPracticeCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ClassroomPracticeCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function createPracticeCore() {
  "use strict";

  const SERVICE_BASE = "/api/classroom-ai";
  const IMAGE_EXTENSIONS = new Map([
    ["image/png", "png"],
    ["image/jpeg", "jpg"],
    ["image/webp", "webp"]
  ]);
  const ALLOWED_IMAGE_TYPES = new Set(IMAGE_EXTENSIONS.keys());

  function clean(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function buildClaimPayload(input) {
    return {
      class_code: clean(input.class_code),
      nickname: clean(input.nickname),
      consent: input.consent === true
    };
  }

  function buildTextPayload(input, idempotencyKey) {
    return {
      idempotency_key: clean(idempotencyKey),
      topic: clean(input.topic),
      audience: clean(input.audience),
      duration_minutes: Number(input.duration_minutes),
      objective: clean(input.objective),
      source_notes: clean(input.source_notes),
      requirements: clean(input.requirements)
    };
  }

  function buildImagePayload(input, idempotencyKey) {
    return {
      idempotency_key: clean(idempotencyKey),
      scene: clean(input.scene),
      style: clean(input.style),
      composition: clean(input.composition),
      safe_area: clean(input.safe_area),
      avoid: clean(input.avoid)
    };
  }

  function createIdempotencyKey(kind, uuid) {
    const safeKind = kind === "image" ? "image" : "text";
    const safeUuid = clean(uuid).replace(/[^a-zA-Z0-9-]/g, "");
    if (!safeUuid) throw new Error("缺少請求識別碼");
    return `classroom-${safeKind}-${safeUuid}`;
  }

  function createRequest(pathname, method, body) {
    const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
    const options = {
      method,
      credentials: "include",
      headers: { Accept: "application/json" }
    };

    if (body !== undefined) {
      options.headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(body);
    }

    return { url: `${SERVICE_BASE}${normalizedPath}`, options };
  }

  function normalizeApiError(payload, httpStatus) {
    const detail = payload && typeof payload === "object" && payload.error
      ? payload.error
      : {};
    return {
      code: clean(detail.code) || (httpStatus ? `HTTP_${httpStatus}` : "NETWORK_ERROR"),
      message: clean(detail.message) || "目前無法完成這項操作，請稍後再試。",
      retryable: detail.retryable === true,
      requestId: clean(payload && payload.request_id),
      httpStatus: Number(httpStatus) || 0
    };
  }

  function normalizeSession(payload) {
    if (!payload || payload.ok !== true || !payload.session) {
      throw new Error("工作階段回應格式不完整");
    }
    return {
      nickname: clean(payload.session.nickname),
      mode: clean(payload.session.mode),
      expiresAt: clean(payload.session.expires_at),
      classroom: {
        status: clean(payload.classroom && payload.classroom.status),
        opensAt: clean(payload.classroom && payload.classroom.opens_at),
        closesAt: clean(payload.classroom && payload.classroom.closes_at)
      },
      remaining: normalizeRemaining(payload.remaining),
      classroomRemaining: normalizeRemaining(payload.classroom_remaining)
    };
  }

  function normalizeRemaining(value) {
    return {
      text: Number.isFinite(Number(value && value.text)) ? Number(value.text) : null,
      image: Number.isFinite(Number(value && value.image)) ? Number(value.image) : null
    };
  }

  function normalizeGenerationResult(kind, payload) {
    if (!payload || payload.ok !== true || (payload.kind !== kind && !(kind === "image" && payload.image))) {
      throw new Error("生成回應格式不完整");
    }

    const shared = {
      requestId: clean(payload.request_id),
      remaining: normalizeRemaining(payload.remaining),
      classroomRemaining: normalizeRemaining(payload.classroom_remaining)
    };

    if (kind === "text") {
      const content = typeof payload.content === "string" ? payload.content : "";
      if (!content.trim()) throw new Error("文字生成結果為空白");
      return {
        ...shared,
        kind,
        content,
        usage: {
          inputTokens: Number(payload.usage && payload.usage.input_tokens) || 0,
          outputTokens: Number(payload.usage && payload.usage.output_tokens) || 0,
          totalTokens: Number(payload.usage && payload.usage.total_tokens) || 0
        }
      };
    }

    const mimeType = clean(payload.image && payload.image.mime_type || "image/png").toLowerCase();
    const dataBase64 = clean(payload.image && payload.image.data_base64).replace(/\s/g, "");
    const src = clean(payload.image && payload.image.src);
    const safeRelativeSrc = /^(?:\.{0,2}\/|\/)[^\\:]*$/u.test(src);
    if (!ALLOWED_IMAGE_TYPES.has(mimeType) || (!dataBase64 && !/^https:\/\//u.test(src) && !safeRelativeSrc)) {
      throw new Error("圖片生成結果格式不支援");
    }
    return { ...shared, kind, mimeType, dataBase64, src };
  }

  function parsePromptAssistantResult(content) {
    if (typeof content !== "string") throw new Error("AI 回覆格式不完整");
    let source = content.trim();
    source = source.replace(/^```(?:json)?\s*/iu, "").replace(/\s*```$/u, "").trim();
    const firstBrace = source.indexOf("{");
    const lastBrace = source.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) source = source.slice(firstBrace, lastBrace + 1);
    let parsed;
    try {
      parsed = JSON.parse(source);
    } catch {
      throw new Error("AI 回覆格式不完整");
    }
    const feedback = clean(parsed && parsed.feedback);
    const revisedPrompt = clean(parsed && parsed.revised_prompt);
    if (!feedback || feedback.length > 6000 || revisedPrompt.length < 3 || revisedPrompt.length > 4000) {
      throw new Error("AI 回覆格式不完整");
    }
    return { feedback, revisedPrompt };
  }

  function createGenerationState(kind) {
    return {
      kind,
      phase: "idle",
      idempotencyKey: "",
      request: null,
      result: null,
      error: null
    };
  }

  function transitionGeneration(state, event) {
    if (!state || !event) throw new Error("缺少狀態事件");
    if (event.type === "start") {
      return {
        ...state,
        phase: "loading",
        idempotencyKey: clean(event.idempotencyKey),
        request: event.request,
        result: null,
        error: null
      };
    }
    if (event.type === "retry") {
      if (!state.idempotencyKey || !state.request) throw new Error("沒有可重試的請求");
      return { ...state, phase: "loading", error: null };
    }
    if (event.type === "success") {
      return { ...state, phase: "success", result: event.result, error: null };
    }
    if (event.type === "failure") {
      return {
        ...state,
        phase: event.error && event.error.retryable ? "retryable" : "error",
        result: null,
        error: event.error
      };
    }
    if (event.type === "reset") return createGenerationState(state.kind);
    throw new Error(`未知狀態事件：${event.type}`);
  }

  function statusLabel(phase) {
    return ({
      idle: "尚未生成",
      loading: "生成中",
      success: "生成成功",
      error: "生成失敗",
      retryable: "生成失敗，可重試"
    })[phase] || "狀態不明";
  }

  function friendlyError(error) {
    const code = clean(error && error.code);
    const fixed = {
      VALIDATION_FAILED: "還有必填內容沒完成，請回到畫面上標示的位置補上。",
      CLASSROOM_NOT_OPEN: "練習還沒開放，請依老師公布的時間再試。",
      CLASSROOM_CLOSED: "本次練習已關閉。",
      INVALID_CLASS_CODE: "課堂碼不正確，請向老師確認。",
      UNAUTHENTICATED: "請先輸入課堂碼，進入練習室。",
      SESSION_EXPIRED: "本次使用期限已到，請重新輸入課堂碼。",
      SESSION_QUOTA_EXHAUSTED: "你這堂課可使用 AI 的次數已用完。",
      CLASS_QUOTA_EXHAUSTED: "全班可使用 AI 的次數已用完，請通知老師。",
      DUPLICATE_SUCCEEDED: "這份內容已處理完成，不用再送一次。",
      REQUEST_IN_PROGRESS: "同一份內容還在處理中，請稍候。",
      RETRY_EXHAUSTED: "這份內容已重試多次，請修改後再送出。",
      IDEMPOTENCY_CONFLICT: "內容已變更，請重新送出。",
      RATE_LIMITED: "操作太頻繁，請稍等一下再試。",
      CONTENT_BLOCKED: "文字內容未通過安全檢查，請調整後再試。",
      REFERENCE_IMAGE_REQUIRED: "目前的練習設定有問題，請通知老師。",
      INVALID_REFERENCE_IMAGE: "目前的練習設定有問題，請通知老師。",
      REFERENCE_UPLOAD_TOO_LARGE: "目前的練習設定有問題，請通知老師。",
      CULTURE_REVIEW_REQUIRED: "傳統服飾或圖紋的來源還不清楚，請先補上族群與資料來源；生成後再請熟悉內容的人確認。",
      IMAGE_API_AUTH_FAILED: "圖片服務設定有問題，請通知老師。",
      IMAGE_API_RATE_LIMITED: "圖片服務目前忙碌，請稍候再試。",
      IMAGE_API_EMPTY_RESULT: "這次沒有產生可用圖片，請再試一次。",
      IMAGE_API_FAILED: "圖片沒有生成成功，請稍後再試。",
      INVALID_PROMPT: "圖片描述至少寫 3 個字，最多 4000 個字即可。",
      AI_RESPONSE_INVALID: "AI 這次沒有產生可用的建議，請再試一次。",
      NETWORK_ERROR: "無法連上課堂服務，請檢查網路連線。"
    };
    if (fixed[code]) return fixed[code];
    if (code.endsWith("_TIMEOUT")) return "等候時間太久，請用同一份內容再試一次。";
    if (code.endsWith("_UNAVAILABLE")) return "生成服務暫時無法使用，請稍後再試。";
    return "目前無法完成這項操作，請稍後再試。";
  }

  function safeFilename(value, fallback) {
    const normalized = clean(value)
      .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 48);
    return normalized || fallback;
  }

  function buildTextDownload(content, topic) {
    return {
      filename: `${safeFilename(topic, "ai-teaching-material")}.md`,
      mimeType: "text/markdown;charset=utf-8",
      content: String(content || "")
    };
  }

  function buildImageDownload(result, scene) {
    if (!result || !ALLOWED_IMAGE_TYPES.has(result.mimeType) || (!result.dataBase64 && !result.src)) {
      throw new Error("缺少可下載的圖片");
    }
    const extension = IMAGE_EXTENSIONS.get(result.mimeType);
    return {
      filename: `${safeFilename(scene, "ai-picture-book")}.${extension}`,
      mimeType: result.mimeType,
      dataUrl: result.dataBase64 ? `data:${result.mimeType};base64,${result.dataBase64}` : result.src
    };
  }

  return {
    SERVICE_BASE,
    buildClaimPayload,
    buildTextPayload,
    buildImagePayload,
    createIdempotencyKey,
    createRequest,
    normalizeApiError,
    normalizeSession,
    normalizeGenerationResult,
    parsePromptAssistantResult,
    createGenerationState,
    transitionGeneration,
    statusLabel,
    friendlyError,
    buildTextDownload,
    buildImageDownload,
    safeFilename
  };
});
