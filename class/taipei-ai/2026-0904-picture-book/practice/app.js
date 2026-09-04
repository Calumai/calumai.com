(function startPracticeApp() {
  "use strict";

  const core = globalThis.ClassroomPracticeCore;
  if (!core) return;

  const byId = (id) => document.getElementById(id);
  const previewMode = ["127.0.0.1", "localhost"].includes(globalThis.location.hostname)
    || globalThis.location.protocol === "file:";
  const previewQuota = { image: null };
  const purposeLabels = {
    "picture-book": "繪本插畫",
    comic: "漫畫頁",
    "class-poster": "班級海報",
    "event-poster": "活動海報",
    "teaching-card": "教學圖卡"
  };
  const stepNames = {
    1: "選擇圖片用途",
    2: "寫下圖片描述",
    3: "查看 AI 回饋",
    4: "確認 AI 修改版",
    5: "用修改版生成圖片"
  };

  const claimForm = byId("claim-form");
  const accessPanel = byId("access-panel");
  const workspace = byId("workspace");
  const purposeForm = byId("purpose-form");
  const promptForm = byId("prompt-form");

  let currentSession = null;
  let previewSessionActive = false;
  let activeStep = 1;
  let highestStep = 1;
  let assistState = core.createGenerationState("text");
  let imageState = core.createGenerationState("image");
  let promptDraft = {
    purpose: "",
    originalPrompt: "",
    feedback: "",
    revisedPrompt: ""
  };

  if (globalThis.history && globalThis.location.search) {
    const cleanUrl = new URL(globalThis.location.href);
    for (const key of ["class_code", "nickname", "consent", "test_mode"]) {
      cleanUrl.searchParams.delete(key);
    }
    const search = previewMode ? "?preview=1" : cleanUrl.search;
    globalThis.history.replaceState(null, "", cleanUrl.pathname + search + cleanUrl.hash);
  }

  if (previewMode && !byId("class-code").value) byId("class-code").value = "20260904";

  function makeUuid() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  function valuesOf(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function purposeLabel() {
    return purposeLabels[promptDraft.purpose] || "圖片";
  }

  function previewSessionPayload(nickname) {
    return {
      ok: true,
      session: {
        nickname: nickname || "本機學員",
        mode: "preview",
        expires_at: "2099-01-01T00:00:00Z"
      },
      classroom: {
        status: "open",
        opens_at: "2099-01-01T00:00:00Z",
        closes_at: "2099-01-01T23:59:59Z"
      },
      remaining: { ...previewQuota },
      classroom_remaining: { image: null }
    };
  }

  function previewJsonResponse(pathname, body) {
    if (pathname === "/session") {
      return previewSessionActive
        ? previewSessionPayload()
        : {
          ok: false,
          request_id: "local-preview",
          error: { code: "UNAUTHENTICATED", message: "請先輸入課堂碼，進入練習室。", retryable: false }
        };
    }
    if (pathname === "/session/claim") {
      previewSessionActive = true;
      return previewSessionPayload(body && body.nickname);
    }
    if (pathname === "/session/logout") {
      previewSessionActive = false;
      return { ok: true };
    }
    if (!previewSessionActive) {
      return {
        ok: false,
        request_id: "local-preview",
        error: { code: "UNAUTHENTICATED", message: "請先輸入課堂碼，進入練習室。", retryable: false }
      };
    }
    if (pathname === "/generate/text") {
      const original = String(body && body.source_notes || "一個清楚的主題").trim();
      return {
        ok: true,
        request_id: "local-preview-text",
        kind: "text",
        content: JSON.stringify({
          feedback: "這是本機預覽文字，不是 AI 回覆。可以再補上主角、所在位置、正在做的事與畫面重點。",
          revised_prompt: `${original}。主體清楚，動作自然，構圖有明確焦點，畫面不要出現無關文字或浮水印。`
        }),
        usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
        remaining: { ...previewQuota },
        classroom_remaining: { image: 40 }
      };
    }
    return {
      ok: false,
      request_id: "local-preview",
      error: { code: "HTTP_404", message: "本機預覽發生錯誤。", retryable: false }
    };
  }

  async function callJsonService(pathname, method, body, timeoutMs) {
    if (previewMode) {
      const payload = previewJsonResponse(pathname, body);
      if (!payload || payload.ok !== true) throw core.normalizeApiError(payload, 400);
      return payload;
    }
    const descriptor = core.createRequest(pathname, method, body);
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(descriptor.url, { ...descriptor.options, signal: controller.signal });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok || !payload || payload.ok !== true) {
        throw core.normalizeApiError(payload, response.status);
      }
      return payload;
    } catch (error) {
      if (error && error.code) throw error;
      if (error && error.name === "AbortError") {
        throw {
          code: "CLIENT_TIMEOUT",
          message: "等待時間過久，請再試一次。",
          retryable: true,
          requestId: "",
          httpStatus: 0
        };
      }
      throw {
        code: "NETWORK_ERROR",
        message: "無法連上課堂服務，請檢查網路連線。",
        retryable: true,
        requestId: "",
        httpStatus: 0
      };
    } finally {
      globalThis.clearTimeout(timer);
    }
  }

  async function callImageService(prompt) {
    if (previewMode) {
      if (!previewSessionActive) {
        throw { code: "UNAUTHENTICATED", message: "請先輸入課堂碼，進入練習室。", retryable: false, requestId: "", httpStatus: 401 };
      }
      return {
        ok: true,
        request_id: "local-preview-image",
        kind: "image",
        image: { mime_type: "image/png", type: "url", src: "../assets/images/page-cover.png" },
        remaining: { ...previewQuota },
        classroom_remaining: { text: null, image: null }
      };
    }

    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), 180000);
    try {
      const response = await fetch("/api/generate-image", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
        signal: controller.signal
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }
      if (!response.ok || !payload || payload.ok !== true) {
        throw core.normalizeApiError(payload, response.status);
      }
      return payload;
    } catch (error) {
      if (error && error.code) throw error;
      if (error && error.name === "AbortError") {
        throw {
          code: "IMAGE_API_TIMEOUT",
          message: "圖片生成逾時。",
          retryable: true,
          requestId: "",
          httpStatus: 0
        };
      }
      throw {
        code: "NETWORK_ERROR",
        message: "無法連上課堂服務，請檢查網路連線。",
        retryable: true,
        requestId: "",
        httpStatus: 0
      };
    } finally {
      globalThis.clearTimeout(timer);
    }
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return new Intl.DateTimeFormat("zh-TW", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function setClaimBusy(isBusy, label) {
    byId("claim-button").disabled = isBusy;
    byId("claim-button").textContent = isBusy ? label : "進入練習室";
  }

  function showAccess(message) {
    currentSession = null;
    accessPanel.hidden = false;
    workspace.hidden = true;
    byId("practice-intro").hidden = false;
    byId("claim-message").textContent = message || "";
  }

  function showWorkspace(session) {
    currentSession = session;
    accessPanel.hidden = true;
    workspace.hidden = false;
    byId("practice-intro").hidden = true;
    byId("session-nickname").textContent = session.nickname || "學員";
    byId("classroom-status-chip").textContent = previewMode ? "本機預覽" : "課堂開放中";
    const closesAt = formatDateTime(session.classroom.closesAt);
    byId("classroom-window").textContent = previewMode
      ? "目前是本機預覽模式；畫面中的回饋與圖片都不是 AI 生成結果。"
      : closesAt
        ? `本次課堂開放至 ${closesAt}。`
        : "課堂已開放；結束時間請以老師公告為準。";
    updateQuotaDisplay(session.remaining);
    updateAvailability();
    setStudioStep(activeStep, false);
  }

  function updateQuotaDisplay(remaining) {
    byId("personal-text-quota").textContent = "不限次";
    byId("personal-image-quota").textContent = "不限次";
  }

  function updateSessionFromResult(result) {
    if (!currentSession || !result || !result.remaining) return;
    currentSession.remaining = result.remaining;
    if (result.classroomRemaining) currentSession.classroomRemaining = result.classroomRemaining;
    updateQuotaDisplay(currentSession.remaining);
    updateAvailability();
  }

  async function restoreSession() {
    try {
      const payload = await callJsonService("/session", "GET", undefined, 10000);
      showWorkspace(core.normalizeSession(payload));
    } catch (error) {
      showAccess(error && error.code === "SESSION_EXPIRED" ? "本次使用期限已到，請重新輸入課堂碼。" : "");
    }
  }

  function resetImage() {
    imageState = core.transitionGeneration(imageState, { type: "reset" });
    renderImageState();
  }

  function resetAssistantAndImage() {
    assistState = core.transitionGeneration(assistState, { type: "reset" });
    promptDraft.feedback = "";
    promptDraft.revisedPrompt = "";
    byId("revised-prompt").value = "";
    byId("final-prompt-output").textContent = "";
    highestStep = Math.min(highestStep, 2);
    resetImage();
    renderAssistantState();
    updateDraftSummary();
    updateStepNavigation();
  }

  function updateDraftSummary() {
    byId("preview-purpose").textContent = promptDraft.purpose
      ? `目前用途：${purposeLabel()}`
      : "先選擇圖片用途";
    byId("original-prompt-status").textContent = promptDraft.originalPrompt ? "已填寫" : "未填寫";
    byId("revised-prompt-status").textContent = promptDraft.revisedPrompt ? "已準備" : "尚未產生";
    byId("prompt-count").textContent = `${byId("original-prompt").value.length} / 4000`;
    byId("revised-count").textContent = `${byId("revised-prompt").value.length} / 4000`;
  }

  function updateStepNavigation() {
    document.querySelectorAll("[data-studio-step-target]").forEach((button) => {
      const step = Number(button.dataset.studioStepTarget);
      const item = button.closest("li");
      button.disabled = step > highestStep;
      button.setAttribute("aria-current", step === activeStep ? "step" : "false");
      item.dataset.state = step === activeStep ? "active" : step < activeStep ? "complete" : "upcoming";
    });
    byId("current-step-name").textContent = `現在：${stepNames[activeStep]}`;
  }

  function setStudioStep(step, focusHeading = true) {
    const nextStep = Number(step);
    if (!Number.isInteger(nextStep) || nextStep < 1 || nextStep > 5 || nextStep > highestStep) return;
    activeStep = nextStep;
    document.querySelectorAll("[data-studio-panel]").forEach((panel) => {
      panel.hidden = Number(panel.dataset.studioPanel) !== activeStep;
    });
    updateStepNavigation();
    if (focusHeading) {
      const heading = document.querySelector(`[data-studio-panel="${activeStep}"] h4`);
      if (heading) heading.focus({ preventScroll: true });
    }
  }

  function updateAvailability() {
    const textBusy = assistState.phase === "loading";
    const imageBusy = imageState.phase === "loading";
    byId("review-prompt-button").disabled = textBusy || imageBusy;
    byId("feedback-retry").disabled = textBusy || imageBusy;
    byId("show-revised-prompt").disabled = textBusy || imageBusy;
    byId("confirm-revised-prompt").disabled = textBusy || imageBusy;
    byId("generate-image-button").disabled = textBusy || imageBusy;
    byId("image-retry").disabled = textBusy || imageBusy;
  }

  function errorReference(error) {
    const details = [];
    if (error && error.code) details.push(`錯誤代碼：${error.code}`);
    if (error && error.requestId) details.push(`查詢編號：${error.requestId}`);
    if (error && error.httpStatus) details.push(`HTTP 狀態碼：${error.httpStatus}`);
    return details.join("；");
  }

  function renderAssistantState() {
    const loading = assistState.phase === "loading";
    const failed = assistState.phase === "error" || assistState.phase === "retryable";
    const succeeded = assistState.phase === "success";
    byId("feedback-loading").hidden = !loading;
    byId("feedback-loading").setAttribute("aria-hidden", String(!loading));
    byId("feedback-error").hidden = !failed;
    byId("feedback-success").hidden = !succeeded;
    byId("feedback-retry").hidden = !failed || !assistState.error || !assistState.error.retryable;
    byId("show-revised-prompt").hidden = !succeeded;
    if (failed) {
      byId("feedback-error-message").textContent = core.friendlyError(assistState.error);
      byId("feedback-error-reference").textContent = errorReference(assistState.error);
    } else {
      byId("feedback-error-message").textContent = "";
      byId("feedback-error-reference").textContent = "";
    }
    if (succeeded) byId("feedback-output").textContent = promptDraft.feedback;
    updateAvailability();
  }

  function renderImageState() {
    const loading = imageState.phase === "loading";
    const failed = imageState.phase === "error" || imageState.phase === "retryable";
    const succeeded = imageState.phase === "success";
    byId("image-preview-empty").hidden = loading || failed || succeeded;
    byId("image-loading").hidden = !loading;
    byId("image-loading").setAttribute("aria-hidden", String(!loading));
    byId("image-error").hidden = !failed;
    byId("image-success").hidden = !succeeded;
    byId("image-retry").hidden = !failed || !imageState.error || !imageState.error.retryable;
    byId("generate-image-button").hidden = succeeded || failed;
    byId("download-image").hidden = !succeeded;

    if (loading) {
      byId("preview-title").textContent = "正在生成圖片";
      byId("image-message").textContent = "生成中，通常需要一至三分鐘。";
    } else if (failed) {
      byId("preview-title").textContent = "圖片沒有生成成功";
      byId("image-message").textContent = "";
      byId("image-error-message").textContent = core.friendlyError(imageState.error);
      byId("image-error-reference").textContent = errorReference(imageState.error);
    } else if (succeeded) {
      const result = imageState.result;
      const src = result.dataBase64
        ? `data:${result.mimeType};base64,${result.dataBase64}`
        : result.src;
      byId("preview-title").textContent = previewMode ? "本機預覽圖片" : "圖片完成了";
      byId("image-message").textContent = previewMode
        ? "這是本機預覽圖片，不是 AI 生成結果。"
        : "圖片已完成，可以在作品預覽區查看與下載。";
      byId("generated-image").src = src;
      byId("generated-image").alt = `${purposeLabel()}生成結果`;
      byId("image-request-reference").textContent = previewMode
        ? "本機預覽圖片"
        : result.requestId ? `查詢編號：${result.requestId}` : "";
    } else {
      byId("preview-title").textContent = "還沒生成圖片";
      byId("image-message").textContent = "";
      byId("image-error-message").textContent = "";
      byId("image-error-reference").textContent = "";
      byId("generated-image").removeAttribute("src");
      byId("generated-image").alt = "";
      byId("image-request-reference").textContent = "";
    }
    updateAvailability();
  }

  function buildAssistantRequest() {
    const request = {
      topic: `圖片提示詞檢視｜${purposeLabel()}`,
      audience: "AI 繪圖初學教師",
      duration_minutes: 5,
      objective: "讓使用者看懂原始描述缺少什麼，並取得可直接生圖的修正版",
      source_notes: promptDraft.originalPrompt,
      requirements: "只回傳一個 JSON 物件，欄位只能有 feedback 與 revised_prompt。feedback 請用白話說明最優先調整的兩至三點；revised_prompt 要保留原意，補足主體、場景、動作、構圖與必要限制。不得捏造族語、族群文化、服飾、圖紋、器物、儀式或事實。資料不足時，請在修正版寫明不要自行添加未確認細節。"
    };
    const idempotencyKey = core.createIdempotencyKey("text", makeUuid());
    return {
      idempotencyKey,
      payload: core.buildTextPayload(request, idempotencyKey)
    };
  }

  async function performPromptReview(isRetry) {
    if (!isRetry) {
      const request = buildAssistantRequest();
      assistState = core.transitionGeneration(assistState, {
        type: "start",
        idempotencyKey: request.idempotencyKey,
        request: request.payload
      });
    } else {
      assistState = core.transitionGeneration(assistState, { type: "retry" });
    }
    renderAssistantState();
    try {
      const payload = await callJsonService("/generate/text", "POST", assistState.request, 70000);
      const result = core.normalizeGenerationResult("text", payload);
      let parsed;
      try {
        parsed = core.parsePromptAssistantResult(result.content);
      } catch {
        throw {
          code: "AI_RESPONSE_INVALID",
          message: "AI 回覆格式不完整。",
          retryable: true,
          requestId: result.requestId,
          httpStatus: 0
        };
      }
      promptDraft.feedback = parsed.feedback;
      promptDraft.revisedPrompt = parsed.revisedPrompt;
      byId("revised-prompt").value = parsed.revisedPrompt;
      assistState = core.transitionGeneration(assistState, { type: "success", result });
      highestStep = Math.max(highestStep, 4);
      updateSessionFromResult(result);
      updateDraftSummary();
    } catch (error) {
      assistState = core.transitionGeneration(assistState, { type: "failure", error });
    }
    renderAssistantState();
    updateStepNavigation();
  }

  async function performImageGeneration(isRetry) {
    const prompt = promptDraft.revisedPrompt.trim();
    if (prompt.length < 3 || prompt.length > 4000) {
      byId("image-message").textContent = "圖片描述至少寫 3 個字，最多 4000 個字即可。";
      return;
    }
    if (!isRetry) {
      imageState = core.transitionGeneration(imageState, {
        type: "start",
        idempotencyKey: core.createIdempotencyKey("image", makeUuid()),
        request: { prompt }
      });
    } else {
      imageState = core.transitionGeneration(imageState, { type: "retry" });
    }
    renderImageState();
    try {
      const payload = await callImageService(imageState.request.prompt);
      const result = core.normalizeGenerationResult("image", payload);
      imageState = core.transitionGeneration(imageState, { type: "success", result });
      updateSessionFromResult(result);
    } catch (error) {
      imageState = core.transitionGeneration(imageState, { type: "failure", error });
    }
    renderImageState();
  }

  function clickDownload(href, filename, revoke) {
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = filename;
    anchor.rel = "noopener";
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    if (revoke) globalThis.setTimeout(() => URL.revokeObjectURL(href), 0);
  }

  claimForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    byId("claim-message").textContent = "";
    if (!claimForm.reportValidity()) return;
    setClaimBusy(true, "正在加入課堂");
    try {
      const payload = await callJsonService(
        "/session/claim",
        "POST",
        core.buildClaimPayload({ ...valuesOf(claimForm), consent: byId("consent").checked }),
        10000
      );
      showWorkspace(core.normalizeSession(payload));
    } catch (error) {
      byId("claim-message").textContent = core.friendlyError(error);
    } finally {
      setClaimBusy(false, "");
    }
  });

  byId("logout-button").addEventListener("click", async () => {
    try {
      await callJsonService("/session/logout", "POST", {}, 10000);
      showAccess("你已離開練習室。若要繼續，請重新輸入課堂碼。");
    } catch (error) {
      byId("classroom-window").textContent = core.friendlyError(error);
    }
  });

  purposeForm.addEventListener("change", () => {
    const selected = valuesOf(purposeForm).image_purpose || "";
    if (selected !== promptDraft.purpose) {
      promptDraft.purpose = selected;
      resetAssistantAndImage();
    }
    byId("purpose-message").textContent = "";
    updateDraftSummary();
  });

  purposeForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const selected = valuesOf(purposeForm).image_purpose || "";
    if (!selected) {
      byId("purpose-message").textContent = "請先選一種圖片用途。";
      return;
    }
    promptDraft.purpose = selected;
    highestStep = Math.max(highestStep, 2);
    updateDraftSummary();
    setStudioStep(2);
  });

  byId("original-prompt").addEventListener("input", () => {
    const nextPrompt = byId("original-prompt").value.trim();
    if (nextPrompt !== promptDraft.originalPrompt) {
      promptDraft.originalPrompt = nextPrompt;
      resetAssistantAndImage();
    }
    byId("prompt-message").textContent = "";
    updateDraftSummary();
  });

  promptForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const prompt = byId("original-prompt").value.trim();
    promptDraft.originalPrompt = prompt;
    if (prompt.length < 3 || prompt.length > 4000) {
      byId("prompt-message").textContent = "請用至少 3 個字描述圖片，不需要寫很長。";
      return;
    }
    byId("prompt-message").textContent = "";
    byId("feedback-original-prompt").textContent = prompt;
    promptDraft.feedback = "";
    promptDraft.revisedPrompt = "";
    resetImage();
    highestStep = Math.max(highestStep, 3);
    setStudioStep(3);
    performPromptReview(false);
  });

  byId("feedback-retry").addEventListener("click", () => performPromptReview(true));
  byId("show-revised-prompt").addEventListener("click", () => {
    byId("revised-prompt").value = promptDraft.revisedPrompt;
    updateDraftSummary();
    setStudioStep(4);
  });

  byId("revised-prompt").addEventListener("input", () => {
    promptDraft.revisedPrompt = byId("revised-prompt").value;
    byId("revision-message").textContent = "";
    highestStep = Math.min(highestStep, 4);
    resetImage();
    updateDraftSummary();
    updateStepNavigation();
  });

  byId("confirm-revised-prompt").addEventListener("click", () => {
    const revised = byId("revised-prompt").value.trim();
    if (revised.length < 3 || revised.length > 4000) {
      byId("revision-message").textContent = "修改版至少要有 3 個字，最多 4000 個字。";
      return;
    }
    promptDraft.revisedPrompt = revised;
    byId("revised-prompt").value = revised;
    byId("final-prompt-output").textContent = revised;
    byId("revision-message").textContent = "";
    highestStep = 5;
    updateDraftSummary();
    setStudioStep(5);
  });

  byId("generate-image-button").addEventListener("click", () => performImageGeneration(false));
  byId("image-retry").addEventListener("click", () => performImageGeneration(true));

  byId("download-image").addEventListener("click", () => {
    if (imageState.phase !== "success") return;
    const spec = core.buildImageDownload(imageState.result, `${purposeLabel()}-${promptDraft.originalPrompt}`);
    clickDownload(spec.dataUrl, spec.filename, false);
  });

  document.querySelectorAll("[data-studio-step-target]").forEach((button) => {
    button.addEventListener("click", () => setStudioStep(button.dataset.studioStepTarget));
  });

  document.querySelectorAll("[data-step-previous]").forEach((button) => {
    button.addEventListener("click", () => setStudioStep(button.dataset.stepPrevious));
  });

  updateDraftSummary();
  renderAssistantState();
  renderImageState();
  updateStepNavigation();
  restoreSession();
})();
