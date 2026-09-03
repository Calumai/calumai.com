(function startPracticeApp() {
  "use strict";

  const core = globalThis.ClassroomPracticeCore;
  if (!core) return;

  const byId = (id) => document.getElementById(id);
  const previewMode = ["127.0.0.1", "localhost"].includes(globalThis.location.hostname);
  const claimForm = byId("claim-form");
  const claimButton = byId("claim-button");
  const accessPanel = byId("access-panel");
  const workspace = byId("workspace");
  const textForm = byId("text-form");
  const bookSetupForm = byId("book-setup-form");
  const previewQuota = { text: 2, image: 10 };
  const previewImageBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  let currentSession = null;
  let previewSessionActive = false;
  let textState = core.createGenerationState("text");
  let references = [];
  let bookPages = [];
  let activePageNumber = null;

  if (globalThis.history && globalThis.location.search) {
    const cleanUrl = new URL(globalThis.location.href);
    for (const key of ["class_code", "nickname", "consent", "test_mode"]) cleanUrl.searchParams.delete(key);
    globalThis.history.replaceState(null, "", cleanUrl.pathname + (previewMode ? "?preview=1" : "") + cleanUrl.hash);
  }

  function makeUuid() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") return globalThis.crypto.randomUUID();
    const bytes = new Uint8Array(16);
    globalThis.crypto.getRandomValues(bytes);
    return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
  }

  function valuesOf(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function previewSessionPayload(nickname) {
    return {
      ok: true,
      session: { nickname: nickname || "本機學員", mode: "preview", expires_at: "2099-01-01T00:00:00Z" },
      classroom: { status: "open", opens_at: "2099-01-01T00:00:00Z", closes_at: "2099-01-01T23:59:59Z" },
      remaining: { ...previewQuota },
      classroom_remaining: { text: 80, image: 40 },
    };
  }

  function previewBookPlan() {
    const functions = [
      "封面與故事承諾", "人物與地方", "事件開始", "第一次行動", "阻礙出現",
      "角色停下思考", "重要發現", "做出選擇", "結果與改變", "收尾與讀者帶走的感受",
    ];
    return JSON.stringify({
      pages: functions.map((pageFunction, index) => ({
        page_no: index + 1,
        function: pageFunction,
        narration: `第 ${index + 1} 頁旁白草稿，請依來源修改。`,
        dialogue: "",
        visual_prompt: `呈現「${pageFunction}」的一個主要動作，延續同一角色與場景設定。`,
        layout: "single",
        safe_area: index % 2 === 0 ? "upper-right" : "upper-left",
        must_include: "只包含來源已確認的人物、場景與物件",
        pending_review: "無",
      })),
    }, null, 2);
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
    if (previewQuota.text <= 0) {
      return { ok: false, request_id: "local-preview", error: { code: "SESSION_QUOTA_EXHAUSTED", message: "本機展示文字額度已用完。", retryable: false } };
    }
    previewQuota.text -= 1;
    const content = body && String(body.topic || "").includes("10 頁繪本")
      ? previewBookPlan()
      : `# ${body && body.topic ? body.topic : "本機展示教材"}\n\n這是本機預覽模式產生的範例文字，不會送到正式服務。`;
    return {
      ok: true,
      request_id: "local-preview-text",
      kind: "text",
      content,
      usage: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
      remaining: { ...previewQuota },
      classroom_remaining: { text: 80, image: 40 },
    };
  }

  async function callJsonService(pathname, method, body, timeoutMs) {
    if (previewMode) return previewResponse(pathname, body);
    const descriptor = core.createRequest(pathname, method, body);
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(descriptor.url, { ...descriptor.options, signal: controller.signal });
      let payload = null;
      try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok || !payload || payload.ok !== true) throw core.normalizeApiError(payload, response.status);
      return payload;
    } catch (error) {
      if (error && error.code) throw error;
      if (error && error.name === "AbortError") {
        throw { code: "CLIENT_TIMEOUT", message: "等待時間已超過本頁上限。", retryable: true, requestId: "", httpStatus: 0 };
      }
      throw { code: "NETWORK_ERROR", message: "無法連上課堂服務，請檢查網路連線。", retryable: true, requestId: "", httpStatus: 0 };
    } finally {
      globalThis.clearTimeout(timer);
    }
  }

  async function callBookPageService(formData) {
    if (previewMode) {
      if (previewQuota.image <= 0) {
        throw { code: "SESSION_QUOTA_EXHAUSTED", message: "本機展示圖片額度已用完。", retryable: false, requestId: "", httpStatus: 429 };
      }
      previewQuota.image -= 1;
      return {
        ok: true,
        request_id: `local-preview-page-${formData.get("page_no")}`,
        kind: "image",
        page_no: Number(formData.get("page_no")),
        image: { mime_type: "image/png", data_base64: previewImageBase64, type: "base64", src: `data:image/png;base64,${previewImageBase64}` },
        remaining: { ...previewQuota },
        classroom_remaining: { text: 80, image: 40 },
      };
    }
    const controller = new AbortController();
    const timer = globalThis.setTimeout(() => controller.abort(), 180000);
    try {
      const response = await fetch("/api/classroom-ai/generate/book-page", {
        method: "POST",
        credentials: "include",
        headers: { Accept: "application/json" },
        body: formData,
        signal: controller.signal,
      });
      let payload = null;
      try { payload = await response.json(); } catch { payload = null; }
      if (!response.ok || !payload || payload.ok !== true) throw core.normalizeApiError(payload, response.status);
      return payload;
    } catch (error) {
      if (error && error.code) throw error;
      if (error && error.name === "AbortError") {
        throw { code: "IMAGE_API_TIMEOUT", message: "圖片生成逾時。", retryable: true, requestId: "", httpStatus: 0 };
      }
      throw { code: "NETWORK_ERROR", message: "無法連上課堂服務，請檢查網路連線。", retryable: true, requestId: "", httpStatus: 0 };
    } finally {
      globalThis.clearTimeout(timer);
    }
  }

  function reportMeaningfulValidity(form) {
    for (const field of form.querySelectorAll('input[required], textarea[required], select[required]')) {
      if (field.type === "checkbox" || field.type === "number") continue;
      field.setCustomValidity(String(field.value || "").trim() ? "" : "請填寫此欄位。");
    }
    return form.reportValidity();
  }

  document.querySelectorAll('input[required], textarea[required], select[required]').forEach((field) => {
    field.addEventListener("input", () => {
      if (field.type !== "checkbox" && String(field.value || "").trim()) field.setCustomValidity("");
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
    byId("claim-message").textContent = message || "";
  }

  function formatDateTime(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) return "未提供";
    return new Intl.DateTimeFormat("zh-TW", {
      timeZone: "Asia/Taipei", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(date);
  }

  function updateQuotaDisplay(remaining, classroomRemaining) {
    byId("personal-text-quota").textContent = Number.isFinite(remaining.text) ? remaining.text : "-";
    byId("personal-image-quota").textContent = Number.isFinite(remaining.image) ? remaining.image : "-";
    byId("class-text-quota").textContent = Number.isFinite(classroomRemaining.text) ? classroomRemaining.text : "-";
    byId("class-image-quota").textContent = Number.isFinite(classroomRemaining.image) ? classroomRemaining.image : "-";
  }

  function updateSessionFromResult(result) {
    if (!currentSession || !result) return;
    currentSession = { ...currentSession, remaining: result.remaining, classroomRemaining: result.classroomRemaining };
    updateQuotaDisplay(currentSession.remaining, currentSession.classroomRemaining);
    updateAvailability();
  }

  function updateAvailability() {
    if (!currentSession) return;
    const open = currentSession.classroom.status === "open";
    const textAvailable = open && currentSession.remaining.text > 0 && currentSession.classroomRemaining.text > 0;
    const imageAvailable = open && currentSession.remaining.image > 0 && currentSession.classroomRemaining.image > 0;
    textForm.querySelector('button[type="submit"]').disabled = textState.phase === "loading" || !textAvailable;
    byId("create-book-plan").disabled = byId("create-book-plan").dataset.busy === "true" || !textAvailable;
    for (const button of document.querySelectorAll('[data-action="generate-page"]')) {
      button.disabled = Boolean(activePageNumber) || !imageAvailable || Number(button.dataset.attempts || 0) >= 3;
    }
    byId("generate-next-page").disabled = Boolean(activePageNumber) || !imageAvailable || !bookPages.length || bookPages.every((page) => page.result || page.attempts >= 3);
  }

  function showWorkspace(session) {
    currentSession = session;
    accessPanel.hidden = true;
    workspace.hidden = false;
    byId("claim-message").textContent = "";
    byId("session-nickname").textContent = session.nickname || "學員";
    const statusChip = byId("classroom-status-chip");
    statusChip.textContent = ({ open: "練習開放中", not_open: "尚未開放", scheduled: "尚未開放", closed: "練習已關閉" })[session.classroom.status] || "課堂狀態待確認";
    statusChip.dataset.status = session.classroom.status;
    byId("classroom-window").textContent = previewMode
      ? "本機展示模式：不會把課堂碼、參考圖或生成內容送到正式服務。"
      : `開放 ${formatDateTime(session.classroom.opensAt)}，關閉 ${formatDateTime(session.classroom.closesAt)}。工作階段至 ${formatDateTime(session.expiresAt)}。`;
    updateQuotaDisplay(session.remaining, session.classroomRemaining);
    updateAvailability();
  }

  async function restoreSession() {
    setClaimBusy(true, "確認工作階段");
    try {
      const payload = await callJsonService("/session", "GET", undefined, 15000);
      showWorkspace(core.normalizeSession(payload));
    } catch (error) {
      showAccess(error.code === "SESSION_EXPIRED" ? "先前的工作階段已過期，請重新登入。" : "");
    } finally {
      setClaimBusy(false);
    }
  }

  claimForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!reportMeaningfulValidity(claimForm)) return;
    setClaimBusy(true, "正在登入");
    byId("claim-message").textContent = "正在建立短期工作階段。";
    try {
      const raw = valuesOf(claimForm);
      raw.consent = byId("consent").checked;
      const payload = await callJsonService("/session/claim", "POST", core.buildClaimPayload(raw), 20000);
      showWorkspace(core.normalizeSession(payload));
    } catch (error) {
      byId("claim-message").textContent = core.friendlyError(error);
    } finally {
      setClaimBusy(false);
    }
  });

  byId("logout-button").addEventListener("click", async () => {
    const button = byId("logout-button");
    button.disabled = true;
    try {
      await callJsonService("/session/logout", "POST", {}, 15000);
      if (previewMode) Object.assign(previewQuota, { text: 2, image: 10 });
      showAccess("工作階段已結束。若要繼續練習，請重新輸入課堂碼。");
    } catch (error) {
      byId("classroom-window").textContent = core.friendlyError(error);
    } finally {
      button.disabled = false;
    }
  });

  function selectTab(kind, focus) {
    for (const tab of document.querySelectorAll('[role="tab"]')) {
      const selected = tab.dataset.tab === kind;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focus) tab.focus();
    }
    byId("text-panel").hidden = kind !== "text";
    byId("image-panel").hidden = kind !== "image";
  }

  document.querySelectorAll('[role="tab"]').forEach((tab) => {
    tab.addEventListener("click", () => selectTab(tab.dataset.tab, false));
    tab.addEventListener("keydown", (event) => {
      const tabs = [...document.querySelectorAll('[role="tab"]')];
      const current = tabs.indexOf(tab);
      const delta = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
      if (!delta) return;
      event.preventDefault();
      selectTab(tabs[(current + delta + tabs.length) % tabs.length].dataset.tab, true);
    });
  });

  function renderTextState() {
    const phase = textState.phase;
    byId("text-status").textContent = core.statusLabel(phase);
    byId("text-status").dataset.phase = phase;
    byId("text-empty").hidden = phase !== "idle";
    byId("text-loading").hidden = phase !== "loading";
    byId("text-error").hidden = !["error", "retryable"].includes(phase);
    byId("text-success").hidden = phase !== "success";
    byId("text-retry").hidden = phase !== "retryable";
    textForm.querySelector('button[type="submit"]').textContent = phase === "loading" ? "正在生成教材" : "生成教材草稿";
    if (textState.error) {
      byId("text-error-message").textContent = core.friendlyError(textState.error);
      byId("text-error-reference").textContent = [
        `錯誤代碼 ${textState.error.code}`,
        textState.error.requestId ? `查詢編號 ${textState.error.requestId}` : "",
      ].filter(Boolean).join("，");
    }
    updateAvailability();
  }

  async function performTextGeneration(isRetry) {
    if (!isRetry && !reportMeaningfulValidity(textForm)) return;
    if (isRetry) textState = core.transitionGeneration(textState, { type: "retry" });
    else {
      const key = core.createIdempotencyKey("text", makeUuid());
      textState = core.transitionGeneration(textState, {
        type: "start", idempotencyKey: key, request: core.buildTextPayload(valuesOf(textForm), key),
      });
    }
    renderTextState();
    try {
      const payload = await callJsonService("/generate/text", "POST", textState.request, 120000);
      const result = core.normalizeGenerationResult("text", payload);
      textState = core.transitionGeneration(textState, { type: "success", result });
      byId("text-output").textContent = result.content;
      byId("text-request-reference").textContent = result.requestId ? `查詢編號 ${result.requestId}` : "";
      updateSessionFromResult(result);
    } catch (error) {
      textState = core.transitionGeneration(textState, { type: "failure", error });
    }
    renderTextState();
  }

  textForm.addEventListener("submit", (event) => { event.preventDefault(); performTextGeneration(false); });
  byId("text-retry").addEventListener("click", () => performTextGeneration(true));

  async function copyText(value) {
    if (navigator.clipboard && globalThis.isSecureContext) return navigator.clipboard.writeText(value);
    const helper = document.createElement("textarea");
    helper.value = value;
    helper.readOnly = true;
    helper.className = "clipboard-helper";
    document.body.append(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  }

  byId("copy-text").addEventListener("click", async () => {
    try { await copyText(textState.result.content); byId("text-feedback").textContent = "文字已複製到剪貼簿。"; }
    catch { byId("text-feedback").textContent = "無法自動複製，請手動選取。"; }
  });

  function clickDownload(href, filename, revoke) {
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    if (revoke) globalThis.setTimeout(() => URL.revokeObjectURL(href), 1000);
  }

  byId("download-text").addEventListener("click", () => {
    const spec = core.buildTextDownload(textState.result.content, valuesOf(textForm).topic);
    clickDownload(URL.createObjectURL(new Blob([spec.content], { type: spec.mimeType })), spec.filename, true);
  });

  function renderReferences() {
    const list = byId("book-reference-list");
    list.replaceChildren();
    const template = byId("reference-card-template");
    references.forEach((reference) => {
      const fragment = template.content.cloneNode(true);
      const card = fragment.querySelector(".reference-card");
      card.dataset.referenceId = reference.id;
      const image = card.querySelector("img");
      image.src = reference.previewUrl;
      image.alt = `${reference.file.name} 預覽`;
      const kind = card.querySelector('[data-ref-field="kind"]');
      const source = card.querySelector('[data-ref-field="source"]');
      const notes = card.querySelector('[data-ref-field="notes"]');
      kind.value = reference.kind;
      source.value = reference.source;
      notes.value = reference.notes;
      kind.addEventListener("change", () => { reference.kind = kind.value; });
      source.addEventListener("input", () => { reference.source = source.value; });
      notes.addEventListener("input", () => { reference.notes = notes.value; });
      card.querySelector('[data-action="remove-reference"]').addEventListener("click", () => {
        URL.revokeObjectURL(reference.previewUrl);
        references = references.filter((item) => item.id !== reference.id);
        renderReferences();
      });
      list.append(fragment);
    });
    byId("book-reference-message").textContent = references.length
      ? `已選 ${references.length} / 4 張。這些圖片只在你按下某一頁生成時送出，不會存進網站資料庫。`
      : "尚未選擇參考圖。可使用課程提供的角色或場景備援圖。";
  }

  byId("book-reference-input").addEventListener("change", (event) => {
    const incoming = [...event.target.files];
    const allowed = new Set(["image/png", "image/jpeg", "image/webp"]);
    let message = "";
    for (const file of incoming) {
      if (references.length >= 4) { message = "最多只能加入 4 張參考圖。"; break; }
      if (!allowed.has(file.type) || file.size < 8 || file.size > 4 * 1024 * 1024) {
        message = `${file.name} 不是可用的 PNG、JPG、WebP，或超過 4 MB。`;
        continue;
      }
      references.push({ id: makeUuid(), file, previewUrl: URL.createObjectURL(file), kind: "character", source: "", notes: "" });
    }
    event.target.value = "";
    renderReferences();
    if (message) byId("book-reference-message").textContent = message;
  });

  function toggleCultureFields() {
    const traditional = byId("culture-mode").value === "verified-traditional";
    byId("culture-fields").hidden = !traditional;
    byId("culture-scope").required = traditional;
    byId("culture-rules").required = traditional;
  }
  byId("culture-mode").addEventListener("change", toggleCultureFields);

  function toggleCustomStyle() {
    const custom = byId("book-visual-style").value === "custom";
    byId("custom-style-field").hidden = !custom;
    byId("book-custom-style").required = custom;
  }
  byId("book-visual-style").addEventListener("change", toggleCustomStyle);

  const styleLibrary = [
    ["童書", "溫暖手繪水彩童書，柔和自然光，紙張肌理", "溫暖水彩童書"],
    ["童書", "粉彩鉛筆童書，細緻筆觸，低飽和色彩", "粉彩鉛筆童書"],
    ["童書", "分層紙雕插畫，立體陰影，清楚前後景", "分層紙雕"],
    ["漫畫", "清楚線條的兒童漫畫，柔和色塊，表情易讀", "兒童漫畫清線風"],
    ["漫畫", "歐洲清線冒險漫畫，動態姿勢，輪廓明確", "歐洲清線漫畫"],
    ["漫畫", "黑白墨線漫畫，網點陰影，高可讀分鏡", "黑白墨線漫畫"],
    ["媒材", "剪紙拼貼童書，分層紙張質感，鮮明色塊", "剪紙拼貼"],
    ["媒材", "刺繡與布料質感插畫，紋樣只依核准參考圖", "刺繡布料插畫"],
    ["媒材", "兒童黏土定格動畫質感，柔和圓潤造型", "黏土定格風"],
    ["資訊", "兒童科普圖鑑風，觀察視角，細節清楚", "兒童科普圖鑑"],
    ["資訊", "扁平資訊插畫，圖示清楚，資訊分區明確", "扁平資訊插畫"],
    ["簡約", "北歐幾何童書，簡潔構成，留白清楚", "北歐幾何童書"],
  ].map(([category, prompt, description]) => ({ category, prompt, description }));

  function setupStyleLibrary() {
    const dialog = byId("style-library-dialog");
    const list = byId("style-library-list");
    const search = byId("style-library-search");
    const category = byId("style-library-category");
    const opener = byId("open-style-library");
    if (!dialog || !list || !search || !category || !opener) return;
    [...new Set(styleLibrary.map((item) => item.category))].forEach((value) => category.add(new Option(value, value)));
    function render() {
      const query = search.value.trim().toLowerCase();
      list.replaceChildren();
      styleLibrary.filter((item) => (category.value === "all" || item.category === category.value) && (!query || `${item.category} ${item.description} ${item.prompt}`.toLowerCase().includes(query))).forEach((item) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "style-library-item";
        const strong = document.createElement("strong");
        strong.textContent = item.description;
        const small = document.createElement("small");
        small.textContent = `${item.category}｜${item.prompt}`;
        button.append(strong, small);
        button.addEventListener("click", () => {
          const select = byId("book-visual-style");
          let option = [...select.options].find((entry) => entry.value === item.prompt);
          if (!option) { option = new Option(item.description, item.prompt); select.add(option); }
          select.value = item.prompt;
          toggleCustomStyle();
          dialog.close();
        });
        list.append(button);
      });
    }
    opener.addEventListener("click", () => { render(); dialog.showModal(); });
    search.addEventListener("input", render);
    category.addEventListener("change", render);
  }

  function validateReferenceMetadata() {
    if (!references.length) return "請先加入至少一張參考圖。";
    if (references.some((reference) => !reference.source.trim() || !reference.notes.trim())) {
      return "每張參考圖都要填來源／授權說明，以及只可參考哪些細節。";
    }
    if (!byId("reference-rights").checked) return "請先確認你有權把參考圖送交 AI 處理。";
    return "";
  }

  function buildPlanRequest() {
    const data = valuesOf(bookSetupForm);
    const formatGuide = ({
      "picture-book": "繪本：每頁使用單一主畫面或跨頁感構圖，layout 只用 single 或 spread。",
      comic: "漫畫：每頁使用 2～4 格，layout 只用 two-panels、three-panels 或 four-panels；visual_prompt 要依閱讀順序寫出每格動作，但整頁只推進一個主要事件。",
      mixed: "混合：依節奏選單一主畫面、跨頁感或 2～4 格漫畫；漫畫頁的 visual_prompt 要依閱讀順序寫出每格動作。",
    })[data.book_format];
    const sourceNotes = [
      "【核准故事來源】", data.story_source,
      "【不可改寫】", data.locked_facts,
      "【參考圖說】", references.map((reference, index) => `${index + 1}. ${reference.kind}｜${reference.source}｜${reference.notes}`).join("\n"),
    ].join("\n").slice(0, 8000);
    const requirements = [
      `讀者：${data.book_audience}。閱讀目標：${data.learning_goal}。${formatGuide}`,
      "只回傳合法 JSON，不要 Markdown code fence，也不要任何 JSON 之外的文字。",
      "格式為 {\"pages\":[10個物件]}。每個物件必須有 page_no(1-10)、function、narration、dialogue、visual_prompt、layout、safe_area、must_include、pending_review。",
      "layout 只能是 single、two-panels、three-panels、four-panels、spread；safe_area 只能是 upper-right、upper-left、bottom、none。",
      "每頁一個主要事件；旁白適合兒童閱讀；對白可空字串。視覺內容只用來源支持的事實，未確認內容寫入 pending_review，不要自行補文化細節。",
      "第1頁建立故事承諾或封面感，第2-3頁設定與觸發，第4-7頁發展與轉折，第8頁高潮，第9頁結果，第10頁收尾。",
    ].join("\n");
    const key = core.createIdempotencyKey("text", makeUuid());
    return core.buildTextPayload({
      topic: `10 頁繪本分鏡｜${data.book_title}`,
      audience: data.book_audience,
      duration_minutes: 40,
      objective: data.learning_goal,
      source_notes: sourceNotes,
      requirements,
    }, key);
  }

  function extractJson(content) {
    const raw = String(content || "").trim();
    const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/iu);
    return JSON.parse(fenced ? fenced[1].trim() : raw);
  }

  function normalizeBookPlan(content) {
    const parsed = extractJson(content);
    const rawPages = Array.isArray(parsed) ? parsed : parsed && parsed.pages;
    if (!Array.isArray(rawPages) || rawPages.length !== 10) throw new Error("AI 沒有回傳完整 10 頁分鏡。");
    const allowedLayouts = new Set(["single", "two-panels", "three-panels", "four-panels", "spread"]);
    const allowedSafeAreas = new Set(["upper-right", "upper-left", "bottom", "none"]);
    const bookFormat = byId("book-format").value;
    return rawPages.map((page, index) => {
      let layout = allowedLayouts.has(page.layout) ? page.layout : (bookFormat === "comic" ? "two-panels" : "single");
      if (bookFormat === "comic" && ["single", "spread"].includes(layout)) layout = "two-panels";
      if (bookFormat === "picture-book" && ["two-panels", "three-panels", "four-panels"].includes(layout)) layout = "single";
      return {
        pageNo: index + 1,
        function: String(page.function || `第 ${index + 1} 頁`).slice(0, 120),
        narration: String(page.narration || "").slice(0, 500),
        dialogue: String(page.dialogue || "").slice(0, 300),
        visualPrompt: String(page.visual_prompt || "").slice(0, 1800),
        layout,
        safeArea: allowedSafeAreas.has(page.safe_area) ? page.safe_area : (index % 2 ? "upper-left" : "upper-right"),
        mustInclude: String(page.must_include || "").slice(0, 500),
        pendingReview: String(page.pending_review || "無").slice(0, 500),
        attempts: 0,
        result: null,
        error: null,
        retryable: false,
        idempotencyKey: "",
      };
    });
  }

  bookSetupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = byId("book-plan-message");
    if (!reportMeaningfulValidity(bookSetupForm)) return;
    const referenceError = validateReferenceMetadata();
    if (referenceError) { message.textContent = referenceError; return; }
    const button = byId("create-book-plan");
    button.dataset.busy = "true";
    button.textContent = "AI 正在拆成 10 頁";
    message.textContent = "先整理故事節拍，再分配到每一頁；這一步不會生成圖片。";
    updateAvailability();
    try {
      const payload = await callJsonService("/generate/text", "POST", buildPlanRequest(), 120000);
      const result = core.normalizeGenerationResult("text", payload);
      bookPages = normalizeBookPlan(result.content);
      renderBookPages();
      byId("book-plan-workspace").hidden = false;
      byId("book-plan-workspace").scrollIntoView({ behavior: "smooth", block: "start" });
      message.textContent = "10 頁分鏡已建立。請逐頁確認文字、動作與待審內容，再開始生圖。";
      updateSessionFromResult(result);
    } catch (error) {
      message.textContent = error instanceof SyntaxError || !error.code
        ? "AI 回傳的分鏡格式不完整，沒有送出任何圖片；請保留來源後再試一次。"
        : core.friendlyError(error);
    } finally {
      button.dataset.busy = "false";
      button.textContent = "重新建立 10 頁分鏡";
      updateAvailability();
    }
  });

  function pageField(card, name) {
    return card.querySelector(`[data-page-field="${name}"]`);
  }

  function renderBookPages() {
    const list = byId("book-page-list");
    list.replaceChildren();
    const template = byId("book-page-template");
    bookPages.forEach((page) => {
      const fragment = template.content.cloneNode(true);
      const card = fragment.querySelector(".story-page-card");
      card.dataset.pageNo = page.pageNo;
      card.querySelector(".page-number").textContent = `PAGE ${String(page.pageNo).padStart(2, "0")}`;
      card.querySelector(".page-function").textContent = page.function;
      const mappings = {
        function: "function", narration: "narration", dialogue: "dialogue", visual_prompt: "visualPrompt",
        layout: "layout", safe_area: "safeArea", must_include: "mustInclude", pending_review: "pendingReview",
      };
      for (const [fieldName, property] of Object.entries(mappings)) {
        const field = pageField(card, fieldName);
        field.value = page[property];
        field.addEventListener("input", () => {
          page[property] = field.value;
          if (fieldName === "function") card.querySelector(".page-function").textContent = field.value || `第 ${page.pageNo} 頁`;
          if (page.error && !page.result) { page.idempotencyKey = ""; page.retryable = false; }
        });
      }
      card.querySelector('[data-action="generate-page"]').addEventListener("click", () => generatePage(page.pageNo));
      card.querySelector('[data-action="download-page"]').addEventListener("click", () => downloadPage(page.pageNo));
      list.append(fragment);
      renderPageState(page);
    });
    updateBookProgress();
    updateAvailability();
  }

  function renderPageState(page) {
    const card = byId("book-page-list").querySelector(`[data-page-no="${page.pageNo}"]`);
    if (!card) return;
    const status = card.querySelector(".page-status");
    const message = card.querySelector(".page-message");
    const generate = card.querySelector('[data-action="generate-page"]');
    const download = card.querySelector('[data-action="download-page"]');
    const image = card.querySelector(".page-preview img");
    const empty = card.querySelector(".page-preview-empty");
    generate.dataset.attempts = page.attempts;
    if (activePageNumber === page.pageNo) {
      status.textContent = "生成中";
      status.dataset.state = "loading";
      generate.textContent = "AI 正在生成本頁";
      message.textContent = "正在把同一組參考圖與本頁工單送交 AI，請勿重複按下。";
    } else if (page.result) {
      status.textContent = "已有候選圖";
      status.dataset.state = "success";
      generate.textContent = page.attempts >= 3 ? "已達 3 次上限" : "重新生成本頁";
      message.textContent = "請與前後頁並排檢查角色、服飾、圖紋、場景與畫風；AI 候選圖不代表已通過文化審訂。";
      image.src = page.result.src;
      image.alt = `${byId("book-title").value || "繪本"}第 ${page.pageNo} 頁候選圖`;
      image.hidden = false;
      empty.hidden = true;
      download.hidden = false;
    } else if (page.error) {
      status.textContent = page.retryable ? "失敗，可重試" : "需要修改";
      status.dataset.state = "error";
      generate.textContent = page.retryable ? "重試本頁" : "修改後再生成";
      message.textContent = `${core.friendlyError(page.error)}${page.error.requestId ? `（查詢編號 ${page.error.requestId}）` : ""}`;
    } else {
      status.textContent = "尚未生成";
      status.dataset.state = "idle";
      generate.textContent = "生成本頁無字候選圖";
      message.textContent = `第 ${page.pageNo} 頁尚未使用圖片額度。`;
    }
  }

  function selectedVisualStyle() {
    return byId("book-visual-style").value === "custom" ? byId("book-custom-style").value.trim() : byId("book-visual-style").value;
  }

  function buildPagePrompt(page) {
    const data = valuesOf(bookSetupForm);
    const layoutLabels = { single: "單一主畫面", "two-panels": "2 格漫畫", "three-panels": "3 格漫畫", "four-panels": "4 格漫畫", spread: "跨頁感構圖" };
    const safeLabels = { "upper-right": "右上保留文字安全區", "upper-left": "左上保留文字安全區", bottom: "下方保留文字安全區", none: "不指定文字留白" };
    return [
      `整本固定畫風：${selectedVisualStyle()}。固定色盤與光線：${data.palette}。`,
      `角色不可變特徵：${data.character_locks}。`,
      `本頁功能：${page.function}。`,
      `畫面與動作：${page.visualPrompt}。`,
      `版面：${layoutLabels[page.layout] || layoutLabels.single}；${safeLabels[page.safeArea] || safeLabels.none}。`,
      ["two-panels", "three-panels", "four-panels"].includes(page.layout)
        ? "這是漫畫頁：分格邊界與閱讀順序要清楚，每格只呈現一個動作節點，整頁仍只推進同一個主要事件。"
        : "這是繪本頁：以一個清楚主畫面呈現本頁主要事件。",
      page.mustInclude ? `必須看得到：${page.mustInclude}。` : "",
      `旁白與對白只供排版理解，不可畫成文字：${page.narration}${page.dialogue ? `／${page.dialogue}` : ""}。`,
      `不可改寫：${data.locked_facts}。`,
      page.pendingReview && page.pendingReview !== "無" ? `待真人確認、不可由 AI 補寫：${page.pendingReview}。` : "",
      "只產生無字候選圖；不要文字、字母、數字、標誌、簽名、浮水印或頁碼。",
    ].filter(Boolean).join("\n").slice(0, 4000);
  }

  function referenceMetadata() {
    return references.map((reference, index) => ({ order: index + 1, kind: reference.kind, source: reference.source.trim(), allowed_details: reference.notes.trim() }));
  }

  function buildBookPageForm(page) {
    const data = valuesOf(bookSetupForm);
    const form = new FormData();
    form.append("idempotency_key", page.idempotencyKey);
    form.append("page_no", String(page.pageNo));
    form.append("book_title", data.book_title);
    form.append("book_format", data.book_format);
    form.append("prompt", buildPagePrompt(page));
    form.append("culture_mode", data.culture_mode);
    form.append("culture_scope", byId("culture-scope").value.trim());
    form.append("culture_rules", byId("culture-rules").value.trim());
    form.append("culture_reviewed", byId("culture-mode").value === "general" || byId("culture-reviewed").checked ? "true" : "false");
    form.append("reference_notes", references.map((reference) => reference.notes.trim()).join("；").slice(0, 1600));
    form.append("reference_metadata", JSON.stringify(referenceMetadata()));
    form.append("rights_confirmed", byId("reference-rights").checked ? "true" : "false");
    references.forEach((reference) => form.append("reference_images", reference.file, reference.file.name));
    return form;
  }

  async function generatePage(pageNo) {
    const page = bookPages.find((item) => item.pageNo === pageNo);
    if (!page || activePageNumber) return;
    const message = byId("book-generation-message");
    const referenceError = validateReferenceMetadata();
    if (referenceError) { message.textContent = referenceError; return; }
    if (byId("culture-mode").value === "verified-traditional" && !byId("culture-reviewed").checked) {
      message.textContent = "這份分鏡可以繼續修改，但傳統服飾／圖紋尚未勾選真人審訂，所以不會送出圖片生成。";
      byId("culture-reviewed").focus();
      return;
    }
    if (!page.visualPrompt.trim() || page.visualPrompt.trim().length < 3) {
      message.textContent = `第 ${page.pageNo} 頁的「畫面與動作」至少要有 3 個字。`;
      return;
    }
    const sameRetry = page.error && page.retryable && page.idempotencyKey;
    if (!sameRetry) {
      if (page.attempts >= 3) { message.textContent = `第 ${page.pageNo} 頁已達 3 次嘗試上限，請改用現有圖或交由人工處理。`; return; }
      page.idempotencyKey = core.createIdempotencyKey("image", makeUuid());
      page.attempts += 1;
    }
    activePageNumber = page.pageNo;
    page.error = null;
    page.retryable = false;
    renderPageState(page);
    updateAvailability();
    message.textContent = `正在生成第 ${page.pageNo} 頁；完成前不能同時送出其他頁。`;
    try {
      const payload = await callBookPageService(buildBookPageForm(page));
      const normalized = core.normalizeGenerationResult("image", payload);
      page.result = { ...normalized, src: normalized.dataBase64 ? `data:${normalized.mimeType};base64,${normalized.dataBase64}` : normalized.src };
      page.error = null;
      page.idempotencyKey = "";
      updateSessionFromResult(normalized);
      message.textContent = `第 ${page.pageNo} 頁已完成候選圖。請先檢查再做下一頁。`;
    } catch (error) {
      page.error = error;
      page.retryable = error.retryable === true;
      if (!page.retryable) page.idempotencyKey = "";
      message.textContent = core.friendlyError(error);
    } finally {
      activePageNumber = null;
      renderPageState(page);
      updateBookProgress();
      updateAvailability();
    }
  }

  function updateBookProgress() {
    const completed = bookPages.filter((page) => page.result).length;
    byId("book-progress-label").textContent = `${completed} / 10 頁已有圖片`;
    byId("book-progress-bar").value = completed;
    byId("print-book").disabled = completed !== 10;
  }

  byId("generate-next-page").addEventListener("click", () => {
    const next = bookPages.find((page) => !page.result && page.attempts < 3);
    if (next) generatePage(next.pageNo);
  });

  function downloadPage(pageNo) {
    const page = bookPages.find((item) => item.pageNo === pageNo);
    if (!page || !page.result) return;
    const spec = core.buildImageDownload(page.result, `${byId("book-title").value}-page-${String(pageNo).padStart(2, "0")}`);
    clickDownload(spec.dataUrl, spec.filename, false);
  }

  byId("download-book-plan").addEventListener("click", () => {
    const data = valuesOf(bookSetupForm);
    const metadata = referenceMetadata();
    const exportData = {
      title: data.book_title,
      audience: data.book_audience,
      format: data.book_format,
      learning_goal: data.learning_goal,
      cultural_scope: data.culture_mode === "verified-traditional" ? byId("culture-scope").value.trim() : "not_applicable",
      reference_files: references.map((reference, index) => ({ name: reference.file.name, ...metadata[index] })),
      pages: bookPages.map((page) => ({
        page_no: page.pageNo, function: page.function, narration: page.narration, dialogue: page.dialogue,
        visual_prompt: page.visualPrompt, layout: page.layout, safe_area: page.safeArea,
        must_include: page.mustInclude, pending_review: page.pendingReview,
        image_status: page.result ? "candidate_generated" : "not_generated",
        request_id: page.result ? page.result.requestId : null,
      })),
      notice: "圖片為候選稿；文化、語言、權利與公開狀態仍需真人確認。",
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json;charset=utf-8" });
    clickDownload(URL.createObjectURL(blob), `${core.safeFilename(data.book_title, "ten-page-book")}-storyboard.json`, true);
  });

  function renderPrintBook() {
    const container = byId("book-print-area");
    container.replaceChildren();
    const title = byId("book-title").value.trim();
    bookPages.forEach((page) => {
      const sheet = document.createElement("article");
      sheet.className = "print-book-page";
      const heading = document.createElement("header");
      const pageLabel = document.createElement("span");
      pageLabel.textContent = page.pageNo === 1 ? title : `${page.pageNo} / 10`;
      heading.append(pageLabel);
      const image = document.createElement("img");
      image.src = page.result.src;
      image.alt = "";
      const copy = document.createElement("div");
      copy.className = "print-page-copy";
      const narration = document.createElement("p");
      narration.textContent = page.narration;
      copy.append(narration);
      if (page.dialogue) {
        const dialogue = document.createElement("p");
        dialogue.className = "print-dialogue";
        dialogue.textContent = page.dialogue;
        copy.append(dialogue);
      }
      const note = document.createElement("small");
      note.textContent = "課堂候選稿｜文化、語言、權利與公開狀態需真人確認";
      sheet.append(heading, image, copy, note);
      container.append(sheet);
    });
  }

  byId("print-book").addEventListener("click", () => {
    if (bookPages.filter((page) => page.result).length !== 10) return;
    renderPrintBook();
    byId("book-print-area").setAttribute("aria-hidden", "false");
    globalThis.print();
    byId("book-print-area").setAttribute("aria-hidden", "true");
  });

  renderReferences();
  toggleCultureFields();
  toggleCustomStyle();
  setupStyleLibrary();
  renderTextState();
  restoreSession();
})();
