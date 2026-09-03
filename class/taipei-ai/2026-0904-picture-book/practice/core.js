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
      message: clean(detail.message) || "目前無法完成請求，請稍後再試。",
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
    if (!ALLOWED_IMAGE_TYPES.has(mimeType) || (!dataBase64 && !/^https:\/\//u.test(src))) {
      throw new Error("圖片生成結果格式不支援");
    }
    return { ...shared, kind, mimeType, dataBase64, src };
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
      VALIDATION_FAILED: "請檢查欄位是否填寫完整。",
      CLASSROOM_NOT_OPEN: "練習尚未開放，請依講師公布時間再試。",
      CLASSROOM_CLOSED: "本次練習已關閉。",
      INVALID_CLASS_CODE: "課堂碼不正確，請向講師確認。",
      UNAUTHENTICATED: "請先輸入課堂碼登入。",
      SESSION_EXPIRED: "工作階段已過期，請重新登入。",
      SESSION_QUOTA_EXHAUSTED: "你的本次生成額度已用完。",
      CLASS_QUOTA_EXHAUSTED: "全班生成額度已用完，請通知講師。",
      DUPLICATE_SUCCEEDED: "這筆請求先前已成功，請勿重複送出。",
      REQUEST_IN_PROGRESS: "相同請求仍在處理中，請稍候再試。",
      RETRY_EXHAUSTED: "此請求已達重試上限，請修改內容後重新生成。",
      IDEMPOTENCY_CONFLICT: "這筆識別碼已用於其他內容，請重新按下生成。",
      RATE_LIMITED: "目前請求較多，請稍候再試。",
      CONTENT_BLOCKED: "內容或參考圖未通過安全檢查，請調整後再試。",
      REFERENCE_IMAGE_REQUIRED: "請先上傳至少一張有權使用的參考圖。",
      INVALID_REFERENCE_IMAGE: "參考圖只接受 PNG、JPG 或 WebP，單張不可超過 4 MB。",
      REFERENCE_UPLOAD_TOO_LARGE: "參考圖總量太大，請減少張數或壓縮後再試。",
      CULTURE_REVIEW_REQUIRED: "傳統服飾或圖紋必須先補齊明確來源與真人審訂。",
      IMAGE_API_AUTH_FAILED: "圖片服務驗證失敗，請通知講師。",
      IMAGE_API_RATE_LIMITED: "圖片服務目前忙碌，請稍候再試。",
      IMAGE_API_EMPTY_RESULT: "圖片服務沒有回傳可用圖片。",
      IMAGE_API_FAILED: "這次圖片生成沒有完成，請檢查內容後再試。"
    };
    if (fixed[code]) return fixed[code];
    if (code.endsWith("_TIMEOUT")) return "生成逾時，原請求可以再試一次。";
    if (code.endsWith("_UNAVAILABLE")) return "生成服務暫時無法使用，請稍後再試。";
    return clean(error && error.message) || "目前無法完成請求，請稍後再試。";
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
    createGenerationState,
    transitionGeneration,
    statusLabel,
    friendlyError,
    buildTextDownload,
    buildImageDownload,
    safeFilename
  };
});
