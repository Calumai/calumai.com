(function startCalumAiStudio() {
  "use strict";

  if (window.top !== window.self) {
    document.documentElement.textContent = "CalumAi 管理台不能嵌入其他網站。";
    return;
  }

  const root = document.querySelector("#studio-app");
  const core = window.CalumAiStudioCore;
  const github = window.CalumAiGithub;
  const CATEGORIES = ["製作心得", "遊戲", "AI 教學", "族語教學", "Podcast", "自動化", "幕後花絮"];
  const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
  const PUBLIC_REGISTRY = "https://calumai.com/blog/published-posts.json";
  const PUBLIC_DEPLOY_STATUS = "https://calumai.com/admin/deploy-status.json";
  const SESSION_TOKEN_KEY = "calumai-studio:github-session";
  const TEST_MODE = Boolean(window.__CALUMAI_STUDIO_TEST_MODE__);
  if (TEST_MODE && !Array.isArray(window.__CALUMAI_STUDIO_TEST_TOASTS__)) {
    window.__CALUMAI_STUDIO_TEST_TOASTS__ = [];
  }

  const state = {
    client: null,
    user: null,
    route: "articles",
    articles: [],
    filter: "all",
    query: "",
    inbox: [],
    inboxLoaded: false,
    loading: false,
    busy: false,
    loginError: "",
    pageError: "",
    editor: null,
    loaded: null,
    dirty: false,
    editorRevision: 0,
    activeOperation: null,
    previewFingerprint: "",
    assetUrls: new Map(),
    pendingAssets: new Map(),
    deployments: new Map(),
    livePosts: new Map(),
    liveRegistryChecked: false,
    liveDeploymentChecked: false,
    liveDeploymentContainsHead: false,
    contentHeadSha: "",
    recovery: null,
    importUndo: null,
    draftTimer: 0,
    sessionVersion: 0,
  };

  function escape(value) {
    return core.escapeHtml(value);
  }

  function sleep(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  function sessionSnapshot() {
    return { client: state.client, version: state.sessionVersion };
  }

  function sessionIsCurrent(session) {
    return Boolean(session?.client) && state.client === session.client && state.sessionVersion === session.version;
  }

  function errorMessage(error, fallback = "剛剛沒有完成，請再試一次。") {
    return error?.userMessage || error?.message || fallback;
  }

  function statusInfo(status) {
    return core.STATUS[status] || core.STATUS.draft;
  }

  function statusBadge(status, overrideLabel = "") {
    const info = statusInfo(status);
    return `<span class="status-badge" data-tone="${escape(info.tone)}">${escape(overrideLabel || info.label)}</span>`;
  }

  function showToast(message, tone = "neutral", duration = 4800) {
    if (TEST_MODE) {
      window.__CALUMAI_STUDIO_TEST_TOASTS__.push({ message, tone });
      return;
    }
    let region = document.querySelector(".toast-region");
    if (!region) {
      region = document.createElement("div");
      region.className = "toast-region";
      region.setAttribute("aria-live", "polite");
      document.body.append(region);
    }
    const toast = document.createElement("div");
    toast.className = "toast";
    toast.dataset.tone = tone;
    toast.textContent = message;
    region.append(toast);
    window.setTimeout(() => toast.remove(), duration);
  }

  function revokeAssetUrls() {
    for (const url of new Set(state.assetUrls.values())) {
      if (String(url).startsWith("blob:")) URL.revokeObjectURL(url);
    }
    state.assetUrls.clear();
  }

  function emptyEditor() {
    return {
      id: "",
      slug: "",
      title: "",
      excerpt: "",
      status: "draft",
      category: "製作心得",
      author: "CalumAi Studio",
      featureImage: "",
      featureImageAlt: "",
      featured: false,
      imageSourceType: "none",
      imageSourcePath: "",
      body: "",
      header: "",
    };
  }

  function localDraftKey() {
    return `calumai-studio:draft:${state.editor?.id || "new"}`;
  }

  function articleFingerprint() {
    if (!state.editor) return "";
    return JSON.stringify({
      title: state.editor.title,
      excerpt: state.editor.excerpt,
      category: state.editor.category,
      featureImage: state.editor.featureImage,
      featureImageAlt: state.editor.featureImageAlt,
      body: state.editor.body,
      assets: [...state.pendingAssets.keys()].sort(),
    });
  }

  function saveLocalDraftSoon() {
    window.clearTimeout(state.draftTimer);
    state.draftTimer = window.setTimeout(persistLocalDraftNow, 450);
  }

  function persistLocalDraftNow() {
    window.clearTimeout(state.draftTimer);
    state.draftTimer = 0;
    if (!state.editor || !state.dirty) return true;
    try {
      const record = {
        savedAt: new Date().toISOString(),
        baseSha: state.loaded?.articleSha || "",
        article: state.editor,
      };
      if (state.recovery?.article) {
        record.alternates = [{
          savedAt: state.recovery.savedAt || "",
          baseSha: state.recovery.baseSha || "",
          article: state.recovery.article,
        }, ...(Array.isArray(state.recovery.alternates) ? state.recovery.alternates : [])].slice(0, 5);
      }
      const serialized = JSON.stringify(record);
      const key = localDraftKey();
      localStorage.setItem(key, serialized);
      if (localStorage.getItem(key) !== serialized) return false;
      return true;
    } catch {
      // Browser storage is a convenience only. GitHub remains the durable copy.
      return false;
    }
  }

  function blockEditorTransition(message) {
    state.pageError = message;
    state.route = "editor";
    render();
    focusMain();
  }

  function persistEditorBeforeTransition({ confirmLeave = false, blockPendingAssets = false } = {}) {
    window.clearTimeout(state.draftTimer);
    state.draftTimer = 0;
    if (!state.editor) return true;

    if (state.route === "editor") syncEditorFromDom();
    if (
      confirmLeave &&
      state.dirty &&
      state.route === "editor" &&
      !window.confirm("這篇還有尚未存檔的文字。要先保留本機草稿並離開嗎？")
    ) {
      return false;
    }

    if (!persistLocalDraftNow()) {
      blockEditorTransition("本機草稿儲存失敗，已停止切換。請先複製文章內容或釋放瀏覽器儲存空間後再試。");
      return false;
    }
    if (blockPendingAssets && state.pendingAssets.size) {
      blockEditorTransition("還有尚未儲存的圖片。請先按「儲存草稿」把圖片存到 GitHub，再切換文章。");
      return false;
    }
    return true;
  }

  function clearLocalDraft(keys = [localDraftKey()]) {
    for (const key of keys) {
      try { localStorage.removeItem(key); } catch { /* no-op */ }
    }
  }

  function findLocalDraft(id, baseSha) {
    try {
      const raw = localStorage.getItem(`calumai-studio:draft:${id || "new"}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      parsed.conflict = (parsed.baseSha || "") !== (baseSha || "");
      if (!parsed.article || typeof parsed.article !== "object") return null;
      parsed.alternates = (Array.isArray(parsed.alternates) ? parsed.alternates : [])
        .filter((item) => item?.article && typeof item.article === "object")
        .slice(0, 5);
      return parsed;
    } catch {
      return null;
    }
  }

  function updateSaveState(label, tone = "neutral") {
    const target = document.querySelector("[data-save-state]");
    if (!target) return;
    target.dataset.tone = tone;
    const text = target.querySelector("span:last-child");
    if (text) text.textContent = label;
  }

  function markDirty({ preserveImportUndo = false } = {}) {
    if (!state.editor) return;
    if (!preserveImportUndo) state.importUndo = null;
    state.dirty = true;
    state.editorRevision += 1;
    state.previewFingerprint = "";
    updateSaveState("尚未儲存", "warning");
    saveLocalDraftSoon();
  }

  function setInterfaceBusy(busy, label = "") {
    state.busy = busy;
    const shell = root.querySelector(".studio-shell");
    if (shell) {
      shell.inert = busy;
      shell.setAttribute("aria-busy", String(busy));
    }
    if (label) updateSaveState(label, "warning");
    const liveRegion = document.querySelector("#studio-live-region");
    if (liveRegion && label) liveRegion.textContent = label;
  }

  function focusMain() {
    if (TEST_MODE) return;
    window.requestAnimationFrame(() => {
      const target = root.querySelector("[data-focus-error], [data-page-heading]");
      if (target instanceof HTMLElement) target.focus({ preventScroll: false });
    });
  }

  function deploymentFor(articleId) {
    return articleId ? state.deployments.get(articleId) || null : null;
  }

  function visibleStatus(article) {
    const deployment = deploymentFor(article.id);
    if (deployment && deployment.stage !== "live") {
      if (deployment.stage === "failed") {
        return { label: deployment.mode === "remove" && state.livePosts.has(article.id) ? "下架失敗，仍在線" : "發布失敗", tone: "danger" };
      }
      return { label: deployment.mode === "remove" ? "正在下架" : article.status === "published" && state.livePosts.has(article.id) ? "正在更新" : "正在發布", tone: "warning" };
    }
    return core.resolvePublicationStatus({
      articleStatus: article.status,
      registryContainsArticle: state.livePosts.has(article.id),
      registryChecked: state.liveRegistryChecked,
      deploymentChecked: state.liveDeploymentChecked,
      deploymentContainsHead: state.liveDeploymentContainsHead,
    });
  }

  function sidebar() {
    const inboxCount = state.inbox.filter((row) => !row.imported).length;
    return `<aside class="studio-sidebar">
      <div class="brand"><span class="brand-mark" aria-hidden="true">CA</span><span class="brand-copy">CalumAi<small>網站發文台</small></span></div>
      <nav class="studio-nav" aria-label="管理台功能">
        <button class="nav-button" type="button" data-route="articles" aria-current="${state.route === "articles" ? "page" : "false"}"><span class="nav-symbol" aria-hidden="true">文</span>文章</button>
        <button class="nav-button" type="button" data-route="inbox" aria-current="${state.route === "inbox" ? "page" : "false"}"><span class="nav-symbol" aria-hidden="true">收</span>收件匣${inboxCount ? `<span class="nav-count">${inboxCount}</span>` : ""}</button>
        <button class="nav-button" type="button" data-route="advanced" aria-current="${state.route === "advanced" ? "page" : "false"}"><span class="nav-symbol" aria-hidden="true">設</span>其他內容</button>
      </nav>
      <div class="sidebar-footer"><strong>${escape(state.user?.name || state.user?.login || "已登入")}</strong>文章存在 GitHub，換電腦登入後也看得到。<button type="button" class="button button--quiet button--small logout-button" data-action="logout">登出這台裝置</button></div>
    </aside>`;
  }

  function topbar(extra = "") {
    return `<header class="topbar"><span class="topbar-title">CalumAi 網站發文台</span><div class="topbar-actions">${extra ? `<div class="topbar-editor-actions">${extra}</div>` : ""}<a class="button button--quiet button--small topbar-site-link" href="https://calumai.com/blog/" target="_blank" rel="noopener">查看網站</a><button type="button" class="button button--quiet button--small mobile-logout" data-action="logout">登出</button></div></header>`;
  }

  function shell(content, topbarExtra = "") {
    return `<div class="studio-shell" aria-busy="${state.busy}" ${state.busy ? "inert" : ""}>${sidebar()}<main class="studio-main">${topbar(topbarExtra)}${content}</main></div>`;
  }

  function renderLogin() {
    root.innerHTML = `<main class="login-page"><section class="panel login-card">
      <div class="login-logo" aria-hidden="true">CA</div>
      <h1>CalumAi 網站發文台</h1>
      <p>不用找資料夾，也不用開指令視窗。登入後就能寫文章、放圖片、預覽，再決定要不要發布。</p>
      ${state.loginError ? `<div class="error-banner" role="alert">${escape(state.loginError)}</div>` : ""}
      <button class="button button--primary" type="button" data-action="sign-in" ${state.busy ? "disabled" : ""}>${state.busy ? "正在登入…" : "使用 GitHub 登入"}</button>
      <div class="login-note">登入權限只保留在這個分頁的暫存區，重新整理不必重登；結束這個瀏覽工作階段後清除。</div>
    </section></main>`;
  }

  function renderLoading(message = "正在整理文章…") {
    root.innerHTML = `<main class="loading-page" role="status" aria-live="polite"><div><div class="spinner" aria-hidden="true"></div><p>${escape(message)}</p></div></main>`;
  }

  function articleRows() {
    const query = state.query.trim().toLowerCase();
    const rows = state.articles
      .filter((article) => state.filter === "all" || article.status === state.filter)
      .filter((article) => !query || `${article.title} ${article.excerpt} ${article.category}`.toLowerCase().includes(query))
      .sort((a, b) => String(b.id).localeCompare(String(a.id)));
    if (!rows.length) {
      return `<div class="empty-state"><strong>${state.articles.length ? "沒有符合的文章" : "還沒有文章"}</strong><p>${state.articles.length ? "換一個關鍵字或狀態看看。" : "從第一篇草稿開始，先預覽再發布。"}</p><button class="button button--primary" type="button" data-action="new-article">新增文章</button></div>`;
    }
    return rows.map((article) => {
      const info = visibleStatus(article);
      const initial = (article.title || "文").trim().slice(0, 1);
      return `<button class="article-row" type="button" data-action="open-article" data-id="${escape(article.id)}">
        <span class="article-thumb" aria-hidden="true">${escape(initial)}</span>
        <span class="article-copy"><strong>${escape(article.title || "未命名文章")}</strong><span>${escape(article.excerpt || article.category || "尚未填寫摘要")}</span></span>
        <span class="status-badge" data-tone="${escape(info.tone)}">${escape(info.label)}</span>
      </button>`;
    }).join("");
  }

  function renderArticles() {
    const content = `<div class="content">
      <div class="page-heading"><div><h1 tabindex="-1" data-page-heading>文章</h1><p>草稿不會出現在網站。按下發布後，這裡會一路顯示到真正上線。</p></div><button class="button button--primary" type="button" data-action="new-article">新增文章</button></div>
      ${state.pageError ? `<div class="error-banner" role="alert" tabindex="-1" data-focus-error>${escape(state.pageError)}</div>` : ""}
      <div class="toolbar-line"><label class="search-wrap"><span class="sr-only">搜尋文章</span><input class="search-input" type="search" value="${escape(state.query)}" placeholder="輸入標題、摘要或分類" data-search></label>
        <div class="segment" aria-label="文章狀態">
          <button type="button" data-filter="all" aria-pressed="${state.filter === "all"}">全部</button>
          <button type="button" data-filter="draft" aria-pressed="${state.filter === "draft"}">草稿</button>
          <button type="button" data-filter="awaiting_human_review" aria-pressed="${state.filter === "awaiting_human_review"}">待確認</button>
          <button type="button" data-filter="published" aria-pressed="${state.filter === "published"}">已公開</button>
        </div>
      </div>
      <section class="panel article-list" aria-label="文章清單" data-article-list>${articleRows()}</section>
    </div>`;
    root.innerHTML = shell(content);
  }

  function categoryOptions(current) {
    const values = [...new Set([current, ...CATEGORIES].filter(Boolean))];
    return values.map((value) => `<option value="${escape(value)}" ${value === current ? "selected" : ""}>${escape(value)}</option>`).join("");
  }

  function relativeAssetPath(entryPath) {
    const prefix = state.editor?.id ? `posts/${state.editor.id}/` : "";
    return prefix && entryPath.startsWith(prefix) ? entryPath.slice(prefix.length) : entryPath;
  }

  function assetEntries() {
    const items = new Map();
    for (const file of state.loaded?.files || []) {
      const relative = relativeAssetPath(file.path);
      if (/^assets\//i.test(relative)) items.set(relative, { path: relative, url: assetUrlFor(relative), pending: false });
    }
    for (const [path, item] of state.pendingAssets) items.set(path, { path, url: item.url, pending: true });
    return [...items.values()].sort((a, b) => a.path.localeCompare(b.path));
  }

  function decodePath(value) {
    try { return decodeURIComponent(value); } catch { return value; }
  }

  function normalizeAssetKey(value) {
    return String(value || "").trim().replace(/\\/g, "/").replace(/^\.\//, "").split(/[?#]/, 1)[0];
  }

  function assetUrlFor(value) {
    const normalized = normalizeAssetKey(value);
    if (!normalized) return "";
    if (/^https?:\/\//i.test(normalized)) return normalized;
    return state.assetUrls.get(normalized)
      || state.assetUrls.get(decodePath(normalized))
      || state.assetUrls.get(encodeURI(decodePath(normalized)))
      || "";
  }

  function availableAssetKeys() {
    const keys = new Set();
    for (const item of assetEntries()) {
      if (!item.url) continue;
      keys.add(normalizeAssetKey(item.path));
      keys.add(decodePath(normalizeAssetKey(item.path)));
    }
    return keys;
  }

  function missingAssets() {
    const available = availableAssetKeys();
    const refs = [...core.extractAssetPaths(state.editor?.body || "")];
    if (state.editor?.featureImage && !/^https?:\/\//i.test(state.editor.featureImage)) refs.push(state.editor.featureImage);
    return [...new Set(refs.map(normalizeAssetKey))].filter((item) => !available.has(item) && !available.has(decodePath(item)));
  }

  function imageAltIssues() {
    const issues = [];
    const regex = /!\[([^\]]*)\]\(\s*(?:<[^>]+>|[^\s)]+)(?:\s+["'][^"']*["'])?\s*\)/g;
    let match;
    while ((match = regex.exec(core.stripMarkdownCode(state.editor?.body || ""))) !== null) {
      const alt = String(match[1] || "").trim();
      if (!alt || alt === "請填寫圖片說明") issues.push("內文圖片");
    }
    if (state.editor?.featureImage) {
      const alt = String(state.editor.featureImageAlt || "").trim();
      if (!alt || alt === "請填寫圖片說明") issues.push("封面圖片");
    }
    return issues;
  }

  function coverMarkup() {
    const url = assetUrlFor(state.editor?.featureImage);
    if (url) return `<img class="cover-preview" src="${escape(url)}" alt="${escape(state.editor.featureImageAlt || state.editor.title || "封面預覽")}">`;
    return `<span class="cover-empty"><strong>選一張文章封面</strong>從電腦選圖，不需要先搬到 assets 資料夾。</span>`;
  }

  function assetListMarkup() {
    const items = assetEntries();
    if (!items.length) return `<p class="field-hint">目前還沒有文章圖片。</p>`;
    return items.map((item) => `<div class="asset-item"><img src="${escape(item.url || "")}" alt=""><span>${escape(item.path.replace(/^assets\//, ""))}${item.pending ? "（尚未儲存）" : ""}</span><button type="button" data-action="insert-existing-image" data-path="${escape(item.path)}">插入</button></div>`).join("");
  }

  function deploymentMarkup() {
    const deployment = deploymentFor(state.editor?.id);
    if (!deployment) return "";
    const steps = [
      ["saved", "文章與圖片已安全存好"],
      ["building", "正在產生網站頁面"],
      ["deploying", "正在更新 calumai.com"],
      ["live", deployment.mode === "remove" ? "已從網站下架" : "已在網站上線"],
    ];
    const order = { saved: 0, building: 1, deploying: 2, live: 3, failed: -1 };
    const current = order[deployment.stage] ?? 0;
    return `<section class="panel progress-panel" aria-live="polite"><h3>${deployment.stage === "failed" ? "這次發布沒有完成" : "發布進度"}</h3><div class="progress-steps">${steps.map(([key, label], index) => {
      let stepState = index < current ? "done" : index === current ? "active" : "waiting";
      if (deployment.stage === "failed" && index === Math.max(0, deployment.failedAt || 1)) stepState = "failed";
      return `<div class="progress-step" data-state="${stepState}">${escape(label)}</div>`;
    }).join("")}</div>${deployment.message ? `<p class="field-hint">${escape(deployment.message)}</p>` : ""}${deployment.url ? `<a class="button button--small" href="${escape(deployment.url)}" target="_blank" rel="noopener">開啟文章</a>` : ""}</section>`;
  }

  function refreshDeploymentView(articleId) {
    if (state.route === "editor" && state.editor?.id === articleId) {
      const slot = root.querySelector("[data-deployment-slot]");
      if (slot) slot.innerHTML = deploymentMarkup();
      const status = root.querySelector("[data-current-status]");
      if (status) {
        const info = visibleStatus(state.editor);
        status.dataset.tone = info.tone;
        status.textContent = info.label;
      }
      return;
    }
    if (state.route === "articles") {
      const list = root.querySelector("[data-article-list]");
      if (list) list.innerHTML = articleRows();
    }
  }

  function setDeployment(articleId, deployment) {
    state.deployments.set(articleId, deployment);
    refreshDeploymentView(articleId);
  }

  function editorActions() {
    const published = state.editor?.status === "published";
    return `<button class="button button--small" type="button" data-action="preview">預覽</button>
      ${published
        ? `<button class="button button--primary button--small" type="button" data-action="request-publish">儲存並更新網站</button>`
        : `<button class="button button--small" type="button" data-action="save-draft">儲存草稿</button><button class="button button--primary button--small" type="button" data-action="request-publish">發布</button>`}`;
  }

  function renderEditor() {
    const article = state.editor;
    if (!article) return renderArticles();
    const title = article.title || "新增文章";
    const published = article.status === "published";
    const publicStatus = visibleStatus(article);
    const publicationMessage = publicStatus.state === "live"
      ? "這篇目前在網站上。修改後先預覽，再用上方按鈕更新網站。"
      : publicStatus.state === "unpublish-pending"
        ? "已改回草稿；公開網站仍是較早版本，正在等待下架。"
        : published
          ? "這篇已設為公開，但網站可能仍在等待部署；請以狀態標籤為準。"
          : "存草稿不會公開；只有按上方的發布才會出現在網站。";
    const content = `<div class="content content--editor">
      <div class="page-heading editor-heading"><div><button class="button button--quiet back-button" type="button" data-action="back-to-list">返回文章清單</button><h1 tabindex="-1" data-page-heading>${escape(title)}</h1></div><div class="save-state" data-save-state data-tone="${state.dirty ? "warning" : "success"}"><span class="save-dot" aria-hidden="true"></span><span>${state.dirty ? "尚未儲存" : state.loaded ? "已存檔" : "新文章"}</span></div></div>
      ${state.recovery ? `<div class="error-banner" role="status">${state.recovery.conflict ? "這台電腦留有一份較早、尚未存上 GitHub 的版本。先比較再決定，不會自動蓋掉雲端內容。" : "這台電腦留有一份尚未存到 GitHub 的文字。"}${state.recovery.alternates?.length ? ` 另外還安全保留 ${state.recovery.alternates.length} 份較早版本。` : ""}<button class="button button--small" type="button" data-action="compare-recovery">比較版本</button> <button class="button button--quiet button--small" type="button" data-action="discard-recovery">保留 GitHub 版本</button></div>` : ""}
      ${state.importUndo ? `<div class="error-banner" role="status">已帶入 Markdown 內容。<button class="button button--small" type="button" data-action="undo-import">撤銷這次匯入</button></div>` : ""}
      ${state.pageError ? `<div class="error-banner" role="alert" tabindex="-1" data-focus-error>${escape(state.pageError)}</div>` : ""}
      <div class="editor-grid">
        <section class="panel editor-card">
          <label class="field"><span class="field-label">標題 <span class="field-hint">讀者第一眼看到的文字</span></span><input type="text" maxlength="100" value="${escape(article.title)}" data-field="title" placeholder="這篇文章想告訴大家什麼？"></label>
          <label class="field"><span class="field-label">文章摘要 <span class="field-hint">可以留空，系統會幫你擷取</span></span><textarea data-field="excerpt" maxlength="260" placeholder="用一兩句話說明這篇文章">${escape(article.excerpt)}</textarea></label>
          <label class="field"><span class="field-label">分類</span><select data-field="category">${categoryOptions(article.category)}</select></label>
          <div class="field"><span class="field-label" id="article-body-label">講義或文章內文 <span class="field-hint">可直接貼 Markdown</span></span>
            <div class="markdown-wrap"><div class="markdown-toolbar" aria-label="文字工具">
              <button class="toolbar-button" type="button" data-format="heading">小標題</button>
              <button class="toolbar-button" type="button" data-format="bold">粗體</button>
              <button class="toolbar-button" type="button" data-format="quote">引言</button>
              <button class="toolbar-button" type="button" data-format="list">清單</button>
              <span class="toolbar-separator" aria-hidden="true"></span>
              <button class="toolbar-button" type="button" data-action="choose-body-images">插入圖片</button>
              <button class="toolbar-button" type="button" data-action="choose-markdown">匯入 .md 與圖片</button>
            </div><textarea class="article-body-input" data-field="body" data-body-input aria-labelledby="article-body-label" placeholder="從這裡開始寫文章…">${escape(article.body)}</textarea></div>
            <p class="field-hint">預覽會直接顯示 Markdown 排版。上傳圖片後，系統會自動放到正確位置。</p>
          </div>
        </section>
        <aside class="editor-aside">
          <section class="panel aside-card"><h2>封面</h2><p>會顯示在文章上方與部落格列表。</p><button class="cover-drop" type="button" data-action="choose-cover">${coverMarkup()}</button><div class="cover-actions"><button class="button button--small" type="button" data-action="choose-cover">更換</button>${article.featureImage ? `<button class="button button--quiet button--small" type="button" data-action="remove-cover">移除</button>` : ""}</div><label class="field field--cover-alt"><span class="field-label">圖片說明</span><input type="text" value="${escape(article.featureImageAlt)}" data-field="featureImageAlt" placeholder="例如：遊戲首頁操作畫面"></label></section>
          <section class="panel aside-card"><h2>儲存與發布</h2><p>${publicationMessage}</p><span class="status-badge" data-current-status data-tone="${escape(publicStatus.tone)}">${escape(publicStatus.label)}</span>${published ? `<div class="danger-zone"><button class="button button--quiet button--small" type="button" data-action="request-unpublish">暫時下架</button></div>` : ""}</section>
          <div data-deployment-slot>${deploymentMarkup()}</div>
          <section class="panel aside-card"><h2>文章圖片</h2><p>同一張圖可以再次插入，不用重傳。</p><button class="button button--small" type="button" data-action="choose-body-images">上傳並插入圖片</button><div class="asset-list" data-asset-list>${assetListMarkup()}</div></section>
          <section class="panel aside-card"><h2>新手安心檢查</h2><div class="tip-list"><div class="tip"><span class="tip-number">1</span><span>先按預覽，確認標題、清單與圖片位置。</span></div><div class="tip"><span class="tip-number">2</span><span>發布時文章和圖片會一起存，不會分家。</span></div><div class="tip"><span class="tip-number">3</span><span>看到「已在網站上線」才是真的完成。</span></div></div></section>
          ${state.loaded ? `<section class="panel aside-card danger-zone"><h2>移除文章</h2><p>會從文章清單與網站移除，但 GitHub 仍保留歷史紀錄。</p><button class="button button--danger button--small" type="button" data-action="request-delete">移除這篇文章</button></section>` : ""}
        </aside>
      </div>
      <input hidden type="file" accept="image/*" multiple data-file-input="body">
      <input hidden type="file" accept="image/*" data-file-input="cover">
      <input hidden type="file" accept=".md,text/markdown,image/*" multiple data-file-input="markdown">
    </div>`;
    root.innerHTML = shell(content, editorActions());
  }

  function renderInbox() {
    const available = state.inbox.filter((row) => row.canImport);
    const rows = state.inbox.map((row) => {
      const title = row.title || "未命名投稿";
      const excerpt = row.excerpt || "這份投稿尚未提供摘要。";
      const problems = Array.isArray(row.missingReasons) ? row.missingReasons : [];
      const integrity = problems.length
        ? `<ul class="inbox-problems" aria-label="暫時不能帶入的原因">${problems.map((reason) => `<li>${escape(reason)}</li>`).join("")}</ul>`
        : `<p class="inbox-ready">文章、圖片與來源說明都已備齊。</p>`;
      const action = row.imported
        ? statusBadge("published", "已在文章清單")
        : row.canImport
          ? `<button class="button button--small" type="button" data-action="import-inbox" data-id="${escape(row.id)}">帶入文章清單</button>`
          : statusBadge("awaiting_human_review", "資料不完整");
      return `<section class="panel inbox-card"><div class="inbox-copy"><span class="inbox-id">${escape(row.id)}</span><h2>${escape(title)}</h2><p class="inbox-excerpt">${escape(excerpt)}</p><p class="inbox-meta">${row.imageCount} 張圖片 · ${row.hasImageSources ? "有圖片來源說明" : "缺圖片來源說明"}</p>${integrity}</div>${action}</section>`;
    }).join("");
    const body = state.loading
      ? `<section class="panel skeleton"><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></section>`
      : state.inbox.length
        ? `<div class="inbox-list">${rows}</div>`
        : `<section class="panel empty-state"><strong>收件匣目前沒有新稿</strong><p>其他電腦推送的新文章，按同步後會出現在這裡。</p></section>`;
    const content = `<div class="content"><div class="page-heading"><div><h1 tabindex="-1" data-page-heading>GitHub 收件匣</h1><p>按一次就讀取私人收件匣，文章和圖片會一起帶進文章清單。</p></div><button class="button button--primary" type="button" data-action="sync-inbox" ${state.loading ? "disabled" : ""}>${available.length ? `同步並帶入 ${available.length} 篇` : "同步收件匣"}</button></div>${state.pageError ? `<div class="error-banner" role="alert" tabindex="-1" data-focus-error>${escape(state.pageError)}</div>` : ""}${body}</div>`;
    root.innerHTML = shell(content);
  }

  function renderAdvanced() {
    const content = `<div class="content"><div class="page-heading"><div><h1 tabindex="-1" data-page-heading>其他網站內容</h1><p>平常發文章不用進這裡。遊戲清單、首頁文字等低頻設定，暫時放在進階編輯器。</p></div></div>
      <section class="panel aside-card"><h2>遊戲、首頁與 AI 100</h2><p>這些設定牽涉整個網站結構，所以保留在備援編輯器。之後會逐項搬成跟文章一樣直覺的頁面。</p><a class="button" href="./cms.html" target="_blank" rel="noopener">開啟進階編輯器</a></section>
    </div>`;
    root.innerHTML = shell(content);
  }

  function render() {
    if (TEST_MODE) return;
    if (!state.client) return renderLogin();
    if (state.route === "editor") return renderEditor();
    if (state.route === "inbox") return renderInbox();
    if (state.route === "advanced") return renderAdvanced();
    return renderArticles();
  }

  async function signIn() {
    state.busy = true;
    state.loginError = "";
    renderLogin();
    try {
      const token = await github.signIn();
      const client = new github.GithubClient(token);
      const verified = await client.verify();
      state.client = client;
      state.user = verified.user;
      try { sessionStorage.setItem(SESSION_TOKEN_KEY, token); } catch { /* session continuity is optional */ }
      renderLoading("正在讀取文章清單…");
      await loadArticles();
      state.route = "articles";
      state.busy = false;
      render();
      focusMain();
    } catch (error) {
      state.loginError = errorMessage(error, "GitHub 登入沒有完成。");
      state.client = null;
      state.busy = false;
      renderLogin();
    }
  }

  async function resumeSession() {
    let token = "";
    try { token = sessionStorage.getItem(SESSION_TOKEN_KEY) || ""; } catch { /* no-op */ }
    if (!token) {
      renderLogin();
      return;
    }
    renderLoading("正在恢復安全登入…");
    try {
      const client = new github.GithubClient(token);
      const verified = await client.verify();
      state.client = client;
      state.user = verified.user;
      await loadArticles();
      renderArticles();
    } catch {
      try { sessionStorage.removeItem(SESSION_TOKEN_KEY); } catch { /* no-op */ }
      state.client = null;
      state.user = null;
      state.loginError = "登入已過期，請再按一次 GitHub 登入。";
      renderLogin();
    }
  }

  async function loadArticles() {
    const result = await state.client.listArticles();
    state.articles = result.articles.map((item) => ({ ...core.parseArticle(item.raw, item.id), articleSha: item.articleSha }));
    state.contentHeadSha = String(result.headSha || "");
    state.liveRegistryChecked = false;
    state.liveDeploymentChecked = false;
    state.liveDeploymentContainsHead = false;
    state.livePosts.clear();
    const cacheKey = Date.now();
    const readPublicJson = async (url) => {
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`Public status request failed: ${response.status}`);
      return response.json();
    };
    const [registryResult, deploymentResult] = await Promise.allSettled([
      readPublicJson(`${PUBLIC_REGISTRY}?studio-list=${cacheKey}`),
      readPublicJson(`${PUBLIC_DEPLOY_STATUS}?studio-list=${cacheKey}`),
    ]);

    if (registryResult.status === "fulfilled" && Array.isArray(registryResult.value)) {
      state.livePosts = new Map(registryResult.value.map((item) => [item.submissionId, item]));
      state.liveRegistryChecked = true;
    }
    if (deploymentResult.status === "fulfilled") {
      const deployedSha = String(deploymentResult.value?.sourceSha || "");
      if (state.contentHeadSha && deployedSha) {
        try {
          state.liveDeploymentContainsHead = await state.client.deploymentContainsCommit(state.contentHeadSha, deployedSha);
          state.liveDeploymentChecked = true;
        } catch {
          // Keep the status unconfirmed when GitHub cannot compare the commits.
        }
      }
    }
  }

  function startNewArticle() {
    if (!persistEditorBeforeTransition({ confirmLeave: true, blockPendingAssets: true })) return false;
    revokeAssetUrls();
    state.pendingAssets.clear();
    state.editor = emptyEditor();
    state.loaded = null;
    state.dirty = false;
    state.editorRevision = 0;
    state.previewFingerprint = "";
    state.pageError = "";
    state.recovery = findLocalDraft("new", "");
    state.importUndo = null;
    state.route = "editor";
    render();
    focusMain();
    return true;
  }

  async function loadAssetUrls(article, loaded) {
    const prefix = `posts/${article.id}/`;
    const imageEntries = loaded.files.filter((file) => {
      const relative = relativeAssetPathFor(file.path, prefix);
      return /^assets\//i.test(relative) && /\.(?:png|jpe?g|webp|gif|avif|svg)$/i.test(relative);
    });
    await Promise.all(imageEntries.map(async (entry) => {
      const relative = relativeAssetPathFor(entry.path, prefix);
      try {
        const url = await state.client.blobObjectUrl(github.CONTENT_REPO, entry.sha, entry.path);
        state.assetUrls.set(relative, url);
        state.assetUrls.set(decodePath(relative), url);
        state.assetUrls.set(encodeURI(decodePath(relative)), url);
      } catch {
        // Missing previews are reported explicitly in the preview sheet.
      }
    }));
  }

  function relativeAssetPathFor(filePath, prefix) {
    return filePath.startsWith(prefix) ? filePath.slice(prefix.length) : filePath;
  }

  async function openArticle(id) {
    if (!persistEditorBeforeTransition({ confirmLeave: true, blockPendingAssets: true })) return false;
    state.loading = true;
    state.pageError = "";
    renderLoading("正在打開文章與圖片…");
    try {
      revokeAssetUrls();
      state.pendingAssets.clear();
      const loaded = await state.client.loadArticle(id);
      const article = core.parseArticle(loaded.raw, id);
      const sourceEntry = loaded.files.find((file) => /\/IMAGE_SOURCES\.md$/i.test(file.path));
      loaded.imageSourcesText = sourceEntry
        ? await state.client.blobText(github.CONTENT_REPO, sourceEntry.sha)
        : "";
      state.editor = article;
      state.loaded = loaded;
      state.dirty = false;
      state.editorRevision = 0;
      state.previewFingerprint = "";
      state.recovery = findLocalDraft(id, loaded.articleSha);
      state.importUndo = null;
      await loadAssetUrls(article, loaded);
      state.route = "editor";
      render();
      focusMain();
    } catch (error) {
      state.route = "articles";
      state.pageError = errorMessage(error);
      render();
      focusMain();
    } finally {
      state.loading = false;
    }
    return true;
  }

  function syncEditorFromDom() {
    if (!state.editor) return;
    for (const input of root.querySelectorAll("[data-field]")) {
      state.editor[input.dataset.field] = input.type === "checkbox" ? input.checked : input.value;
    }
  }

  function insertAtCursor(before, after = "", placeholder = "文字") {
    const textarea = root.querySelector("[data-body-input]");
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end) || placeholder;
    const inserted = `${before}${selected}${after}`;
    textarea.setRangeText(inserted, start, end, "end");
    state.editor.body = textarea.value;
    textarea.focus();
    markDirty();
  }

  function insertRawAtCursor(text) {
    const textarea = root.querySelector("[data-body-input]");
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.setRangeText(text, start, end, "end");
    state.editor.body = textarea.value;
    textarea.focus();
    markDirty();
  }

  function applyFormat(format) {
    if (format === "heading") insertAtCursor("\n## ", "\n", "小標題");
    if (format === "bold") insertAtCursor("**", "**", "重要文字");
    if (format === "quote") insertAtCursor("\n> ", "\n", "想特別提醒讀者的話");
    if (format === "list") insertAtCursor("\n- ", "\n", "第一項");
  }

  function usedFilenames() {
    return new Set(assetEntries().map((item) => item.path.replace(/^assets\//, "").toLowerCase()));
  }

  function linkUploadedImages(article, additions) {
    const byOriginalName = new Map();
    for (const item of additions) {
      byOriginalName.set(decodePath(item.originalName).toLowerCase(), item.path);
    }
    const matched = new Set();
    article.body = article.body.replace(
      /!\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^\s)]+))(\s+["'][^"']*["'])?\s*\)/g,
      (whole, alt, anglePath, plainPath) => {
        const originalPath = decodePath(anglePath || plainPath || "").replace(/\\/g, "/");
        const originalName = originalPath.split("/").pop().toLowerCase();
        const replacement = byOriginalName.get(originalName);
        if (!replacement) return whole;
        matched.add(replacement);
        return `![${alt}](${replacement})`;
      },
    );
    if (article.featureImage && !/^https?:\/\//i.test(article.featureImage)) {
      const featureName = decodePath(article.featureImage).replace(/\\/g, "/").split("/").pop().toLowerCase();
      const replacement = byOriginalName.get(featureName);
      if (replacement) {
        article.featureImage = replacement;
        matched.add(replacement);
      }
    }
    return additions.filter((item) => !matched.has(item.path));
  }

  function supportedImageFiles(files) {
    const supported = [];
    for (const file of [...files]) {
      if (/\.(?:heic|heif)$/i.test(file.name) || /image\/hei[cf]/i.test(file.type)) {
        showToast(`${file.name} 是 iPhone 高效率格式，瀏覽器目前不能可靠發布。請在照片分享選項改成「最相容」或先轉成 JPG。`, "danger", 8000);
        continue;
      }
      if (/\.(?:png|jpe?g|webp|gif|avif|svg)$/i.test(file.name)) supported.push(file);
      else showToast(`${file.name} 不是可發布的圖片格式。請使用 PNG、JPG、WebP、GIF、AVIF 或安全的 SVG。`, "danger", 8000);
    }
    return supported;
  }

  async function prepareImages(images) {
    const used = usedFilenames();
    const additions = [];
    for (const file of images) {
      if (file.size > MAX_IMAGE_BYTES) {
        showToast(`${file.name} 超過 12 MB，請先縮小圖片。`, "danger");
        continue;
      }
      const fileName = core.uniqueFilename(file.name, used);
      used.add(fileName.toLowerCase());
      const path = `assets/${fileName}`;
      const bytes = new Uint8Array(await file.arrayBuffer());
      const imageErrors = core.validateImageBytes(fileName, bytes);
      if (imageErrors.length) {
          const error = new Error(`${file.name} 不是安全、完整的圖片。請重新匯出成 PNG 或 JPG 後再上傳。`);
          error.userMessage = error.message;
          throw error;
      }
      additions.push({ path, fileName, originalName: file.name, type: file.type, bytes, file });
    }
    return additions;
  }

  function applyPreparedImages(article, additions, { cover = false, insert = true, selection = null } = {}) {
    for (const item of additions) {
      const url = URL.createObjectURL(item.file);
      item.url = url;
      state.pendingAssets.set(item.path, { path: item.path, bytes: item.bytes, url, originalName: item.originalName, type: item.type });
      state.assetUrls.set(item.path, url);
    }
    let unlinked = additions;
    if (!cover) unlinked = linkUploadedImages(article, additions);
    if (cover) {
      article.featureImage = additions[0].path;
      article.featureImageAlt = article.featureImageAlt || article.title || "文章封面";
    }
    if (insert && unlinked.length) {
      const lines = unlinked.map((item) => `![請填寫圖片說明](${item.path})`).join("\n\n");
      const start = Math.max(0, Math.min(selection?.start ?? article.body.length, article.body.length));
      const end = Math.max(start, Math.min(selection?.end ?? start, article.body.length));
      article.body = `${article.body.slice(0, start)}\n${lines}\n${article.body.slice(end)}`;
    }
    if (!article.featureImage) {
      article.featureImage = additions[0].path;
      article.featureImageAlt = article.title || "文章封面";
    }
    if (article.imageSourcePath && article.imageSourcePath !== "IMAGE_SOURCES.md" && !article.priorImageSourcePath) {
      article.priorImageSourceType = article.imageSourceType;
      article.priorImageSourcePath = article.imageSourcePath;
    }
    if (!article.imageSourceType || article.imageSourceType === "none") article.imageSourceType = "original_upload";
    article.imageSourcePath = "IMAGE_SOURCES.md";
  }

  function currentEditorOperation(operation) {
    return state.activeOperation === operation
      && state.route === "editor"
      && state.editor === operation.editor
      && state.editorRevision === operation.revision;
  }

  async function addImages(files, { cover = false, insert = true } = {}) {
    if (state.busy || !state.editor) return [];
    syncEditorFromDom();
    const images = supportedImageFiles(files);
    if (!images.length) return [];
    const textarea = root.querySelector("[data-body-input]");
    const operation = {
      editor: state.editor,
      revision: state.editorRevision,
      selection: textarea ? { start: textarea.selectionStart, end: textarea.selectionEnd } : null,
    };
    state.activeOperation = operation;
    setInterfaceBusy(true, "正在讀取圖片…");
    try {
      const additions = await prepareImages(images);
      if (!currentEditorOperation(operation)) return [];
      if (!additions.length) return [];
      applyPreparedImages(operation.editor, additions, { cover, insert, selection: operation.selection });
      state.activeOperation = null;
      markDirty();
      setInterfaceBusy(false);
      renderEditor();
      showToast(cover ? "封面已帶入，儲存時會和文章一起上傳。" : "圖片已帶入正確位置。", "success");
      return additions;
    } catch (error) {
      if (state.activeOperation === operation) {
        state.pageError = errorMessage(error, "圖片讀取失敗，請換一張再試。 ");
        state.activeOperation = null;
        setInterfaceBusy(false);
        renderEditor();
        focusMain();
      }
      return [];
    } finally {
      if (state.activeOperation === operation) {
        state.activeOperation = null;
        setInterfaceBusy(false);
        renderEditor();
      }
    }
  }

  async function importMarkdownAndImages(files) {
    if (state.busy || !state.editor) return;
    syncEditorFromDom();
    const list = [...files];
    const markdownFile = list.find((file) => /\.md$/i.test(file.name) || file.type === "text/markdown");
    const imageFiles = supportedImageFiles(list.filter((file) => file !== markdownFile));
    if (!markdownFile && !imageFiles.length) return;
    const textarea = root.querySelector("[data-body-input]");
    const operation = {
      editor: state.editor,
      revision: state.editorRevision,
      selection: textarea ? { start: textarea.selectionStart, end: textarea.selectionEnd } : null,
    };
    const undo = {
      article: { ...state.editor },
      pendingAssets: new Map(state.pendingAssets),
      assetUrls: new Map(state.assetUrls),
    };
    state.activeOperation = operation;
    setInterfaceBusy(true, "正在帶入講義與圖片…");
    try {
      const [originalMarkdown, additions] = await Promise.all([
        markdownFile ? markdownFile.text() : Promise.resolve(""),
        prepareImages(imageFiles),
      ]);
      if (!currentEditorOperation(operation)) return;
      let nextArticle = { ...operation.editor };
      if (markdownFile) {
        const imported = core.parseArticle(originalMarkdown, nextArticle.id);
        const parts = core.splitFrontmatter(originalMarkdown);
        if (parts.hasFrontmatter) {
          const stableId = nextArticle.id;
          const stableSlug = nextArticle.slug;
          nextArticle = { ...nextArticle, ...imported };
          nextArticle.id = stableId || "";
          nextArticle.slug = stableId ? stableSlug : "";
        } else {
          nextArticle.body = originalMarkdown.trim();
        }
      }
      if (additions.length) {
        applyPreparedImages(nextArticle, additions, { cover: false, insert: !markdownFile, selection: operation.selection });
      }
      state.editor = nextArticle;
      state.importUndo = undo;
      state.activeOperation = null;
      markDirty({ preserveImportUndo: true });
      setInterfaceBusy(false);
      renderEditor();
      showToast(markdownFile ? "講義內文與圖片已帶入，請先按預覽檢查。" : "圖片已帶入文章。", "success");
    } catch (error) {
      if (state.activeOperation === operation) {
        state.pageError = errorMessage(error, "Markdown 或圖片讀取失敗，原本內容沒有被覆蓋。");
        state.activeOperation = null;
        setInterfaceBusy(false);
        renderEditor();
        focusMain();
      }
    } finally {
      if (state.activeOperation === operation) {
        state.activeOperation = null;
        setInterfaceBusy(false);
      }
    }
  }

  function showPreview() {
    syncEditorFromDom();
    const errors = core.validateArticle(state.editor, "draft");
    if (errors.length) {
      state.pageError = errors.map((item) => item.message).join(" ");
      renderEditor();
      focusMain();
      return;
    }
    state.pageError = "";
    const missing = missingAssets();
    const altIssues = imageAltIssues();
    const articleHtml = core.renderMarkdown(state.editor.body, { assetUrl: (value) => assetUrlFor(value) || "#" });
    const feature = assetUrlFor(state.editor.featureImage);
    const dialog = document.createElement("dialog");
    const previewTitleId = `preview-title-${Date.now()}`;
    const previewDescriptionId = `preview-description-${Date.now()}`;
    dialog.className = "preview-dialog";
    dialog.setAttribute("aria-labelledby", previewTitleId);
    dialog.setAttribute("aria-describedby", previewDescriptionId);
    dialog.innerHTML = `<div class="dialog-header"><div><h2 id="${previewTitleId}">發布前預覽</h2><span class="field-hint" id="${previewDescriptionId}">這是讀者會看到的文章排版</span></div><button class="dialog-close" type="button" aria-label="關閉預覽">×</button></div><div class="dialog-body"><div class="preview-shell">
      ${missing.length ? `<div class="preview-warning"><strong>有 ${missing.length} 張圖片還沒找到：</strong><br>${missing.map(escape).join("<br>")}<br>請關閉預覽後重新上傳，發布按鈕會先擋住。</div>` : ""}
      ${altIssues.length ? `<div class="preview-warning"><strong>有圖片還缺少有意義的說明。</strong><br>請把「請填寫圖片說明」改成畫面內容；發布前會再次檢查。</div>` : ""}
      <header class="preview-hero"><small>CALUMAI / 發布前預覽</small><h1>${escape(state.editor.title)}</h1><p>${escape(state.editor.excerpt || core.plainExcerpt(state.editor.body))}</p></header>
      ${feature ? `<img class="preview-feature" src="${escape(feature)}" alt="${escape(state.editor.featureImageAlt || state.editor.title)}">` : ""}
      <article class="preview-article">${articleHtml}</article>
    </div></div>`;
    document.body.append(dialog);
    dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("close", () => dialog.remove());
    dialog.showModal();
    state.previewFingerprint = articleFingerprint();
  }

  function showConfirm({ title, lead, checks = [], confirmLabel, danger = false, onConfirm }) {
    const dialog = document.createElement("dialog");
    const dialogId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const titleId = `dialog-title-${dialogId}`;
    const leadId = `dialog-lead-${dialogId}`;
    dialog.setAttribute("aria-labelledby", titleId);
    dialog.setAttribute("aria-describedby", leadId);
    dialog.innerHTML = `<div class="dialog-header"><h2 id="${titleId}">${escape(title)}</h2><button class="dialog-close" type="button" aria-label="關閉">×</button></div><div class="dialog-body"><p class="dialog-lead" id="${leadId}">${escape(lead)}</p>${checks.length ? `<div class="check-list">${checks.map((label, index) => `<label class="check-row"><input type="checkbox" data-confirm-check="${index}"><span>${escape(label)}</span></label>`).join("")}</div>` : ""}</div><div class="dialog-footer"><button class="button" type="button" data-dialog-cancel>取消</button><button class="button ${danger ? "button--danger-fill" : "button--primary"}" type="button" data-dialog-confirm ${checks.length ? "disabled" : ""}>${escape(confirmLabel)}</button></div>`;
    const confirm = dialog.querySelector("[data-dialog-confirm]");
    const update = () => { confirm.disabled = [...dialog.querySelectorAll("[data-confirm-check]")].some((input) => !input.checked); };
    dialog.addEventListener("change", update);
    dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
    dialog.querySelector("[data-dialog-cancel]").addEventListener("click", () => dialog.close());
    confirm.addEventListener("click", async () => { dialog.close(); await onConfirm(); });
    dialog.addEventListener("close", () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
  }

  function requestMarkdownImport() {
    syncEditorFromDom();
    const choose = () => root.querySelector('[data-file-input="markdown"]')?.click();
    if (!state.dirty && !state.editor?.body.trim() && !state.editor?.title.trim()) {
      choose();
      return;
    }
    showConfirm({
      title: "匯入 Markdown 講義？",
      lead: "Markdown 內文會取代目前編輯區的文字；圖片會依檔名接到正確位置。匯入後可立即撤銷一次。",
      confirmLabel: "選擇 .md 與圖片",
      onConfirm: choose,
    });
  }

  function undoMarkdownImport() {
    const undo = state.importUndo;
    if (!undo) return;
    for (const [path, url] of state.assetUrls) {
      if (undo.assetUrls.get(path) !== url && String(url).startsWith("blob:")) URL.revokeObjectURL(url);
    }
    state.editor = { ...undo.article };
    state.pendingAssets = new Map(undo.pendingAssets);
    state.assetUrls = new Map(undo.assetUrls);
    state.importUndo = null;
    markDirty();
    renderEditor();
    showToast("已恢復匯入前的內容。", "success");
  }

  function restoreRecoveryVersion(version = state.recovery) {
    if (!version?.article || !state.editor) return;
    const stableId = state.editor.id;
    const stableSlug = state.editor.slug;
    state.editor = { ...state.editor, ...version.article, id: stableId, slug: stableSlug };
    state.recovery = null;
    markDirty();
    renderEditor();
    showToast("已改用這台電腦留下的版本；請預覽後再儲存。", "success");
  }

  function showRecoveryComparison() {
    if (!state.recovery?.article || !state.editor) return;
    const localVersions = [state.recovery, ...(state.recovery.alternates || [])];
    const dialog = document.createElement("dialog");
    const titleId = `recovery-title-${Date.now()}`;
    dialog.className = "compare-dialog";
    dialog.setAttribute("aria-labelledby", titleId);
    const localPanes = localVersions.map((version, index) => `<section class="compare-pane"><h3>${index === 0 ? "這台電腦最新保留版" : `較早保留版本 ${index}`}</h3><strong>${escape(version.article.title || "尚無標題")}</strong><pre>${escape(version.article.body || "（空白）")}</pre><button class="button button--primary button--small" type="button" data-use-local="${index}">改用這個版本</button></section>`).join("");
    dialog.innerHTML = `<div class="dialog-header"><h2 id="${titleId}">比較保留的版本</h2><button class="dialog-close" type="button" aria-label="關閉">×</button></div><div class="dialog-body"><p class="dialog-lead">第一格是 GitHub 上的版本，其他是這台電腦尚未存好的版本。系統不會自動覆蓋。</p><div class="compare-grid"><section class="compare-pane"><h3>GitHub 版本</h3><strong>${escape(state.editor.title || "尚無標題")}</strong><pre>${escape(state.editor.body || "（空白）")}</pre></section>${localPanes}</div></div><div class="dialog-footer"><button class="button" type="button" data-keep-cloud>保留 GitHub 版本</button></div>`;
    dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
    dialog.querySelector("[data-keep-cloud]").addEventListener("click", () => {
      clearLocalDraft();
      state.recovery = null;
      dialog.close();
      renderEditor();
    });
    for (const button of dialog.querySelectorAll("[data-use-local]")) {
      button.addEventListener("click", () => {
        const version = localVersions[Number(button.dataset.useLocal)];
        dialog.close();
        restoreRecoveryVersion(version);
      });
    }
    dialog.addEventListener("close", () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();
  }

  function clearSessionToken() {
    try {
      sessionStorage.removeItem(SESSION_TOKEN_KEY);
      return sessionStorage.getItem(SESSION_TOKEN_KEY) === null;
    } catch {
      return false;
    }
  }

  function logout() {
    if (state.route === "editor") syncEditorFromDom();
    if (state.pendingAssets.size) {
      persistLocalDraftNow();
      blockEditorTransition("還有尚未儲存的圖片，無法安全登出。請先按「儲存草稿」把圖片存到 GitHub。");
      return false;
    }
    if (state.dirty && !window.confirm("這篇還有尚未存檔的文字。登出前要先保留在這台電腦嗎？\n\n按「確定」會保留本機草稿並登出。")) return false;
    if (!persistLocalDraftNow()) {
      state.pageError = "這台裝置目前無法保留本機草稿，所以尚未登出。請先按「儲存草稿」，或複製內文後再試一次。";
      renderEditor();
      focusMain();
      return false;
    }
    const sessionCleared = clearSessionToken();
    revokeAssetUrls();
    window.clearTimeout(state.draftTimer);
    Object.assign(state, {
      client: null,
      user: null,
      route: "articles",
      articles: [],
      inbox: [],
      inboxLoaded: false,
      loading: false,
      busy: false,
      loginError: sessionCleared
        ? ""
        : "本頁已登出，但瀏覽器無法清除登入工作階段。請關閉這個分頁，避免重新整理後自動登入。",
      pageError: "",
      editor: null,
      loaded: null,
      dirty: false,
      recovery: null,
      importUndo: null,
      liveRegistryChecked: false,
      liveDeploymentChecked: false,
      liveDeploymentContainsHead: false,
      contentHeadSha: "",
      sessionVersion: state.sessionVersion + 1,
    });
    state.pendingAssets.clear();
    state.livePosts.clear();
    state.deployments.clear();
    render();
    if (sessionCleared) showToast("這台裝置已安全登出。", "success");
    else showToast("本頁已登出；請關閉分頁以清除工作階段。", "danger");
    return sessionCleared;
  }

  function requestPublish() {
    syncEditorFromDom();
    const errors = core.validateArticle(state.editor, "published");
    const missing = missingAssets();
    const altIssues = imageAltIssues();
    if (missing.length) errors.push({ message: `還有圖片沒有上傳：${missing.join("、")}` });
    if (altIssues.length) errors.push({ message: "圖片說明還有空白或「請填寫圖片說明」，請先改成讀者能理解的畫面描述。" });
    if (errors.length) {
      state.pageError = errors.map((item) => item.message).join(" ");
      renderEditor();
      focusMain();
      return;
    }
    if (state.previewFingerprint !== articleFingerprint()) {
      showToast("請先看一次目前版本的預覽。預覽後再按發布。", "danger");
      showPreview();
      return;
    }
    const updating = state.editor.status === "published";
    showConfirm({
      title: updating ? "更新網站上的文章？" : "準備發布這篇文章？",
      lead: updating ? "儲存後會直接更新網站上的公開文章。" : "確認後系統會開始產生網頁，完成前會顯示清楚的進度。",
      checks: ["我已看過這次的文章預覽", "標題、內文與圖片位置都正確", "這篇內容可以讓讀者公開看到"],
      confirmLabel: updating ? "儲存並更新網站" : "確認發布",
      onConfirm: () => saveArticle("published"),
    });
  }

  function articleLocalImagePaths(article) {
    const paths = new Set(core.extractAssetPaths(article.body || "").filter((value) => /^assets\//i.test(value)));
    const feature = String(article.featureImage || "").replace(/^\.\//, "");
    if (/^assets\//i.test(feature)) paths.add(feature);
    return [...paths];
  }

  function imageSourcesManifest(existing, pendingAssets, details = {}) {
    const original = String(existing || "").trim();
    const header = original || "# 圖片來源紀錄\n\n這份檔案由 CalumAi 發文台維護。";
    const known = new Set();
    for (const match of original.matchAll(/`((?:\.\/)?assets\/[^`\r\n]+)`/gi)) {
      const normalized = normalizeAssetKey(match[1]).toLowerCase();
      known.add(normalized);
      known.add(decodePath(normalized).toLowerCase());
    }
    const isKnown = (assetPath) => {
      const normalized = normalizeAssetKey(assetPath).toLowerCase();
      return known.has(normalized) || known.has(decodePath(normalized).toLowerCase());
    };
    const inherited = [];
    if (details.previousPath && !original.includes(String(details.previousPath))) {
      const previousType = String(details.previousType || "未註明").replace(/[\r\n`]/g, " ").slice(0, 120);
      const previousPath = String(details.previousPath).replace(/[\r\n`]/g, " ").slice(0, 500);
      inherited.push("## 原有來源紀錄", "", `- 原類型：${previousType}`, `- 原紀錄：${previousPath}`, "");
    }
    const existingAssets = (details.existingAssets || [])
      .filter((assetPath) => !isKnown(assetPath))
      .map((assetPath) => `- \`${String(assetPath).replace(/[\r\n`]/g, " ")}\`：原本已在這篇文章的資料夾中`);
    const additions = pendingAssets
      .filter((item) => !isKnown(item.path))
      .map((item) => {
        const originalName = String(item.originalName || item.path).replace(/[\r\n`]/g, " ").slice(0, 180);
        return `- \`${item.path}\`：由已登入的編輯者透過 CalumAi 發文台上傳（原始檔名：${originalName}）`;
      });
    const sections = [header];
    if (inherited.length) sections.push(inherited.join("\n").trim());
    if (existingAssets.length) sections.push(`## 圖片清單\n\n${existingAssets.join("\n")}`);
    if (additions.length) sections.push(`## 從發文台上傳\n\n${additions.join("\n")}`);
    return `${sections.join("\n\n")}\n`;
  }

  async function saveArticle(status, mode = status === "published" ? "publish" : "save") {
    if (state.busy) return;
    syncEditorFromDom();
    const operation = {
      token: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      revision: state.editorRevision,
      originalId: state.editor.id,
      article: { ...state.editor },
      loaded: state.loaded ? { ...state.loaded, files: [...state.loaded.files] } : null,
      pendingAssets: [...state.pendingAssets.values()],
      imageSourcesText: state.loaded?.imageSourcesText || "",
      previousImageSourceType: state.editor.priorImageSourceType || "",
      previousImageSourcePath: state.editor.priorImageSourcePath || "",
      oldDraftKey: localDraftKey(),
    };
    const previousStatus = operation.article.status;
    const errors = core.validateArticle(operation.article, status);
    if (errors.length) {
      state.pageError = errors.map((item) => item.message).join(" ");
      renderEditor();
      focusMain();
      return;
    }
    state.activeOperation = operation;
    state.pageError = "";
    setInterfaceBusy(true, "正在安全儲存…");
    try {
      const localImagePaths = articleLocalImagePaths(operation.article);
      if (localImagePaths.length) {
        if (operation.article.imageSourcePath && operation.article.imageSourcePath !== "IMAGE_SOURCES.md" && !operation.previousImageSourcePath) {
          operation.previousImageSourceType = operation.article.imageSourceType;
          operation.previousImageSourcePath = operation.article.imageSourcePath;
        }
        if (!operation.article.imageSourceType || operation.article.imageSourceType === "none") operation.article.imageSourceType = "original_upload";
        operation.article.imageSourcePath = "IMAGE_SOURCES.md";
      }
      const built = core.buildArticle(operation.article, status);
      const articlePath = `posts/${built.id}/article.md`;
      const files = [{ path: articlePath, content: built.content }];
      for (const item of operation.pendingAssets) files.push({ path: `posts/${built.id}/${item.path}`, bytes: item.bytes });
      let nextImageSourcesText = operation.imageSourcesText;
      if (localImagePaths.length && (operation.pendingAssets.length || !operation.imageSourcesText.trim() || operation.previousImageSourcePath)) {
        nextImageSourcesText = imageSourcesManifest(operation.imageSourcesText, operation.pendingAssets, {
          existingAssets: localImagePaths.filter((assetPath) => !operation.pendingAssets.some((item) => item.path.toLowerCase() === assetPath.toLowerCase())),
          previousType: operation.previousImageSourceType,
          previousPath: operation.previousImageSourcePath,
        });
        files.push({ path: `posts/${built.id}/IMAGE_SOURCES.md`, content: nextImageSourcesText });
      }
      const loadedByPath = new Map((operation.loaded?.files || []).map((file) => [file.path, file.sha]));
      const expectedFiles = operation.loaded
        ? [
          ...operation.loaded.files.map((file) => ({ path: file.path, sha: file.sha })),
          ...files.filter((file) => !loadedByPath.has(file.path)).map((file) => ({ path: file.path, sha: null })),
        ]
        : [];
      const result = await state.client.commitFiles({
        files,
        message: status === "published" ? `Publish article: ${operation.article.title}` : `Save draft: ${operation.article.title}`,
        expectedArticle: operation.loaded ? { path: `posts/${operation.loaded.id}/article.md`, sha: operation.loaded.articleSha } : null,
        expectedFiles,
      });

      const stillSameEditor = state.activeOperation === operation
        && state.route === "editor"
        && state.editorRevision === operation.revision
        && state.editor?.id === operation.originalId;
      if (!stillSameEditor) {
        state.activeOperation = null;
        setInterfaceBusy(false);
        showToast("內容已存到 GitHub；目前畫面已切換，所以沒有覆蓋現在正在看的文章。", "success");
        return;
      }

      state.editor = core.parseArticle(built.content, built.id);
      const existingFiles = operation.loaded?.files || [];
      const newFiles = files.map((file) => ({ path: file.path, type: "blob", sha: result.fileShas[file.path] }));
      const newPaths = new Set(newFiles.map((file) => file.path));
      state.loaded = {
        ...(operation.loaded || {}),
        id: built.id,
        articleSha: result.fileShas[articlePath],
        imageSourcesText: nextImageSourcesText,
        files: [...existingFiles.filter((file) => !newPaths.has(file.path)), ...newFiles],
      };
      state.pendingAssets.clear();
      state.dirty = false;
      state.editorRevision += 1;
      state.previewFingerprint = "";
      state.recovery = null;
      state.importUndo = null;
      clearLocalDraft([operation.oldDraftKey, localDraftKey()]);
      const needsDeployment = status === "published" || previousStatus === "published" || mode === "remove";
      if (needsDeployment) {
        state.deployments.set(built.id, { stage: "saved", mode, commitSha: result.commitSha, message: "已安全存到 GitHub。" });
      }
      renderEditor();
      updateSaveState(status === "published" ? "已存好，正在更新網站" : "草稿已安全存好", "success");
      showToast(status === "published" ? "文章與圖片已一起存好，正在更新網站。" : "草稿已存好，網站不會公開。", "success");
      try {
        await loadArticles();
      } catch (refreshError) {
        showToast(`文章已經存好，但清單暫時無法重新整理：${errorMessage(refreshError)}`, "danger", 7000);
      }
      state.activeOperation = null;
      setInterfaceBusy(false);
      renderEditor();
      if (needsDeployment) {
        void trackDeployment(result.commitSha, built.id, mode);
      }
    } catch (error) {
      if (state.activeOperation !== operation) return;
      state.activeOperation = null;
      setInterfaceBusy(false);
      state.pageError = errorMessage(error);
      updateSaveState("沒有存檔", "danger");
      renderEditor();
      focusMain();
    }
  }

  async function trackDeployment(commitSha, articleId, mode = "publish") {
    const client = state.client;
    const sessionVersion = state.sessionVersion;
    const sessionActive = () => state.client === client && state.sessionVersion === sessionVersion;
    if (!client) return;
    setDeployment(articleId, { stage: "saved", mode, commitSha, message: "已安全存到 GitHub。" });
    let run = null;
    try {
      for (let attempt = 0; attempt < 45; attempt += 1) {
        if (!sessionActive()) return;
        run = await client.workflowForCommit(commitSha);
        if (!sessionActive()) return;
        if (!run) {
          setDeployment(articleId, { ...deploymentFor(articleId), stage: "building", message: "正在等待網站製作開始。" });
        } else if (run.status !== "completed") {
          setDeployment(articleId, { ...deploymentFor(articleId), stage: "building", message: "正在排版文章與檢查圖片。" });
        } else if (run.conclusion !== "success") {
          setDeployment(articleId, { ...deploymentFor(articleId), stage: "failed", failedAt: 1, message: "網站檢查沒有通過，文章沒有被說成已上線。", url: run.html_url || "" });
          return;
        } else {
          setDeployment(articleId, { ...deploymentFor(articleId), stage: "deploying", message: "文章已產生，正在等網站換成新版本。" });
          break;
        }
        await sleep(4000);
      }

      for (let attempt = 0; attempt < 36; attempt += 1) {
        if (!sessionActive()) return;
        const cacheKey = `${encodeURIComponent(commitSha)}-${Date.now()}`;
        const deployResponse = await fetch(`${PUBLIC_DEPLOY_STATUS}?studio=${cacheKey}`, { cache: "no-store" });
        if (!sessionActive()) return;
        if (!deployResponse.ok) {
          await sleep(5000);
          continue;
        }
        const deployStatus = await deployResponse.json();
        const deployedSha = String(deployStatus?.sourceSha || "");
        let containsCommit = deployedSha.toLowerCase() === String(commitSha).toLowerCase();
        if (!containsCommit && deployedSha) {
          try {
            containsCommit = await client.deploymentContainsCommit(commitSha, deployedSha);
            if (!sessionActive()) return;
          } catch {
            containsCommit = false;
          }
        }
        if (!containsCommit) {
          await sleep(5000);
          continue;
        }

        let currentHeadChecked = false;
        let containsCurrentHead = false;
        if (state.contentHeadSha && deployedSha) {
          try {
            containsCurrentHead = await client.deploymentContainsCommit(state.contentHeadSha, deployedSha);
            currentHeadChecked = true;
            if (!sessionActive()) return;
          } catch {
            // The per-article commit is deployed, but the current repository head is still unconfirmed.
          }
        }

        const response = await fetch(`${PUBLIC_REGISTRY}?studio=${cacheKey}`, { cache: "no-store" });
        if (!sessionActive()) return;
        if (response.ok) {
          const registry = await response.json();
          if (!sessionActive()) return;
          state.liveRegistryChecked = true;
          const published = Array.isArray(registry) ? registry.find((item) => item.submissionId === articleId) : null;
          const done = mode === "remove" ? !published : Boolean(published);
          if (done) {
            state.liveDeploymentChecked = currentHeadChecked;
            state.liveDeploymentContainsHead = containsCurrentHead;
            if (mode === "remove") state.livePosts.delete(articleId);
            else state.livePosts.set(articleId, published);
            setDeployment(articleId, { stage: "live", mode, commitSha, message: mode === "remove" ? "公開頁面已移除。" : "已從公開網站重新讀取確認。", url: published?.url || "" });
            showToast(mode === "remove" ? "文章已從網站下架。" : "文章真的上線了，可以放心。", "success", 7000);
            return;
          }
        }
        await sleep(5000);
      }
      if (!sessionActive()) return;
      setDeployment(articleId, { ...deploymentFor(articleId), stage: "deploying", message: "網站平台還在更新。可以先離開，稍後回文章清單查看。" });
    } catch (error) {
      if (!sessionActive()) return;
      setDeployment(articleId, { stage: "failed", failedAt: 2, mode, commitSha, message: `無法確認網站狀態：${errorMessage(error)}`, url: run?.html_url || "" });
    }
  }

  function requestUnpublish() {
    syncEditorFromDom();
    showConfirm({
      title: "暫時下架這篇文章？",
      lead: state.dirty
        ? "目前尚未儲存的修改也會一起保留成草稿，公開網站上的頁面會移除。"
        : "文章會保留在發文台並改回草稿，公開網站上的頁面會移除。",
      checks: ["我知道讀者將暫時看不到這篇文章"],
      confirmLabel: "確認下架",
      danger: true,
      onConfirm: () => saveArticle("draft", "remove"),
    });
  }

  function requestDelete() {
    showConfirm({
      title: "移除這篇文章？",
      lead: "文章與圖片會從目前清單移除，公開頁面也會刪除。GitHub 歷史仍可協助復原。",
      checks: ["我確認要移除這篇文章"],
      confirmLabel: "移除文章",
      danger: true,
      onConfirm: deleteArticle,
    });
  }

  async function deleteArticle() {
    if (!state.loaded || state.busy) return;
    const operation = {
      token: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      id: state.editor.id,
      title: state.editor.title,
      revision: state.editorRevision,
      loaded: { ...state.loaded, files: [...state.loaded.files] },
      draftKey: localDraftKey(),
    };
    state.activeOperation = operation;
    setInterfaceBusy(true, "正在移除…");
    try {
      const result = await state.client.commitFiles({
        files: [],
        deletes: operation.loaded.files.map((file) => file.path),
        message: `Remove article: ${operation.title}`,
        expectedArticle: { path: `posts/${operation.loaded.id}/article.md`, sha: operation.loaded.articleSha },
        expectedFiles: operation.loaded.files.map((file) => ({ path: file.path, sha: file.sha })),
      });
      if (state.activeOperation !== operation || state.editor?.id !== operation.id || state.editorRevision !== operation.revision) {
        state.activeOperation = null;
        setInterfaceBusy(false);
        showToast("文章已從 GitHub 移除；目前畫面已切換，因此沒有清除現在正在看的內容。", "success");
        return;
      }
      clearLocalDraft([operation.draftKey]);
      revokeAssetUrls();
      state.editor = null;
      state.loaded = null;
      state.route = "articles";
      state.deployments.set(operation.id, { stage: "saved", mode: "remove", commitSha: result.commitSha, message: "已安全存到 GitHub。" });
      render();
      try {
        await loadArticles();
      } catch (refreshError) {
        state.articles = state.articles.filter((article) => article.id !== operation.id);
        showToast(`文章已移除，但清單暫時無法重新整理：${errorMessage(refreshError)}`, "danger", 7000);
      }
      state.activeOperation = null;
      setInterfaceBusy(false);
      render();
      focusMain();
      showToast("文章已從清單移除，正在同步公開網站。", "success");
      void trackDeployment(result.commitSha, operation.id, "remove");
    } catch (error) {
      if (state.activeOperation !== operation) return;
      state.activeOperation = null;
      setInterfaceBusy(false);
      state.pageError = errorMessage(error);
      renderEditor();
      focusMain();
    }
  }

  async function loadInbox() {
    const session = sessionSnapshot();
    if (!session.client) return false;
    state.loading = true;
    state.pageError = "";
    if (state.route === "inbox") renderInbox();
    let succeeded = false;
    try {
      const inbox = await session.client.listInbox(core);
      if (!sessionIsCurrent(session)) return false;
      state.inbox = inbox;
      state.inboxLoaded = true;
      succeeded = true;
    } catch (error) {
      if (!sessionIsCurrent(session)) return false;
      state.pageError = error.status === 404
        ? "這個 GitHub 登入目前讀不到私人收件匣。請確認 Calumai/calumai-blog-inbox 已授權給同一個 GitHub 帳號。"
        : errorMessage(error);
    } finally {
      if (!sessionIsCurrent(session)) return false;
      state.loading = false;
      if (state.route === "inbox") {
        renderInbox();
        if (state.pageError) focusMain();
      }
    }
    return succeeded;
  }

  async function importInboxRow(id) {
    const session = sessionSnapshot();
    if (!session.client) return;
    const row = state.inbox.find((item) => item.id === id);
    if (!row || row.imported || !row.canImport || state.loading) return;
    state.loading = true;
    state.busy = true;
    state.pageError = "";
    if (state.route === "inbox") renderInbox();
    try {
      showToast(`正在帶入 ${id}，文章與圖片會一起儲存。`);
      await session.client.importInboxSubmission(row, core);
      if (!sessionIsCurrent(session)) return;
      row.imported = true;
      row.canImport = false;
      try {
        await loadArticles();
      } catch (refreshError) {
        if (!sessionIsCurrent(session)) return;
        state.pageError = `投稿已帶入，但文章清單暫時無法重新整理：${errorMessage(refreshError)}`;
      }
      showToast(`${id} 已出現在文章清單。`, "success");
    } catch (error) {
      if (!sessionIsCurrent(session)) return;
      state.pageError = errorMessage(error);
    } finally {
      if (!sessionIsCurrent(session)) return;
      state.loading = false;
      state.busy = false;
      if (state.route === "inbox") {
        renderInbox();
        if (state.pageError) focusMain();
      }
    }
  }

  async function syncAndImportInbox() {
    const session = sessionSnapshot();
    if (!session.client) return;
    const loaded = await loadInbox();
    if (!loaded || !sessionIsCurrent(session)) return;
    const rows = state.inbox.filter((row) => row.canImport);
    if (!rows.length) {
      const blocked = state.inbox.some((row) => !row.imported && row.missingReasons?.length);
      showToast(blocked ? "收件匣已同步；有投稿缺少資料，請查看卡片上的原因。" : "收件匣已同步，目前沒有需要帶入的新稿。", blocked ? "danger" : "success");
      return;
    }
    state.loading = true;
    state.busy = true;
    if (state.route === "inbox") renderInbox();
    let imported = 0;
    try {
      for (const row of rows) {
        try {
          await session.client.importInboxSubmission(row, core);
          if (!sessionIsCurrent(session)) return;
          row.imported = true;
          row.canImport = false;
          imported += 1;
        } catch (error) {
          if (!sessionIsCurrent(session)) return;
          state.pageError = `${row.title || row.id} 沒有帶入：${errorMessage(error)}`;
          break;
        }
      }
      try {
        if (imported) await loadArticles();
      } catch (refreshError) {
        if (!sessionIsCurrent(session)) return;
        state.pageError = `投稿已帶入，但文章清單暫時無法重新整理：${errorMessage(refreshError)}`;
      }
    } finally {
      if (!sessionIsCurrent(session)) return;
      state.loading = false;
      state.busy = false;
      if (state.route === "inbox") {
        renderInbox();
        if (state.pageError) focusMain();
      }
    }
    if (sessionIsCurrent(session) && imported) showToast(`已把 ${imported} 篇文章和圖片帶入文章清單。`, "success");
  }

  function routeTo(route) {
    if (state.busy) {
      showToast("目前正在安全儲存，完成後才能切換頁面。", "danger");
      return;
    }
    if (route !== state.route && !persistEditorBeforeTransition({ confirmLeave: true })) return false;
    state.pageError = "";
    state.route = route;
    render();
    focusMain();
    if (route === "inbox" && !state.inboxLoaded) void loadInbox();
    return true;
  }

  if (TEST_MODE) {
    window.__CALUMAI_STUDIO_TEST_API__ = {
      SESSION_TOKEN_KEY,
      logout,
      markDirty,
      openArticle,
      persistEditorBeforeTransition,
      persistLocalDraftNow,
      routeTo,
      startNewArticle,
      state,
    };
    return;
  }

  root.addEventListener("click", (event) => {
    if (state.busy) return;
    const route = event.target.closest("[data-route]")?.dataset.route;
    if (route) return routeTo(route);
    const target = event.target.closest("[data-action], [data-filter], [data-format]");
    if (!target) return;
    const action = target.dataset.action;
    if (target.dataset.filter) {
      state.filter = target.dataset.filter;
      const list = root.querySelector("[data-article-list]");
      if (list) list.innerHTML = articleRows();
      for (const button of root.querySelectorAll("[data-filter]")) button.setAttribute("aria-pressed", String(button.dataset.filter === state.filter));
      return;
    }
    if (target.dataset.format) return applyFormat(target.dataset.format);
    if (action === "sign-in") void signIn();
    if (action === "new-article") startNewArticle();
    if (action === "open-article") void openArticle(target.dataset.id);
    if (action === "back-to-list") routeTo("articles");
    if (action === "preview") showPreview();
    if (action === "save-draft") void saveArticle("draft");
    if (action === "request-publish") requestPublish();
    if (action === "request-unpublish") requestUnpublish();
    if (action === "request-delete") requestDelete();
    if (action === "choose-body-images") root.querySelector('[data-file-input="body"]')?.click();
    if (action === "choose-cover") root.querySelector('[data-file-input="cover"]')?.click();
    if (action === "choose-markdown") requestMarkdownImport();
    if (action === "insert-existing-image") insertRawAtCursor(`\n![請填寫圖片說明](${target.dataset.path})\n`);
    if (action === "remove-cover") { state.editor.featureImage = ""; state.editor.featureImageAlt = ""; markDirty(); renderEditor(); }
    if (action === "compare-recovery") showRecoveryComparison();
    if (action === "discard-recovery") { clearLocalDraft(); state.recovery = null; renderEditor(); }
    if (action === "undo-import") undoMarkdownImport();
    if (action === "logout") logout();
    if (action === "sync-inbox") void syncAndImportInbox();
    if (action === "import-inbox") void importInboxRow(target.dataset.id);
  });

  root.addEventListener("input", (event) => {
    if (state.busy) return;
    if (event.target.matches("[data-search]")) {
      state.query = event.target.value;
      const list = root.querySelector("[data-article-list]");
      if (list) list.innerHTML = articleRows();
      return;
    }
    if (event.target.matches("[data-field]")) {
      if (!state.editor) return;
      state.editor[event.target.dataset.field] = event.target.value;
      markDirty();
    }
  });

  root.addEventListener("change", (event) => {
    if (state.busy) return;
    const input = event.target.closest("[data-file-input]");
    if (input) {
      const files = input.files;
      if (input.dataset.fileInput === "body") void addImages(files, { insert: true });
      if (input.dataset.fileInput === "cover") void addImages(files, { cover: true, insert: false });
      if (input.dataset.fileInput === "markdown") void importMarkdownAndImages(files);
      input.value = "";
      return;
    }
    if (event.target.matches("[data-field]")) {
      if (!state.editor) return;
      state.editor[event.target.dataset.field] = event.target.value;
      markDirty();
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (!state.dirty) return;
    persistLocalDraftNow();
    event.preventDefault();
    event.returnValue = "";
  });

  if (!root || !core || !github) {
    document.body.textContent = "管理台必要檔案沒有載入，請重新整理頁面。";
    return;
  }
  void resumeSession();
})();
