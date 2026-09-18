(function startVibeLab(){
  "use strict";

  const shared = globalThis.ClassroomPracticeCore;
  const $ = (id) => document.getElementById(id);
  if (!shared) return;

  const STORAGE_KEY = "calumai-vibe-lab-v1";
  const previewMode = ["127.0.0.1", "localhost"].includes(location.hostname) || location.protocol === "file:";
  const allowedImageTypes = new Set(["image/png", "image/jpeg", "image/webp"]);
  const maxImageBytes = 1024 * 1024;
  const assets = [];

  let session = null;
  let sessionChecking = !previewMode;
  let busy = false;
  let previousHtml = "";
  let previewUrl = "";

  function uuid() {
    if (globalThis.crypto && typeof globalThis.crypto.randomUUID === "function") {
      return globalThis.crypto.randomUUID();
    }
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
      const value = Math.random() * 16 | 0;
      const next = char === "x" ? value : (value & 3 | 8);
      return next.toString(16);
    });
  }

  function eligible() {
    return session
      && session.classroom.status === "open"
      && Date.parse(session.expiresAt) > Date.now();
  }

  function escapeAttribute(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function humanBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    return (bytes / 1024).toFixed(bytes < 1024 * 100 ? 1 : 0) + " KB";
  }

  function updatePromptCount() {
    $("prompt-count").textContent = $("prompt-input").value.length + " / 4000";
  }

  function setStatus(message) {
    $("ai-status").textContent = message || "";
  }

  function renderSession() {
    $("join-button").hidden = previewMode || Boolean(eligible());
    $("logout-button").hidden = previewMode || !session;
    $("session-status").textContent = previewMode
      ? "本機示範"
      : sessionChecking
        ? "正在確認課堂…"
        : eligible()
          ? (session.nickname || "老師") + "・課堂已加入"
          : session
            ? "課堂目前未開放"
            : "尚未加入課堂";
    updateControls();
  }

  function updateControls() {
    const hasCode = Boolean($("code-editor").value.trim());
    $("generate-button").disabled = busy || sessionChecking;
    $("improve-button").disabled = busy || sessionChecking || !hasCode;
    $("preview-button").disabled = !hasCode;
    $("download-button").disabled = !hasCode;
    $("undo-button").disabled = !previousHtml || busy;
    $("prompt-input").disabled = busy;
    $("code-editor").disabled = busy;
    $("generate-button").textContent = busy ? "AI 製作中…" : "請 AI 製作";
    $("improve-button").textContent = busy ? "處理中…" : "修改目前版本";
  }

  function loadDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft && typeof draft.prompt === "string") $("prompt-input").value = draft.prompt.slice(0, 4000);
      if (draft && typeof draft.html === "string") $("code-editor").value = draft.html;
      if (draft && typeof draft.previousHtml === "string") previousHtml = draft.previousHtml;
      $("save-state").textContent = "已載入這台裝置上的草稿。";
    } catch {
      $("save-state").textContent = "無法讀取舊草稿，但仍可繼續使用。";
    }
    updatePromptCount();
    updateControls();
  }

  let saveTimer = 0;
  function scheduleSave() {
    clearTimeout(saveTimer);
    $("save-state").textContent = "正在準備儲存…";
    saveTimer = setTimeout(saveDraft, 350);
  }

  function saveDraft() {
    const draft = {
      prompt: $("prompt-input").value,
      html: $("code-editor").value,
      previousHtml,
      updatedAt: new Date().toISOString()
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      $("save-state").textContent = "草稿已儲存在這個瀏覽器。";
    } catch {
      $("save-state").textContent = "草稿太大，無法自動儲存；請先下載 HTML 保留。";
    }
  }

  async function call(path, method = "GET", body, timeout = 90000) {
    const request = shared.createRequest(path, method, body);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const response = await fetch(request.url, {
        ...request.options,
        signal: controller.signal,
        redirect: "error"
      });
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw { code: "RESPONSE_UNCERTAIN", retryable: true };
      }
      if (!response.ok || payload?.ok !== true) throw shared.normalizeApiError(payload, response.status);
      return payload;
    } catch (error) {
      if (error?.code) throw error;
      throw {
        code: error?.name === "AbortError" ? "CLIENT_TIMEOUT" : "NETWORK_ERROR",
        retryable: true
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function restoreSession() {
    if (previewMode) {
      $("demo-banner").hidden = false;
      renderSession();
      return;
    }
    try {
      session = shared.normalizeSession(await call("/session", "GET", undefined, 15000));
    } catch {
      session = null;
    } finally {
      sessionChecking = false;
      renderSession();
    }
  }

  function friendlyError(error) {
    if (error?.code === "CLIENT_TIMEOUT") return "AI 回覆逾時。你的需求與程式碼都還在，可以再試一次。";
    if (error?.code === "NETWORK_ERROR") return "目前無法連線到課堂 AI。你的草稿沒有遺失。";
    if (error?.code === "RESPONSE_UNCERTAIN") return "AI 回覆沒有完整收到。你的原本版本仍保留，請再試一次。";
    if (error?.code) return shared.friendlyError(error);
    return "這次沒有完成，原本程式碼仍保留。請稍後再試。";
  }

  function extractHtml(content) {
    if (typeof content !== "string") throw new Error("AI 沒有回傳可用的 HTML。");
    let html = content.trim();
    const fenced = html.match(/^```(?:html)?\s*([\s\S]*?)\s*```$/i);
    if (fenced) html = fenced[1].trim();

    const doctypeIndex = html.search(/<!doctype\s+html/i);
    const htmlIndex = html.search(/<html[\s>]/i);
    const start = doctypeIndex >= 0 ? doctypeIndex : htmlIndex;
    if (start > 0) html = html.slice(start);

    const closeIndex = html.toLowerCase().lastIndexOf("</html>");
    if (closeIndex >= 0) html = html.slice(0, closeIndex + 7);

    if (!/<html[\s>]/i.test(html) || !/<body[\s>]/i.test(html)) {
      throw new Error("AI 回覆不是完整單一 HTML。原本版本沒有被覆蓋。");
    }
    return html;
  }

  function sampleHtml(prompt) {
    const title = escapeAttribute(prompt.slice(0, 42) || "我的互動教材");
    return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  <style>
    *{box-sizing:border-box}body{margin:0;font-family:system-ui;background:#f4f7f3;color:#183128}
    main{max-width:720px;margin:auto;padding:48px 20px}.card{background:white;border-radius:24px;padding:28px;box-shadow:0 18px 45px #173e2c18}
    button{border:0;border-radius:12px;padding:12px 18px;background:#176b62;color:white;font-weight:800}
    #result{margin-top:18px;font-weight:800}
  </style>
</head>
<body>
  <main><div class="card"><p>CALUMAI Vibe Coding 示範</p><h1>${title}</h1>
  <p>這是本機示範版。正式課堂會由 AI 依你的需求產生完整作品。</p>
  <button id="try">按我試試</button><p id="result"></p></div></main>
  <script>
    document.querySelector("#try").addEventListener("click",()=>{document.querySelector("#result").textContent="互動成功！";});
  <\/script>
</body>
</html>`;
  }

  function buildAiRequest(mode) {
    const prompt = $("prompt-input").value.trim();
    if (prompt.length < 3) throw new Error("請先寫至少 3 個字，告訴 AI 想做什麼。");

    const current = $("code-editor").value.trim();
    const modifying = mode === "modify" && current;
    const source = modifying
      ? "老師的修改需求：\n" + prompt + "\n\n目前版本 HTML：\n" + current.slice(0, 12000)
      : "老師的製作需求：\n" + prompt;

    const requirements = [
      "請只輸出一份可以直接存成 .html 後在瀏覽器開啟的完整單一 HTML，不要 Markdown、不要說明文字。",
      "CSS 與 JavaScript 都放在同一份 HTML 內，不依賴建置工具。",
      "優先支援手機與桌面、鍵盤操作與清楚的按鈕狀態。",
      "不要自行發明族語、翻譯、文化知識、題目答案或來源；老師沒有提供的內容請使用中文［請填入］占位。",
      "不要加入 API 金鑰、登入憑證、追蹤碼、外部分析服務或會把使用者資料送出的程式。",
      modifying
        ? "請保留目前版本已經能用的功能，只修改老師這次要求的部分；完成後仍回傳完整 HTML。"
        : "先做出可操作的第一版，不要只回傳架構或片段。"
    ].join("\n");

    return shared.buildTextPayload({
      topic: "Vibe Coding 實驗室｜" + (modifying ? "修改作品" : "建立作品"),
      audience: "族語老師與教學工作者",
      duration_minutes: 10,
      objective: modifying ? "依老師需求修改既有單一 HTML 教學作品" : "依老師需求建立可直接試玩的單一 HTML 教學作品",
      source_notes: source,
      requirements
    }, shared.createIdempotencyKey("text", uuid()));
  }

  async function generate(mode) {
    if (busy) return;
    const prompt = $("prompt-input").value.trim();
    if (prompt.length < 3) {
      setStatus("請先寫至少 3 個字，告訴 AI 想做什麼。");
      $("prompt-input").focus();
      return;
    }
    if (!previewMode && !eligible()) {
      $("access-dialog").showModal();
      return;
    }

    busy = true;
    updateControls();
    setStatus(previewMode ? "正在建立本機示範…" : mode === "modify" ? "AI 正在修改目前版本，原版會先保留。" : "AI 正在製作第一版…");

    try {
      let nextHtml;
      if (previewMode) {
        nextHtml = sampleHtml(prompt);
      } else {
        const request = buildAiRequest(mode);
        const payload = await call("/generate/text", "POST", request);
        const generated = shared.normalizeGenerationResult("text", payload);
        nextHtml = extractHtml(generated.content);
        if (session) {
          session.remaining = generated.remaining;
          session.classroomRemaining = generated.classroomRemaining;
        }
      }

      const current = $("code-editor").value;
      if (current && current !== nextHtml) previousHtml = current;
      $("code-editor").value = nextHtml;
      saveDraft();
      renderPreview();
      setStatus(previewMode ? "本機示範完成。正式網站會改用課堂 AI。" : "完成。先在右側試玩，不滿意就補充需求再按「修改目前版本」。");
    } catch (error) {
      setStatus(friendlyError(error instanceof Error ? { message: error.message } : error) || error.message);
      if (error instanceof Error) setStatus(error.message);
      if (["UNAUTHENTICATED", "SESSION_EXPIRED", "CLASSROOM_CLOSED"].includes(error?.code)) {
        session = null;
        renderSession();
      }
    } finally {
      busy = false;
      updateControls();
    }
  }

  function renderPreview() {
    const html = $("code-editor").value.trim();
    if (!html) {
      $("preview-frame").removeAttribute("src");
      $("preview-empty").hidden = false;
      return;
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      previewUrl = "";
    }
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    previewUrl = URL.createObjectURL(blob);
    $("preview-frame").src = previewUrl;
    $("preview-empty").hidden = true;
  }

  function downloadHtml() {
    const html = $("code-editor").value.trim();
    if (!html) return;
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const base = $("prompt-input").value.trim().slice(0, 24)
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-|-$/g, "") || "calumai-vibe-work";
    link.href = url;
    link.download = base + ".html";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setStatus("HTML 已準備下載。下載後直接用瀏覽器開啟即可測試。");
  }

  function readAsset(file) {
    return new Promise((resolve, reject) => {
      if (!allowedImageTypes.has(file.type)) {
        reject(new Error(file.name + " 不是支援的圖片格式。"));
        return;
      }
      if (file.size > maxImageBytes) {
        reject(new Error(file.name + " 超過 1 MB，請先縮小圖片再加入。"));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve({
        id: uuid(),
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: String(reader.result || "")
      });
      reader.onerror = () => reject(new Error(file.name + " 讀取失敗。"));
      reader.readAsDataURL(file);
    });
  }

  function renderAssets() {
    const list = $("asset-list");
    list.replaceChildren();
    if (!assets.length) {
      const empty = document.createElement("p");
      empty.className = "empty-note";
      empty.textContent = "還沒有圖片素材。";
      list.append(empty);
      return;
    }

    assets.forEach((asset) => {
      const row = document.createElement("div");
      row.className = "asset-item";

      const img = document.createElement("img");
      img.src = asset.dataUrl;
      img.alt = "";

      const info = document.createElement("div");
      const name = document.createElement("strong");
      name.textContent = asset.name;
      const meta = document.createElement("small");
      meta.textContent = humanBytes(asset.size) + "・只留在目前分頁";
      info.append(name, meta);

      const button = document.createElement("button");
      button.type = "button";
      button.textContent = "插入程式";
      button.addEventListener("click", () => insertAsset(asset));

      row.append(img, info, button);
      list.append(row);
    });
  }

  function insertAsset(asset) {
    const editor = $("code-editor");
    const tag = `<img src="${asset.dataUrl}" alt="${escapeAttribute(asset.name.replace(/\.[^.]+$/, ""))}">`;
    const start = editor.selectionStart ?? editor.value.length;
    const end = editor.selectionEnd ?? start;
    previousHtml = editor.value;
    editor.setRangeText(tag, start, end, "end");
    editor.focus();
    saveDraft();
    updateControls();
    setStatus("圖片已嵌入 HTML。這會增加檔案大小；完成後記得下載保存。");
  }

  async function addAssets(files) {
    const selected = Array.from(files || []).slice(0, 6);
    if (!selected.length) return;
    const errors = [];
    for (const file of selected) {
      try {
        assets.push(await readAsset(file));
      } catch (error) {
        errors.push(error.message);
      }
    }
    renderAssets();
    $("asset-input").value = "";
    if (errors.length) setStatus(errors.join("\n"));
    else setStatus("圖片已加入素材區。按「插入程式」即可嵌入目前 HTML。");
  }

  function undo() {
    if (!previousHtml) return;
    const current = $("code-editor").value;
    $("code-editor").value = previousHtml;
    previousHtml = current;
    saveDraft();
    renderPreview();
    updateControls();
    setStatus("已切換回上一版；再按一次可以回到剛才的版本。");
  }

  function clearAll() {
    $("prompt-input").value = "";
    $("code-editor").value = "";
    previousHtml = "";
    assets.splice(0, assets.length);
    localStorage.removeItem(STORAGE_KEY);
    renderAssets();
    renderPreview();
    updatePromptCount();
    updateControls();
    setStatus("目前作品已清空。");
    $("confirm-clear-dialog").close();
  }

  $("prompt-input").addEventListener("input", () => {
    updatePromptCount();
    scheduleSave();
  });
  $("code-editor").addEventListener("input", () => {
    scheduleSave();
    updateControls();
  });
  $("generate-button").addEventListener("click", () => void generate("create"));
  $("improve-button").addEventListener("click", () => void generate("modify"));
  $("preview-button").addEventListener("click", renderPreview);
  $("download-button").addEventListener("click", downloadHtml);
  $("undo-button").addEventListener("click", undo);
  $("asset-input").addEventListener("change", (event) => void addAssets(event.target.files));

  $("clear-button").addEventListener("click", () => $("confirm-clear-dialog").showModal());
  $("cancel-clear").addEventListener("click", () => $("confirm-clear-dialog").close());
  $("confirm-clear").addEventListener("click", clearAll);

  $("join-button").addEventListener("click", () => $("access-dialog").showModal());
  $("close-access").addEventListener("click", () => $("access-dialog").close());

  $("claim-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!$("claim-form").reportValidity()) return;
    $("claim-button").disabled = true;
    $("claim-message").textContent = "正在確認課堂…";
    try {
      const payload = shared.buildClaimPayload({
        class_code: $("class-code").value,
        nickname: $("nickname").value,
        consent: $("consent").checked
      });
      session = shared.normalizeSession(await call("/session/claim", "POST", payload, 20000));
      $("class-code").value = "";
      $("claim-message").textContent = "";
      $("access-dialog").close();
      setStatus("已加入課堂，可以開始請 AI 製作。");
      renderSession();
    } catch (error) {
      $("claim-message").textContent = friendlyError(error);
    } finally {
      $("claim-button").disabled = false;
    }
  });

  $("logout-button").addEventListener("click", async () => {
    if (busy) return;
    $("logout-button").disabled = true;
    try {
      await call("/session/logout", "POST", {}, 15000);
      session = null;
      setStatus("已離開課堂。這台裝置上的草稿仍然保留。");
      renderSession();
    } catch {
      setStatus("暫時無法確認是否離開課堂，請稍後再試。");
    } finally {
      $("logout-button").disabled = false;
    }
  });

  window.addEventListener("beforeunload", () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  });

  loadDraft();
  renderAssets();
  if ($("code-editor").value.trim()) renderPreview();
  updatePromptCount();
  updateControls();
  void restoreSession();
})();