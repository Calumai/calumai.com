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
  let promptExpertHandoff = null;
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
    if (byId("vibe-transfer-panel").open) byId("vibe-transfer-panel").close();
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
    byId("vibe-transfer-button").hidden = !succeeded;

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

  function openPromptExpert() {
    const prompt = byId("original-prompt").value.trim();
    if (prompt.length < 3 || prompt.length > 4000) {
      byId("prompt-message").textContent = "請用至少 3 個字描述圖片，不需要寫很長。";
      return;
    }
    if (!currentSession || imageState.phase === "loading") return;
    // Each handoff belongs to one child window and the exact source draft.
    // No prompt, classroom identity or credential is placed in the URL.
    const id = makeUuid();
    const child = globalThis.open(`/class/prompt-expert/#picture=${id}`, "_blank");
    promptExpertHandoff = child && !child.closed
      ? { child, id, originalPrompt: prompt, purpose: promptDraft.purpose, purposeLabel: purposeLabel(), accepted: null }
      : null;
    byId("prompt-expert-fallback").hidden = Boolean(promptExpertHandoff);
    byId("prompt-message").textContent = promptExpertHandoff
      ? "已開啟提示詞小專家。完成健檢後，按「帶回圖片工作室」；這一頁和原文會保留。"
      : "瀏覽器擋住了新分頁。請允許開啟彈出視窗後再按一次，或複製原文到提示詞小專家。";
  }

  globalThis.addEventListener("message", (event) => {
    const handoff = promptExpertHandoff;
    const message = event.data;
    if (!handoff || event.origin !== globalThis.location.origin || event.source !== handoff.child
      || !message || typeof message !== "object" || message.id !== handoff.id) return;
    if (message.type === "calum-prompt-ready") {
      handoff.child.postMessage({
        type: "calum-prompt-source", id: handoff.id, prompt: handoff.originalPrompt,
        purpose: "image", purposeLabel: handoff.purposeLabel
      }, globalThis.location.origin);
      return;
    }
    if (message.type !== "calum-prompt-result") return;
    const acknowledge = (ok, text) => handoff.child.postMessage({
      type: "calum-prompt-accepted", id: handoff.id, ok, message: text
    }, globalThis.location.origin);
    if (typeof message.feedback !== "string" || typeof message.revisedPrompt !== "string"
      || !message.feedback.trim() || message.feedback.length > 4000
      || message.revisedPrompt.trim().length < 3 || message.revisedPrompt.length > 4000) {
      acknowledge(false, "建議內容不完整，或超過 4000 個字。請縮短後重新帶回。");
      return;
    }
    if (handoff.accepted) {
      const same = handoff.accepted.feedback === message.feedback
        && handoff.accepted.revisedPrompt === message.revisedPrompt;
      acknowledge(same, same ? "這份建議已帶回，沒有重複覆蓋。" : "這次建議已帶回。若要再修改，請從圖片工作室重新開啟小專家。");
      return;
    }
    if (!currentSession || imageState.phase === "loading") {
      acknowledge(false, "圖片工作室目前無法接收。請先回到圖片工作室確認課堂狀態及圖片是否仍在生成。");
      return;
    }
    if (byId("original-prompt").value.trim() !== handoff.originalPrompt || promptDraft.purpose !== handoff.purpose) {
      acknowledge(false, "圖片工作室的原文或用途已變更，沒有覆蓋新內容。請回到圖片工作室，重新交給小專家。");
      byId("prompt-message").textContent = "原文或用途已更新，舊的 AI 建議沒有套用。請重新交給提示詞小專家。";
      return;
    }
    handoff.accepted = { feedback: message.feedback, revisedPrompt: message.revisedPrompt };
    promptDraft.originalPrompt = handoff.originalPrompt;
    promptDraft.feedback = message.feedback.trim();
    promptDraft.revisedPrompt = message.revisedPrompt.trim();
    byId("feedback-original-prompt").textContent = handoff.originalPrompt;
    byId("revised-prompt").value = promptDraft.revisedPrompt;
    byId("final-prompt-output").textContent = "";
    byId("revision-message").textContent = "提示詞小專家的修改版已帶回。確認後再進行圖片生成。";
    byId("prompt-message").textContent = "修改版已帶回，原文保留。";
    assistState = core.transitionGeneration(assistState, { type: "success", result: handoff.accepted });
    resetImage();
    highestStep = 4;
    renderAssistantState();
    updateDraftSummary();
    setStudioStep(4);
    acknowledge(true, "已帶回圖片工作室的修改版，原文保留，尚未生成圖片。");
  });

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
    // Cross-origin image URLs may ignore download. Keep the teaching page open.
    if (/^https:\/\//u.test(href)) anchor.target = "_blank";
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
    openPromptExpert();
  });

  byId("feedback-retry").addEventListener("click", openPromptExpert);
  byId("copy-prompt-for-expert").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(byId("original-prompt").value.trim());
      byId("prompt-message").textContent = "原文已複製，開啟提示詞小專家後直接貼上即可。";
    } catch {
      byId("original-prompt").focus();
      byId("original-prompt").select();
      byId("prompt-message").textContent = "瀏覽器未允許複製，已選取原文。請按 Ctrl+C，或長按文字選擇複製。";
    }
  });
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

  function downloadCurrentImage() {
    if (imageState.phase !== "success") return;
    const spec = core.buildImageDownload(imageState.result, `${purposeLabel()}-${promptDraft.originalPrompt}`);
    clickDownload(spec.dataUrl, spec.filename, false);
  }

  function hasUnstoredWork() {
    return Boolean(promptDraft.purpose || byId("original-prompt").value.trim()
      || byId("revised-prompt").value.trim() || assistState.phase === "loading"
      || imageState.phase === "loading" || imageState.phase === "success");
  }

  byId("download-image").addEventListener("click", downloadCurrentImage);
  byId("vibe-transfer-download").addEventListener("click", downloadCurrentImage);
  byId("studio-vibe-link").addEventListener("click", (event) => {
    if (!hasUnstoredWork()) return;
    event.preventDefault();
    byId("vibe-leave-dialog").showModal();
  });
  byId("vibe-leave-cancel").addEventListener("click", () => byId("vibe-leave-dialog").close());
  byId("vibe-leave-open").addEventListener("click", () => byId("vibe-leave-dialog").close());
  byId("vibe-transfer-button").addEventListener("click", () => {
    if (imageState.phase === "success") byId("vibe-transfer-panel").showModal();
  });
  byId("vibe-transfer-close").addEventListener("click", () => byId("vibe-transfer-panel").close());
  byId("vibe-transfer-open").addEventListener("click", () => byId("vibe-transfer-panel").close());

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
