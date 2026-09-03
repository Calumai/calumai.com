(function startPracticeApp() {
  "use strict";

  const core = globalThis.ClassroomPracticeCore;
  if (!core) return;

  const byId = (id) => document.getElementById(id);
  const claimForm = byId("claim-form");
  const claimButton = byId("claim-button");
  const claimMessage = byId("claim-message");
  const accessPanel = byId("access-panel");
  const workspace = byId("workspace");
  const logoutButton = byId("logout-button");
  const textForm = byId("text-form");
  const imageForm = byId("image-form");
  const generationForms = { text: textForm, image: imageForm };
  const generationStates = {
    text: core.createGenerationState("text"),
    image: core.createGenerationState("image")
  };
  let currentSession = null;

  function makeUuid() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  async function callService(pathname, method, body, timeoutMs) {
    const descriptor = core.createRequest(pathname, method, body);
    const controller = new AbortController();
    const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(descriptor.url, {
        ...descriptor.options,
        signal: controller.signal
      });
      let payload = null;
      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok || !payload || payload.ok !== true) {
        throw { practiceError: core.normalizeApiError(payload, response.status) };
      }
      return payload;
    } catch (error) {
      if (error && error.practiceError) throw error.practiceError;
      if (error && error.name === "AbortError") {
        throw {
          code: "CLIENT_TIMEOUT",
          message: "等待時間已超過本頁上限。",
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
      globalThis.clearTimeout(timeout);
    }
  }

  function valuesOf(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function reportMeaningfulValidity(form) {
    for (const field of form.querySelectorAll('input[required], textarea[required]')) {
      if (field.type === "checkbox" || field.type === "number") continue;
      field.setCustomValidity(field.value.trim() ? "" : "請填寫此欄位。");
    }
    return form.reportValidity();
  }

  document.querySelectorAll('input[required], textarea[required]').forEach((field) => {
    field.addEventListener("input", () => {
      if (field.type !== "checkbox" && field.value.trim()) field.setCustomValidity("");
    });
  });

  function setClaimBusy(isBusy, label) {
    claimButton.disabled = isBusy;
    claimButton.textContent = label || "進入練習室";
  }

  function showAccess(message) {
    currentSession = null;
    accessPanel.hidden = false;
    workspace.hidden = true;
    claimMessage.textContent = message || "";
  }

  function formatQuota(value) {
    return Number.isFinite(value) ? String(value) : "-";
  }

  function formatDateTime(value) {
    if (!value) return "未提供";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("zh-TW", {
      timeZone: "Asia/Taipei",
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  }

  function classroomLabel(status) {
    return ({
      open: "練習開放中",
      not_open: "尚未開放",
      scheduled: "尚未開放",
      closed: "練習已關閉"
    })[status] || "課堂狀態待確認";
  }

  function updateQuotaDisplay(remaining, classroomRemaining) {
    byId("personal-text-quota").textContent = formatQuota(remaining.text);
    byId("personal-image-quota").textContent = formatQuota(remaining.image);
    byId("class-text-quota").textContent = formatQuota(classroomRemaining.text);
    byId("class-image-quota").textContent = formatQuota(classroomRemaining.image);
  }

  function updateSessionFromResult(result) {
    if (!currentSession || !result) return;
    currentSession = {
      ...currentSession,
      remaining: result.remaining,
      classroomRemaining: result.classroomRemaining
    };
    updateQuotaDisplay(currentSession.remaining, currentSession.classroomRemaining);
    updateSubmitAvailability();
  }

  function updateSubmitAvailability() {
    if (!currentSession) return;
    const isOpen = currentSession.classroom.status === "open";
    for (const kind of ["text", "image"]) {
      const submit = generationForms[kind].querySelector('button[type="submit"]');
      const busy = generationStates[kind].phase === "loading";
      const personalLeft = currentSession.remaining[kind];
      const classLeft = currentSession.classroomRemaining[kind];
      const quotaAvailable = (personalLeft === null || personalLeft > 0)
        && (classLeft === null || classLeft > 0);
      submit.disabled = busy || !isOpen || !quotaAvailable;
      if (!isOpen) submit.title = "目前不在課堂開放時間內";
      else if (!quotaAvailable) submit.title = "生成額度已用完";
      else submit.removeAttribute("title");
    }
  }

  function showWorkspace(session) {
    currentSession = session;
    accessPanel.hidden = true;
    workspace.hidden = false;
    claimMessage.textContent = "";
    byId("session-nickname").textContent = session.nickname || "學員";

    const statusChip = byId("classroom-status-chip");
    statusChip.textContent = classroomLabel(session.classroom.status);
    statusChip.dataset.status = session.classroom.status;
    byId("classroom-window").textContent = `開放 ${formatDateTime(session.classroom.opensAt)}，關閉 ${formatDateTime(session.classroom.closesAt)}。工作階段至 ${formatDateTime(session.expiresAt)}。`;
    updateQuotaDisplay(session.remaining, session.classroomRemaining);
    updateSubmitAvailability();
  }

  async function restoreSession() {
    setClaimBusy(true, "確認工作階段");
    try {
      const payload = await callService("/session", "GET", undefined, 15000);
      showWorkspace(core.normalizeSession(payload));
    } catch (error) {
      const message = error.code === "SESSION_EXPIRED" ? "先前的工作階段已過期，請重新登入。" : "";
      showAccess(message);
    } finally {
      setClaimBusy(false);
    }
  }

  claimForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!reportMeaningfulValidity(claimForm)) return;
    setClaimBusy(true, "正在登入");
    claimMessage.textContent = "正在建立短期工作階段。";

    try {
      const raw = valuesOf(claimForm);
      raw.consent = byId("consent").checked;
      const payload = await callService("/session/claim", "POST", core.buildClaimPayload(raw), 20000);
      showWorkspace(core.normalizeSession(payload));
    } catch (error) {
      claimMessage.textContent = core.friendlyError(error);
    } finally {
      setClaimBusy(false);
    }
  });

  logoutButton.addEventListener("click", async () => {
    const previousLabel = logoutButton.textContent;
    logoutButton.disabled = true;
    logoutButton.textContent = "正在結束";
    try {
      await callService("/session/logout", "POST", {}, 15000);
      for (const kind of ["text", "image"]) {
        generationStates[kind] = core.transitionGeneration(generationStates[kind], { type: "reset" });
        renderGeneration(kind);
      }
      showAccess("工作階段已結束。若要繼續練習，請重新輸入課堂碼。");
      byId("class-code").focus();
    } catch (error) {
      byId("classroom-window").textContent = core.friendlyError(error);
    } finally {
      logoutButton.disabled = false;
      logoutButton.textContent = previousLabel;
    }
  });

  function selectTab(kind, shouldFocus) {
    for (const tab of document.querySelectorAll('[role="tab"]')) {
      const selected = tab.dataset.tab === kind;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && shouldFocus) tab.focus();
    }
    byId("text-panel").hidden = kind !== "text";
    byId("image-panel").hidden = kind !== "image";
  }

  document.querySelectorAll('[role="tab"]').forEach((tab) => {
    tab.addEventListener("click", () => selectTab(tab.dataset.tab, false));
    tab.addEventListener("keydown", (event) => {
      const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
      const currentIndex = tabs.indexOf(tab);
      let nextIndex = currentIndex;
      if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
      else if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") nextIndex = 0;
      else if (event.key === "End") nextIndex = tabs.length - 1;
      else return;
      event.preventDefault();
      selectTab(tabs[nextIndex].dataset.tab, true);
    });
  });

  function generationElements(kind) {
    return {
      status: byId(`${kind}-status`),
      feedback: byId(`${kind}-feedback`),
      empty: byId(`${kind}-empty`),
      loading: byId(`${kind}-loading`),
      error: byId(`${kind}-error`),
      success: byId(`${kind}-success`),
      errorMessage: byId(`${kind}-error-message`),
      errorReference: byId(`${kind}-error-reference`),
      retry: byId(`${kind}-retry`)
    };
  }

  function renderGeneration(kind) {
    const state = generationStates[kind];
    const elements = generationElements(kind);
    elements.status.textContent = core.statusLabel(state.phase);
    elements.status.dataset.phase = state.phase;
    elements.empty.hidden = state.phase !== "idle";
    elements.loading.hidden = state.phase !== "loading";
    elements.loading.setAttribute("aria-hidden", String(state.phase !== "loading"));
    elements.error.hidden = !["error", "retryable"].includes(state.phase);
    elements.success.hidden = state.phase !== "success";
    elements.feedback.textContent = state.phase === "loading"
      ? "請求已送出，完成前請勿重複按下生成。"
      : state.phase === "success"
        ? "生成完成，請先檢查內容再下載。"
        : state.phase === "retryable"
          ? "原請求可以安全重試，系統會沿用相同識別碼。"
          : "";

    if (state.error) {
      elements.errorMessage.textContent = core.friendlyError(state.error);
      const references = [`錯誤代碼 ${state.error.code}`];
      if (state.error.requestId) references.push(`查詢編號 ${state.error.requestId}`);
      if (state.error.httpStatus) references.push(`HTTP ${state.error.httpStatus}`);
      elements.errorReference.textContent = references.join("，");
      elements.retry.hidden = state.phase !== "retryable";
    } else {
      elements.errorMessage.textContent = "";
      elements.errorReference.textContent = "";
      elements.retry.hidden = true;
    }

    const submit = generationForms[kind].querySelector('button[type="submit"]');
    if (state.phase === "loading") {
      submit.disabled = true;
      submit.textContent = kind === "text" ? "正在生成教材" : "正在生成圖片";
    } else {
      submit.textContent = kind === "text" ? "生成教材草稿" : "生成繪本圖片";
      updateSubmitAvailability();
    }
  }

  function buildGenerationRequest(kind, idempotencyKey) {
    const input = valuesOf(generationForms[kind]);
    return kind === "text"
      ? core.buildTextPayload(input, idempotencyKey)
      : core.buildImagePayload(input, idempotencyKey);
  }

  async function performGeneration(kind, isRetry) {
    const form = generationForms[kind];
    if (!isRetry && !reportMeaningfulValidity(form)) return;

    if (isRetry) {
      generationStates[kind] = core.transitionGeneration(generationStates[kind], { type: "retry" });
    } else {
      const idempotencyKey = core.createIdempotencyKey(kind, makeUuid());
      const request = buildGenerationRequest(kind, idempotencyKey);
      generationStates[kind] = core.transitionGeneration(generationStates[kind], {
        type: "start",
        idempotencyKey,
        request
      });
    }
    renderGeneration(kind);

    try {
      const payload = await callService(
        `/generate/${kind}`,
        "POST",
        generationStates[kind].request,
        kind === "image" ? 180000 : 120000
      );
      const result = core.normalizeGenerationResult(kind, payload);
      generationStates[kind] = core.transitionGeneration(generationStates[kind], { type: "success", result });
      if (kind === "text") renderTextSuccess(result);
      else renderImageSuccess(result);
      updateSessionFromResult(result);
    } catch (error) {
      generationStates[kind] = core.transitionGeneration(generationStates[kind], { type: "failure", error });
      if (["UNAUTHENTICATED", "SESSION_EXPIRED"].includes(error.code)) {
        globalThis.setTimeout(() => showAccess(core.friendlyError(error)), 700);
      }
    }
    renderGeneration(kind);
  }

  textForm.addEventListener("submit", (event) => {
    event.preventDefault();
    performGeneration("text", false);
  });

  imageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    performGeneration("image", false);
  });

  byId("text-retry").addEventListener("click", () => performGeneration("text", true));
  byId("image-retry").addEventListener("click", () => performGeneration("image", true));

  function renderTextSuccess(result) {
    byId("text-output").textContent = result.content;
    byId("text-request-reference").textContent = result.requestId ? `查詢編號 ${result.requestId}` : "";
  }

  function renderImageSuccess(result) {
    const download = core.buildImageDownload(result, valuesOf(imageForm).scene);
    byId("image-output").src = download.dataUrl;
    byId("image-request-reference").textContent = result.requestId ? `查詢編號 ${result.requestId}` : "";
  }

  async function copyText(value) {
    if (navigator.clipboard && globalThis.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const helper = document.createElement("textarea");
    helper.value = value;
    helper.setAttribute("readonly", "");
    helper.className = "clipboard-helper";
    document.body.appendChild(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }

  byId("copy-text").addEventListener("click", async () => {
    try {
      await copyText(generationStates.text.result.content);
      byId("text-feedback").textContent = "文字已複製到剪貼簿。";
    } catch {
      byId("text-feedback").textContent = "無法自動複製，請選取結果後手動複製。";
    }
  });

  function clickDownload(href, filename, revoke) {
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    link.hidden = true;
    document.body.appendChild(link);
    link.click();
    link.remove();
    if (revoke) globalThis.setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  byId("download-text").addEventListener("click", () => {
    const spec = core.buildTextDownload(generationStates.text.result.content, valuesOf(textForm).topic);
    const url = URL.createObjectURL(new Blob([spec.content], { type: spec.mimeType }));
    clickDownload(url, spec.filename, true);
    byId("text-feedback").textContent = "Markdown 檔已開始下載。";
  });

  byId("download-image").addEventListener("click", () => {
    const button = byId("download-image");
    const previousLabel = button.textContent;
    button.disabled = true;
    button.textContent = "準備圖片";
    try {
      const spec = core.buildImageDownload(generationStates.image.result, valuesOf(imageForm).scene);
      clickDownload(spec.dataUrl, spec.filename, false);
      byId("image-feedback").textContent = "圖片已開始下載。";
    } catch {
      byId("image-feedback").textContent = "圖片下載準備失敗，請稍後再試。";
    } finally {
      button.disabled = false;
      button.textContent = previousLabel;
    }
  });

  renderGeneration("text");
  renderGeneration("image");
  restoreSession();
})();
