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
  const previewMode = ["127.0.0.1", "localhost"].includes(globalThis.location.hostname)
    && new URLSearchParams(globalThis.location.search).get("preview") === "1";
  let previewSessionActive = false;
  const previewQuota = { text: 2, image: 1 };
  const previewImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

  function makeUuid() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  function previewSessionPayload(nickname) {
    return {
      ok: true,
      session: { nickname: nickname || "本機學員", mode: "preview", expires_at: "2099-01-01T00:00:00Z" },
      classroom: { status: "open", opens_at: "2099-01-01T00:00:00Z", closes_at: "2099-01-01T23:59:59Z" },
      remaining: { text: previewQuota.text, image: previewQuota.image },
      classroom_remaining: { text: 80 - (2 - previewQuota.text), image: 40 - (1 - previewQuota.image) }
    };
  }

  function previewResponse(pathname, body) {
    if (pathname === "/session") {
      return previewSessionActive
        ? previewSessionPayload()
        : { ok: false, request_id: "local-preview", error: { code: "UNAUTHENTICATED", message: "請先輸入課堂碼登入。", retryable: false } };
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
      return { ok: false, request_id: "local-preview", error: { code: "UNAUTHENTICATED", message: "請先輸入課堂碼登入。", retryable: false } };
    }
    const kind = pathname === "/generate/image" || pathname === "/api/generate-image" ? "image" : "text";
    if (previewQuota[kind] <= 0) {
      return { ok: false, request_id: "local-preview", error: { code: "SESSION_QUOTA_EXHAUSTED", message: "本機展示額度已用完。", retryable: false } };
    }
    previewQuota[kind] -= 1;
    const remaining = { text: previewQuota.text, image: previewQuota.image };
    const classroomRemaining = {
      text: 80 - (2 - previewQuota.text),
      image: 40 - (1 - previewQuota.image)
    };
    if (kind === "image") {
      return {
        ok: true,
        request_id: "local-preview-image",
        kind,
        image: { mime_type: "image/png", data_base64: previewImageBase64, type: "base64", src: `data:image/png;base64,${previewImageBase64}` },
        remaining,
        classroom_remaining: classroomRemaining
      };
    }
    const topic = body && body.topic ? body.topic : "本機展示教材";
    return {
      ok: true,
      request_id: "local-preview-text",
      kind,
      content: `# ${topic}\n\n## 本機展示草稿\n\n這是本機預覽模式產生的範例文字，不會送到正式服務。\n\n- 對象：${body && body.audience ? body.audience : "待填寫"}\n- 時間：${body && body.duration_minutes ? body.duration_minutes : "待填寫"} 分鐘\n- 下一步：檢查內容、文化脈絡與授權後再下載。`,
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      remaining,
      classroom_remaining: classroomRemaining
    };
  }

  async function callService(pathname, method, body, timeoutMs) {
    if (previewMode) return previewResponse(pathname, body);
    const descriptor = core.createRequest(pathname === "/generate-image" ? "/generate/image" : pathname, method, body);
    if (pathname === "/generate-image") descriptor.url = "/api/generate-image";
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
    byId("classroom-window").textContent = previewMode
      ? "本機展示模式：這裡的課堂碼與生成結果只用於看版面，不會送到正式服務。"
      : `開放 ${formatDateTime(session.classroom.opensAt)}，關閉 ${formatDateTime(session.classroom.closesAt)}。工作階段至 ${formatDateTime(session.expiresAt)}。`;
    updateQuotaDisplay(session.remaining, session.classroomRemaining);
    updateSubmitAvailability();
  }

  const promptTemplateInstructions = {
    picturebook: "請生成一張無字繪本插圖，讓畫面先說清楚一個動作與情緒。",
    spec: "請把以下需求整理成可交給生圖工具執行的繪圖工作規格單。",
    character: "請依參考資料保持同一角色的臉型、髮型、膚色、比例、服裝與配件，製作角色三視圖。",
    series: "請記住以下固定設定，後續每一頁沿用同一角色、場景、畫風、色盤與比例。",
    style: "請把媒材、線條、材質、人物比例、背景、色盤、光影與避免事項寫成完整畫風提示詞。",
    review: "你是獨立驗收員，請依工單、參考資料與驗收標準逐項輸出 PASS 或 FAIL，不替作品找理由。",
    poster: "請設計一張資訊清楚、適合遠距閱讀的班級或活動海報主視覺，預留標題與日期區域，不直接生成文字。",
    cover: "請設計課程封面主視覺，建立明確主體、視覺焦點與品牌色彩，保留後製標題的乾淨留白。",
    social: "請設計適合社群貼文的直式配圖，三秒內看懂主題，主體醒目並保留安全邊界。",
    infographic: "請把教學概念轉成分區清楚的資訊圖表插畫，以圖像表達關係，文字交由後製加入。",
    worksheet: "請設計適合學習單的黑白或低彩度輔助插圖，輪廓清楚、留白充足，不放文字。",
    scene: "請先建立一個能傳達時間、地點、天氣與情緒的場景，讓角色動作自然且背景不搶主體。"
  };

  function readImagePromptFields() {
    return {
      purpose: byId("image-purpose").value || "待選擇生成用途",
      scene: byId("image-scene").value || "待選擇場景與動作",
      style: byId("image-style").value || "待選擇視覺風格",
      composition: byId("image-composition").value || "待選擇畫面構圖",
      safeArea: byId("image-safe-area").value || "待選擇文字安全區",
      avoid: byId("image-avoid").value || "待選擇排除內容"
    };
  }

  function refreshPromptPreview() {
    const fields = readImagePromptFields();
    const instruction = promptTemplateInstructions[byId("prompt-template").value] || promptTemplateInstructions.picturebook;
    byId("prompt-preview").value = `${instruction}\n\n生成用途：${fields.purpose}\n內容與動作：${fields.scene}\n畫風與材質：${fields.style}\n構圖與鏡位：${fields.composition}\n文字安全區：${fields.safeArea}\n避免事項：${fields.avoid}\n\n驗收：圖中不要有文字或浮水印；角色、服飾、文化元素與語言內容需由教師或具備權限的人員確認。`;
  }

  function applyPromptTemplate() {
    const template = byId("prompt-template").value;
    const defaults = {
      purpose: byId("image-purpose").value || "繪本單頁插圖",
      scene: "雨後的公園，小晴看見長椅旁的紅雨傘，停下腳步仔細觀察。",
      style: byId("prompt-style").value,
      composition: "角色在左側，右側保留乾淨留白",
      safeArea: "右上保留約三分之一乾淨天空，不放人物與重要物件",
      avoid: "不要文字、浮水印、額外手指、錯誤服飾或未確認的文化圖紋。"
    };
    if (template === "character") defaults.scene = "角色站立於乾淨背景，依序呈現正面、側面與背面三個角度。";
    if (template === "series") defaults.scene = "同一角色在課堂場景中翻閱繪本，畫面保留固定道具與背景地標。";
    if (template === "poster") defaults.scene = "校園入口的活動宣傳場景，學生與老師一起布置主視覺，畫面上方與右側保留海報標題留白。";
    if (template === "cover") defaults.scene = "課程主題的象徵性場景，單一視覺焦點置中，四周保留封面標題與單位識別的留白。";
    if (template === "social") defaults.scene = "活動現場的高情緒瞬間，主體靠近畫面中央，適合手機直式瀏覽。";
    if (template === "infographic") defaults.scene = "以三個視覺區塊呈現教學流程，箭頭與圖示位置清楚，右側保留說明留白。";
    if (template === "worksheet") defaults.scene = "幾個可供學生觀察與塗色的簡單物件，輪廓清楚，背景乾淨。";
    if (template === "review") defaults.avoid = "若角色、腳本、構圖、畫風、文字或文化元素任一硬條件失敗，標記 FAIL 並交回真人。";
    const optionValues = {
      "image-purpose": ["繪本單頁插圖", "班級海報", "活動宣傳海報", "課程封面", "社群貼文配圖"],
      "image-scene": ["雨後的公園，小晴看見長椅旁的紅雨傘，停下腳步仔細觀察。", "清晨部落廣場，孩子們圍著長者安靜聽故事。", "河邊午後，孩子蹲下來觀察水面與周圍的植物。", "教室裡，學生一起翻閱繪本並討論畫面中的角色。"],
      "image-style": ["溫暖手繪水彩繪本，柔和自然光，紙張肌理", "明亮扁平插畫，清楚色塊，兒童繪本風", "柔和蠟筆質感，簡潔線條，溫暖色調", "可愛卡通插畫，圓潤造型，明亮色彩", "北歐童書幾何插畫，簡潔構成，低飽和色彩", "粉彩鉛筆童書風，細緻筆觸，柔和留白", "分層紙雕插畫，立體陰影，清楚前後景", "剪紙動畫風，民間故事感，鮮明色塊", "刺繡線稿插畫，布料紋理，手作質感", "歐洲清線冒險漫畫，動態姿勢，明確輪廓", "知識型簡報插畫，扁平圖示，資訊分區清楚", "兒童科普圖鑑風，觀察視角，細節清楚", "低解析像素插畫，復古遊戲感，方格色塊", "螢光壓克力塗鴉，強烈筆觸，高對比色彩"],
      "image-composition": ["角色置中，中景構圖，視線朝向畫面中央", "角色在左側，右側保留乾淨留白", "角色在右側，左側保留乾淨留白", "遠景環境優先，角色位於畫面下方", "俯視構圖，場景物件排列清楚"],
      "image-safe-area": ["右上保留約三分之一乾淨天空，不放人物與重要物件", "左上保留乾淨留白，方便放置標題", "下方保留乾淨留白，方便放置說明文字", "不特別保留文字區，完整呈現整個畫面"],
      "image-avoid": ["不要文字、浮水印、額外手指、錯誤服飾或未確認的文化圖紋。", "不要出現現代品牌、Logo、武器或血腥元素。", "不要加入未提供的族群符號、儀式或服飾細節。", "不要多餘角色、變形肢體或錯誤視線。"]
    };
    const desired = { "image-purpose": defaults.purpose, "image-scene": defaults.scene, "image-style": defaults.style, "image-composition": defaults.composition, "image-safe-area": defaults.safeArea, "image-avoid": defaults.avoid };
    for (const [id, value] of Object.entries(desired)) {
      const field = byId(id);
      if (optionValues[id].includes(value)) field.value = value;
      else field.selectedIndex = 1;
    }
    refreshPromptPreview();
    byId("prompt-helper-message").textContent = "模板已套用到圖片欄位，仍可逐項調整。";
  }

  byId("apply-prompt-template").addEventListener("click", applyPromptTemplate);
  byId("prompt-review-button").addEventListener("click", async () => {
    const input = byId("prompt-review-input");
    const text = input.value.trim() || byId("prompt-preview").value.trim();
    const result = byId("prompt-review-result");
    const button = byId("review-prompt-button");
    if (text.length < 3) { result.textContent = "請先輸入至少 3 個字的提示詞。"; return; }
    button.disabled = true;
    result.textContent = "AI 正在檢視提示詞，請稍候…";
    try {
      const payload = await callService("/generate/text", "POST", {
        topic: "圖片提示詞檢視",
        audience: "授課教師",
        duration_minutes: 5,
        objective: "找出提示詞缺漏並提供具體可直接修改的建議",
        source_notes: text,
        requirements: "請用繁體中文，以條列方式指出優點、缺漏與改寫示例；不要捏造文化事實。"
      }, 120000);
      result.textContent = payload.content || "AI 沒有回傳建議。";
    } catch (error) {
      result.textContent = core.friendlyError(error);
    } finally {
      button.disabled = false;
    }
  });
  byId("prompt-template").addEventListener("change", refreshPromptPreview);
  byId("prompt-style").addEventListener("change", refreshPromptPreview);
  ["image-purpose", "image-scene", "image-style", "image-composition", "image-safe-area", "image-avoid"].forEach((id) => {
    byId(id).addEventListener("change", refreshPromptPreview);
  });
  byId("copy-prompt-preview").addEventListener("click", async () => {
    try {
      await copyText(byId("prompt-preview").value);
      byId("prompt-helper-message").textContent = "完整提示詞已複製。";
    } catch {
      byId("prompt-helper-message").textContent = "無法自動複製，請選取提示詞後手動複製。";
    }
  });
  refreshPromptPreview();

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
      : { prompt: [input.purpose, input.scene, input.style, input.composition, `文字安全區：${input.safeArea}`, `避免：${input.avoid}`].filter(Boolean).join("\n") };
  }

  async function performGeneration(kind, isRetry) {
    const form = generationForms[kind];
    if (!isRetry && !reportMeaningfulValidity(form)) return;

    if (isRetry) {
      generationStates[kind] = core.transitionGeneration(generationStates[kind], { type: "retry" });
    } else {
      const idempotencyKey = core.createIdempotencyKey(kind, makeUuid());
      const request = buildGenerationRequest(kind, idempotencyKey);
      if (kind === "image" && (!request.prompt || request.prompt.trim().length < 3)) {
        byId("image-feedback").textContent = "請先選擇用途與至少一項畫面內容（至少 3 個字即可）。";
        return;
      }
      generationStates[kind] = core.transitionGeneration(generationStates[kind], {
        type: "start",
        idempotencyKey,
        request
      });
    }
    renderGeneration(kind);

    try {
      const payload = await callService(
        kind === "image" ? "/generate-image" : "/generate/text",
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
