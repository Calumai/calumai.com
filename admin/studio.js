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
  const MAX_IMAGE_BATCH_COUNT = 20;
  const MAX_PENDING_IMAGE_COUNT = 30;
  const MAX_PENDING_IMAGE_BYTES = 48 * 1024 * 1024;
  const MAX_EXISTING_PREVIEW_COUNT = 100;
  const MAX_EXISTING_PREVIEW_BYTES = 64 * 1024 * 1024;
  const PUBLIC_REGISTRY = "https://calumai.com/blog/published-posts.json";
  const PUBLIC_DEPLOY_STATUS = "https://calumai.com/admin/deploy-status.json";
  const PUBLIC_FETCH_TIMEOUT_MS = 8000;
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
    assetDescriptions: new Map(),
    assetLoadFailures: new Set(),
    assetLoadLimitMessage: "",
    pendingAssets: new Map(),
    assetsLoading: false,
    assetLoadToken: 0,
    deployments: new Map(),
    livePosts: new Map(),
    liveRegistryChecked: false,
    liveDeploymentChecked: false,
    liveDeploymentContainsHead: false,
    contentHeadSha: "",
    recovery: null,
    conflictDetected: false,
    importUndo: null,
    draftTimer: 0,
    sessionVersion: 0,
    lastArticleSyncAt: 0,
    articleRefreshGeneration: 0,
    articleOpenGeneration: 0,
  };

  function escape(value) {
    return core.escapeHtml(value);
  }

  function sleep(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }

  async function readPublicJson(url, timeoutMs = PUBLIC_FETCH_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { cache: "no-store", signal: controller.signal });
      if (!response.ok) throw new Error(`Public status request failed: ${response.status}`);
      return await response.json();
    } catch (error) {
      if (controller.signal.aborted) {
        const timeoutError = new Error("公開網站狀態讀取逾時。");
        timeoutError.code = "PUBLIC_STATUS_TIMEOUT";
        throw timeoutError;
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
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
    toast.setAttribute("role", tone === "danger" ? "alert" : "status");
    toast.textContent = message;
    region.append(toast);
    window.setTimeout(() => toast.remove(), duration);
  }

  function revokeAssetUrls() {
    state.assetLoadToken += 1;
    state.assetsLoading = false;
    for (const url of new Set(state.assetUrls.values())) {
      if (String(url).startsWith("blob:")) URL.revokeObjectURL(url);
    }
    state.assetUrls.clear();
    state.assetDescriptions.clear();
    state.assetLoadFailures.clear();
    state.assetLoadLimitMessage = "";
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

  function recoveryPendingAssets() {
    return state.recovery?.pendingAssets instanceof Map ? state.recovery.pendingAssets : new Map();
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
    if (blockPendingAssets && (state.pendingAssets.size || recoveryPendingAssets().size)) {
      if (!persistLocalDraftNow()) {
        blockEditorTransition("本機草稿儲存失敗，已停止切換。請先複製文章內容或釋放瀏覽器儲存空間後再試。");
        return false;
      }
      blockEditorTransition(recoveryPendingAssets().size
        ? "另一台電腦修改期間，你上傳的圖片仍保留在版本比較裡。請先選擇要使用的版本，再按「儲存草稿」，才能切換文章。"
        : "還有尚未儲存的圖片。請先按「儲存草稿」把圖片存到 GitHub，再切換文章。");
      return false;
    }
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
    if (!preserveImportUndo && state.importUndo) {
      state.importUndo = null;
      root.querySelector("[data-import-undo-banner]")?.remove();
    }
    state.dirty = true;
    state.editorRevision += 1;
    state.previewFingerprint = "";
    updateSaveState("尚未存到 GitHub", "warning");
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

  function captureEditorFocus() {
    if (TEST_MODE) return null;
    const active = document.activeElement;
    if (!(active instanceof HTMLElement) || !root.contains(active)) return null;
    const token = {
      field: active.dataset.field || "",
      action: active.dataset.action || "",
      format: active.dataset.format || "",
      imageAltPath: active.dataset.imageAltPath || "",
    };
    if (!Object.values(token).some(Boolean)) return null;
    if (typeof active.selectionStart === "number") {
      token.selectionStart = active.selectionStart;
      token.selectionEnd = active.selectionEnd;
    }
    return token;
  }

  function restoreEditorFocus(token) {
    if (!token || TEST_MODE) return;
    const candidates = [...root.querySelectorAll("[data-field], [data-action], [data-format], [data-image-alt-path]")];
    const target = candidates.find((candidate) => (
      (token.field && candidate.dataset.field === token.field)
      || (token.imageAltPath && candidate.dataset.imageAltPath === token.imageAltPath)
      || (token.action && candidate.dataset.action === token.action)
      || (token.format && candidate.dataset.format === token.format)
    ));
    if (!(target instanceof HTMLElement)) return;
    target.focus({ preventScroll: true });
    if (typeof token.selectionStart === "number" && typeof target.setSelectionRange === "function") {
      const length = String(target.value || "").length;
      target.setSelectionRange(Math.min(token.selectionStart, length), Math.min(token.selectionEnd, length));
    }
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

  function deploymentTrackerIsCurrent(articleId, commitSha) {
    const deployment = deploymentFor(articleId);
    return Boolean(deployment?.commitSha) && String(deployment.commitSha) === String(commitSha);
  }

  function deploymentCanFinish(registryMatchesMode, currentHeadChecked, containsCurrentHead) {
    return Boolean(registryMatchesMode && currentHeadChecked && containsCurrentHead);
  }

  function sourceRemovalState(article = state.editor) {
    if (!article?.id || !state.loaded) {
      return { allowed: false, reason: "這篇文章尚未存到 GitHub，沒有可移除的來源檔案。" };
    }
    if (article.status === "published") {
      return { allowed: false, reason: "請先按「暫時下架」，並等網站確認完成後再移除文章。" };
    }
    if (!state.liveRegistryChecked) {
      return { allowed: false, reason: "正在確認公開文章清單；確認完成前不會移除文章。" };
    }
    if (state.livePosts.has(article.id)) {
      return { allowed: false, reason: "公開頁仍存在，請等待下架完成後再移除文章。" };
    }
    return { allowed: true, reason: "公開頁已確認下架，可以安全移除文章來源。" };
  }

  function sidebar() {
    const inboxCount = state.inbox.filter((row) => row.canImport).length;
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
      <div class="page-heading"><div><h1 tabindex="-1" data-page-heading>文章</h1><p>草稿不會出現在網站。按下發布後，這裡會一路顯示到真正上線。</p></div><div class="page-heading-actions"><button class="button" type="button" data-action="refresh-articles" ${state.loading ? "disabled" : ""}>${state.loading ? "正在同步…" : "同步最新內容"}</button><button class="button button--primary" type="button" data-action="new-article">新增文章</button></div></div>
      ${state.pageError ? `<div class="error-banner" role="alert" tabindex="-1" data-focus-error>${escape(state.pageError)}</div>` : ""}
      <div class="toolbar-line"><label class="search-wrap"><span class="sr-only">搜尋文章</span><input class="search-input" type="search" value="${escape(state.query)}" placeholder="輸入標題、摘要或分類" data-search></label>
        <div class="segment" aria-label="文章狀態">
          <button type="button" data-filter="all" aria-pressed="${state.filter === "all"}">全部</button>
          <button type="button" data-filter="draft" aria-pressed="${state.filter === "draft"}">草稿</button>
          <button type="button" data-filter="awaiting_human_review" aria-pressed="${state.filter === "awaiting_human_review"}">待確認</button>
          <button type="button" data-filter="published" aria-pressed="${state.filter === "published"}">已公開</button>
        </div>
      </div>
      <section class="panel article-list" aria-label="文章清單" aria-busy="${state.loading}" data-article-list>${articleRows()}</section>
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

  function previewAssetFailures() {
    const required = new Set(core.extractAssetPaths(state.editor?.body || "").map((value) => decodePath(normalizeAssetKey(value)).toLowerCase()));
    if (state.editor?.featureImage && !/^https?:\/\//i.test(state.editor.featureImage)) {
      required.add(decodePath(normalizeAssetKey(state.editor.featureImage)).toLowerCase());
    }
    return [...state.assetLoadFailures].filter((value) => required.has(decodePath(normalizeAssetKey(value)).toLowerCase()));
  }

  function unloadedExistingRequiredAssets() {
    const existing = new Map(assetEntries().map((item) => [decodePath(normalizeAssetKey(item.path)).toLowerCase(), item.path]));
    const required = [...core.extractAssetPaths(state.editor?.body || "")];
    if (state.editor?.featureImage && !/^https?:\/\//i.test(state.editor.featureImage)) required.unshift(state.editor.featureImage);
    return [...new Set(required.map((value) => decodePath(normalizeAssetKey(value)).toLowerCase()))]
      .filter((key) => key && existing.has(key) && !assetUrlFor(existing.get(key)));
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
    if (url) return `<img class="cover-preview" src="${escape(url)}" alt="">`;
    if (state.editor?.featureImage && state.assetsLoading) return `<span class="cover-empty"><strong>正在載入封面…</strong>你可以先編輯文章，不用等圖片。</span>`;
    if (state.editor?.featureImage) return `<span class="cover-empty"><strong>目前讀不到這張封面</strong>可重新選圖，預覽與發布也會再次檢查。</span>`;
    return `<span class="cover-empty"><strong>選一張文章封面</strong>從電腦選圖，不需要先搬到 assets 資料夾。</span>`;
  }

  function assetDescriptionKey(path) {
    return decodePath(normalizeAssetKey(path)).toLowerCase();
  }

  function normalizedAssetDescriptions(value) {
    const entries = value instanceof Map ? value : new Map(value || []);
    return new Map([...entries].map(([path, description]) => [assetDescriptionKey(path), description]));
  }

  function assetDescriptionFor(path) {
    const descriptionKey = assetDescriptionKey(path);
    if (state.assetDescriptions.has(descriptionKey)) return state.assetDescriptions.get(descriptionKey);
    const bodyAlt = core.imageAltFor(state.editor?.body || "", path);
    if (bodyAlt) return bodyAlt;
    const target = decodePath(normalizeAssetKey(path)).toLowerCase();
    const cover = decodePath(normalizeAssetKey(state.editor?.featureImage)).toLowerCase();
    return target && target === cover ? state.editor?.featureImageAlt || "" : "";
  }

  function assetIsUsed(path) {
    const target = decodePath(normalizeAssetKey(path)).toLowerCase();
    if (!target) return false;
    if (decodePath(normalizeAssetKey(state.editor?.featureImage)).toLowerCase() === target) return true;
    return core.extractAssetPaths(state.editor?.body || "")
      .some((value) => decodePath(normalizeAssetKey(value)).toLowerCase() === target);
  }

  function assetThumbMarkup(item) {
    if (item.url) return `<img src="${escape(item.url)}" alt="">`;
    const failed = state.assetLoadFailures.has(item.path);
    return `<span class="asset-thumb-placeholder" aria-hidden="true">${failed ? "!" : state.assetsLoading ? "…" : "圖"}</span>`;
  }

  function cleanImageDescription(value) {
    return String(value || "").replace(/[\r\n]+/g, " ").replace(/[\[\]]/g, "").replace(/\s+/g, " ").trim();
  }

  function updateFeatureImageDescription(value) {
    if (!state.editor) return false;
    state.editor.featureImageAlt = String(value || "");
    const featurePath = state.editor.featureImage;
    if (!featurePath) return false;
    const description = cleanImageDescription(value);
    state.assetDescriptions.set(assetDescriptionKey(featurePath), description);
    const nextBody = core.replaceImageAlt(state.editor.body || "", featurePath, description);
    const bodyChanged = nextBody !== state.editor.body;
    if (bodyChanged) state.editor.body = nextBody;
    return bodyChanged;
  }

  function insertExistingImage(target) {
    const path = target?.dataset.path || "";
    const input = target?.closest("[data-asset-path]")?.querySelector("[data-image-alt-path]");
    const description = cleanImageDescription(input?.value || assetDescriptionFor(path));
    if (!description || description === "請填寫圖片說明") {
      if (input) {
        input.setAttribute("aria-invalid", "true");
        input.focus();
      }
      showToast("請先寫一句圖片說明，再插入內文。", "danger", 7000);
      return false;
    }
    if (input) {
      input.value = description;
      input.removeAttribute("aria-invalid");
    }
    state.assetDescriptions.set(assetDescriptionKey(path), description);
    insertRawAtCursor(`\n![${description}](${path})\n`);
    if (!assetUrlFor(path) && !state.pendingAssets.has(path)) retryAssetLoading();
    return true;
  }

  function focusImageDescription(path) {
    if (TEST_MODE || !path) return;
    window.requestAnimationFrame(() => {
      const target = [...root.querySelectorAll("[data-image-alt-path]")]
        .find((input) => input.dataset.imageAltPath === path);
      if (!(target instanceof HTMLElement)) return;
      target.focus({ preventScroll: false });
    });
  }

  function assetListMarkup() {
    const items = assetEntries();
    if (!items.length) return `<p class="field-hint">目前還沒有文章圖片。</p>`;
    return items.map((item) => {
      const fileName = item.path.replace(/^assets\//, "");
      const description = assetDescriptionFor(item.path);
      const pendingLabel = item.pending
        ? assetIsUsed(item.path) ? "（尚未存到 GitHub）" : "（尚未使用、尚未存到 GitHub）"
        : "";
      const used = assetIsUsed(item.path);
      return `<div class="asset-item" data-asset-path="${escape(item.path)}"><span class="asset-thumb-slot" data-asset-thumb>${assetThumbMarkup(item)}</span><span class="asset-filename">${escape(fileName)}${pendingLabel}</span><label class="asset-alt"><span>圖片說明</span><input type="text" value="${escape(description)}" placeholder="例如：學生操作網站的畫面" aria-label="${escape(`${fileName} 的圖片說明`)}" data-image-alt-path="${escape(item.path)}"></label><span class="asset-actions"><button type="button" data-action="insert-existing-image" data-path="${escape(item.path)}" aria-label="把 ${escape(fileName)} 插入內文">插入內文</button>${item.pending ? `<button type="button" class="asset-remove" data-action="request-remove-pending" data-path="${escape(item.path)}" aria-label="移除尚未儲存的 ${escape(fileName)}">移除</button>` : used ? `<button type="button" class="asset-remove" data-action="request-unlink-image" data-path="${escape(item.path)}" aria-label="把 ${escape(fileName)} 從文章移除">從文章移除</button>` : ""}</span></div>`;
    }).join("");
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
    const linkLabel = deployment.stage === "failed" ? "查看失敗原因" : deployment.stage === "live" ? "打開公開文章" : "查看發布進度";
    const retry = deployment.stage === "failed" ? `<button class="button button--small" type="button" data-action="retry-deployment">重新確認發布狀態</button>` : "";
    return `<section class="panel progress-panel" aria-live="polite"><h3>${deployment.stage === "failed" ? "這次發布沒有完成" : "發布進度"}</h3><div class="progress-steps">${steps.map(([key, label], index) => {
      let stepState = index < current ? "done" : index === current ? "active" : "waiting";
      if (deployment.stage === "failed" && index === Math.max(0, deployment.failedAt || 1)) stepState = "failed";
      return `<div class="progress-step" data-state="${stepState}">${escape(label)}</div>`;
    }).join("")}</div>${deployment.message ? `<p class="field-hint">${escape(deployment.message)}</p>` : ""}<div class="progress-actions">${deployment.url ? `<a class="button button--small" href="${escape(deployment.url)}" target="_blank" rel="noopener">${linkLabel}</a>` : ""}${retry}</div></section>`;
  }

  function publicationMessageFor(article = state.editor) {
    if (!article) return "";
    const publicStatus = visibleStatus(article);
    if (state.recovery) return "先比較 GitHub 與這台電腦保留的版本，選好後才會開放儲存與發布。";
    if (publicStatus.state === "live") return "這篇目前在網站上。修改後先預覽，再用上方按鈕更新網站。";
    if (publicStatus.state === "unpublish-pending") return "已改回草稿；公開網站仍是較早版本，正在等待下架。";
    if (article.status === "published") return "這篇已設為公開，但網站可能仍在等待部署；請以狀態標籤為準。";
    return "存草稿不會公開；只有按上方的發布才會出現在網站。";
  }

  function publicLinkMarkup(articleId = state.editor?.id) {
    const publicPost = state.livePosts.get(articleId) || null;
    return publicPost?.url
      ? `<div class="public-link-row"><a class="button button--small" href="${escape(publicPost.url)}" target="_blank" rel="noopener">打開公開文章</a></div>`
      : "";
  }

  function removalMarkup(article = state.editor) {
    if (!article || !state.loaded || state.recovery) return "";
    const removal = sourceRemovalState(article);
    return removal.allowed
      ? `<section class="panel aside-card danger-zone"><h2>移除文章</h2><p>公開頁已確認下架；這會移除文章來源與圖片，GitHub 仍保留歷史紀錄。</p><button class="button button--danger button--small" type="button" data-action="request-delete">移除這篇文章</button></section>`
      : `<section class="panel aside-card"><h2>移除文章</h2><p>${escape(removal.reason)}</p></section>`;
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
      const message = root.querySelector("[data-publication-message]");
      if (message) message.textContent = publicationMessageFor(state.editor);
      const publicLink = root.querySelector("[data-public-link-slot]");
      if (publicLink) publicLink.innerHTML = publicLinkMarkup(articleId);
      const removal = root.querySelector("[data-removal-slot]");
      if (removal) removal.innerHTML = removalMarkup(state.editor);
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
    if (state.recovery) {
      return `<button class="button button--small" type="button" data-action="preview">預覽 GitHub 版本</button><button class="button button--primary button--small" type="button" data-action="compare-recovery">先比較版本</button>`;
    }
    return `<button class="button button--small" type="button" data-action="preview">預覽</button>
      ${published
        ? `<button class="button button--primary button--small" type="button" data-action="request-publish">儲存並更新網站</button>`
        : `<button class="button button--small" type="button" data-action="save-draft">儲存草稿</button><button class="button button--primary button--small" type="button" data-action="request-publish">發布</button>`}`;
  }

  function renderEditor() {
    const focusToken = captureEditorFocus();
    const article = state.editor;
    if (!article) return renderArticles();
    const title = article.title || "新增文章";
    const published = article.status === "published";
    const publicStatus = visibleStatus(article);
    const recoveryImageCount = recoveryPendingAssets().size;
    const content = `<div class="content content--editor">
      <div class="page-heading editor-heading"><div><button class="button button--quiet back-button" type="button" data-action="back-to-list">返回文章清單</button><h1 tabindex="-1" data-page-heading>${escape(title)}</h1></div><div class="save-state" data-save-state data-tone="${state.dirty ? "warning" : "success"}"><span class="save-dot" aria-hidden="true"></span><span>${state.dirty ? "尚未存到 GitHub" : state.loaded ? "已存到 GitHub" : "新文章"}</span></div></div>
      ${state.recovery ? `<div class="error-banner" role="status">${state.recovery.conflict ? "這台電腦留有一份較早、尚未存上 GitHub 的版本。先比較再決定，不會自動蓋掉雲端內容。" : "這台電腦留有一份尚未存到 GitHub 的文字。"}${recoveryImageCount ? ` 你剛上傳的 ${recoveryImageCount} 張圖片也還安全留在這個分頁。` : ""}${state.recovery.alternates?.length ? ` 另外還安全保留 ${state.recovery.alternates.length} 份較早版本。` : ""}<button class="button button--small" type="button" data-action="compare-recovery">比較版本</button> <button class="button button--quiet button--small" type="button" data-action="discard-recovery">保留 GitHub 版本</button></div>` : ""}
      ${state.importUndo ? `<div class="error-banner" role="status" data-import-undo-banner>已帶入 Markdown 內容。<button class="button button--small" type="button" data-action="undo-import">撤銷這次匯入</button></div>` : ""}
      ${state.pendingAssets.size ? `<div class="pending-banner" role="status"><strong>${state.pendingAssets.size} 張圖片還只在這個分頁。</strong>關閉或重新整理後圖片無法復原；請先按「儲存草稿」存到 GitHub。</div>` : ""}
      ${state.pageError ? `<div class="error-banner" role="alert" tabindex="-1" data-focus-error>${escape(state.pageError)}${state.conflictDetected ? ` <button class="button button--small" type="button" data-action="reload-conflict">讀取 GitHub 版本並比較</button>` : ""}</div>` : ""}
      <div class="editor-grid">
        <section class="panel editor-card">
          <label class="field"><span class="field-label">標題 <span class="field-hint">讀者第一眼看到的文字</span></span><input type="text" maxlength="100" value="${escape(article.title)}" data-field="title" placeholder="這篇文章想告訴大家什麼？"></label>
          <label class="field"><span class="field-label">文章摘要 <span class="field-hint">可以留空，系統會幫你擷取</span></span><textarea data-field="excerpt" maxlength="260" placeholder="用一兩句話說明這篇文章">${escape(article.excerpt)}</textarea></label>
          <label class="field"><span class="field-label">分類</span><select data-field="category">${categoryOptions(article.category)}</select></label>
          <div class="field"><span class="field-label" id="article-body-label">文章內文 <span class="field-hint">直接打字即可</span></span>
            <div class="markdown-wrap"><div class="markdown-toolbar" aria-label="文字工具">
              <button class="toolbar-button" type="button" data-format="heading">小標題</button>
              <button class="toolbar-button" type="button" data-format="bold">粗體</button>
              <button class="toolbar-button" type="button" data-format="quote">引言</button>
              <button class="toolbar-button" type="button" data-format="list">清單</button>
              <span class="toolbar-separator" aria-hidden="true"></span>
              <button class="toolbar-button" type="button" data-action="choose-body-images">放圖片</button>
              <button class="toolbar-button" type="button" data-action="choose-markdown">匯入現成講義</button>
            </div><textarea class="article-body-input" data-field="body" data-body-input aria-labelledby="article-body-label" placeholder="從這裡開始寫文章…">${escape(article.body)}</textarea></div>
            <p class="field-hint">不用懂 Markdown；使用上方按鈕排版，預覽會顯示讀者最後看到的樣子。</p>
          </div>
        </section>
        <aside class="editor-aside">
          <section class="panel aside-card"><h2>封面</h2><p>會顯示在文章上方與部落格列表。</p><button class="cover-drop" type="button" data-action="choose-cover" aria-label="選擇或更換封面圖片">${coverMarkup()}</button><div class="cover-actions"><button class="button button--small" type="button" data-action="choose-cover">更換</button>${article.featureImage ? `<button class="button button--quiet button--small" type="button" data-action="remove-cover">移除</button>` : ""}</div><label class="field field--cover-alt"><span class="field-label">圖片說明</span><input type="text" value="${escape(article.featureImageAlt)}" data-field="featureImageAlt" placeholder="例如：遊戲首頁操作畫面"></label></section>
          <section class="panel aside-card"><h2>儲存與發布</h2><p data-publication-message>${publicationMessageFor(article)}</p><span class="status-badge" data-current-status data-tone="${escape(publicStatus.tone)}">${escape(publicStatus.label)}</span><div data-public-link-slot>${publicLinkMarkup(article.id)}</div>${published && !state.recovery ? `<div class="danger-zone"><button class="button button--quiet button--small" type="button" data-action="request-unpublish">暫時下架</button></div>` : ""}</section>
          <div data-deployment-slot>${deploymentMarkup()}</div>
          <section class="panel aside-card"><h2>文章圖片</h2><p>同一張圖可以再次插入，不用重傳；圖片說明可直接在這裡修改。</p><div class="asset-toolbar"><button class="button button--small" type="button" data-action="choose-body-images">上傳並插入圖片</button><button class="button button--small" type="button" data-action="retry-assets" ${state.assetLoadFailures.size || state.assetLoadLimitMessage ? "" : "hidden"}>重新載入圖片</button></div><p class="field-hint" role="status" data-assets-loading ${state.assetsLoading ? "" : "hidden"}>文章需要的圖片正在背景載入，你可以先繼續寫文章。</p><p class="asset-load-error" role="alert" data-assets-error ${state.assetLoadLimitMessage ? "" : "hidden"}>${escape(state.assetLoadLimitMessage)}</p><div class="asset-list" data-asset-list>${assetListMarkup()}</div></section>
          <section class="panel aside-card"><h2>新手安心檢查</h2><div class="tip-list"><div class="tip"><span class="tip-number">1</span><span>先按預覽，確認標題、清單與圖片位置。</span></div><div class="tip"><span class="tip-number">2</span><span>發布時文章和圖片會一起存，不會分家。</span></div><div class="tip"><span class="tip-number">3</span><span>看到「已在網站上線」才是真的完成。</span></div></div></section>
          <div data-removal-slot>${removalMarkup(article)}</div>
        </aside>
      </div>
      <input hidden type="file" accept="image/*" multiple data-file-input="body">
      <input hidden type="file" accept="image/*" data-file-input="cover">
      <input hidden type="file" accept=".md,text/markdown,image/*" multiple data-file-input="markdown">
    </div>`;
    root.innerHTML = shell(content, editorActions());
    restoreEditorFocus(focusToken);
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
        : row.inboxDispositionLabel
          ? statusBadge("draft", row.inboxDispositionLabel)
        : row.canImport
          ? `<button class="button button--small" type="button" data-action="import-inbox" data-id="${escape(row.id)}">帶入文章清單</button>`
          : statusBadge("awaiting_human_review", "資料不完整");
      return `<section class="panel inbox-card"><div class="inbox-copy"><span class="inbox-id">${escape(row.id)}</span><h2>${escape(title)}</h2><p class="inbox-excerpt">${escape(excerpt)}</p><p class="inbox-meta">${row.imageCount} 張圖片 · ${row.hasImageSources ? "有圖片來源說明" : "缺圖片來源說明"}</p>${integrity}</div>${action}</section>`;
    }).join("");
    const body = state.loading
      ? `<section class="panel skeleton" role="status" aria-live="polite"><span class="sr-only">正在同步 GitHub 收件匣…</span><div class="skeleton-line"></div><div class="skeleton-line"></div><div class="skeleton-line"></div></section>`
      : state.inbox.length
        ? `<div class="inbox-list">${rows}</div>`
        : `<section class="panel empty-state"><strong>收件匣目前沒有新稿</strong><p>其他電腦推送的新文章，按同步後會出現在這裡。</p></section>`;
    const content = `<div class="content" aria-busy="${state.loading}"><div class="page-heading"><div><h1 tabindex="-1" data-page-heading>GitHub 收件匣</h1><p>按一次就讀取私人收件匣，文章和圖片會一起帶進文章清單。</p></div><button class="button button--primary" type="button" data-action="sync-inbox" ${state.loading ? "disabled" : ""}>${available.length ? `同步並帶入 ${available.length} 篇` : "同步收件匣"}</button></div>${state.pageError ? `<div class="error-banner" role="alert" tabindex="-1" data-focus-error>${escape(state.pageError)}</div>` : ""}${body}</div>`;
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
    const session = sessionSnapshot();
    if (!session.client) return false;
    const generation = ++state.articleRefreshGeneration;
    const result = await session.client.listArticles();
    if (!sessionIsCurrent(session) || generation !== state.articleRefreshGeneration) return false;
    const requiredHeadSha = String(result.headSha || "");
    const nextArticles = result.articles.map((item) => ({ ...core.parseArticle(item.raw, item.id), articleSha: item.articleSha }));
    let nextLivePosts = new Map();
    let nextRegistryChecked = false;
    let nextDeploymentChecked = false;
    let nextDeploymentContainsHead = false;
    const cacheKey = Date.now();
    const [registryResult, deploymentResult] = await Promise.allSettled([
      readPublicJson(`${PUBLIC_REGISTRY}?studio-list=${cacheKey}`),
      readPublicJson(`${PUBLIC_DEPLOY_STATUS}?studio-list=${cacheKey}`),
    ]);
    if (!sessionIsCurrent(session) || generation !== state.articleRefreshGeneration) return false;

    if (registryResult.status === "fulfilled" && Array.isArray(registryResult.value)) {
      nextLivePosts = new Map(registryResult.value.map((item) => [item.submissionId, item]));
      nextRegistryChecked = true;
    }
    if (deploymentResult.status === "fulfilled") {
      const deployedSha = String(deploymentResult.value?.sourceSha || "");
      if (requiredHeadSha && deployedSha) {
        try {
          const containsHead = await session.client.deploymentContainsCommit(requiredHeadSha, deployedSha);
          if (!sessionIsCurrent(session) || generation !== state.articleRefreshGeneration) return false;
          nextDeploymentContainsHead = containsHead;
          nextDeploymentChecked = true;
        } catch {
          // Keep the status unconfirmed when GitHub cannot compare the commits.
        }
      }
    }
    if (!sessionIsCurrent(session) || generation !== state.articleRefreshGeneration) return false;
    state.articles = nextArticles;
    state.contentHeadSha = requiredHeadSha;
    state.livePosts = nextLivePosts;
    state.liveRegistryChecked = nextRegistryChecked;
    state.liveDeploymentChecked = nextDeploymentChecked;
    state.liveDeploymentContainsHead = nextDeploymentContainsHead;
    state.lastArticleSyncAt = Date.now();
    return true;
  }

  async function refreshArticles({ announce = true } = {}) {
    if (!state.client || state.loading || state.busy) return false;
    const session = sessionSnapshot();
    state.loading = true;
    state.pageError = "";
    if (state.route === "articles") renderArticles();
    let generation = state.articleRefreshGeneration;
    try {
      const loading = loadArticles();
      generation = state.articleRefreshGeneration;
      const loaded = await loading;
      if (!loaded || !sessionIsCurrent(session) || generation !== state.articleRefreshGeneration) return false;
      if (announce) showToast("已同步 GitHub 上的最新文章。", "success");
      return true;
    } catch (error) {
      if (!sessionIsCurrent(session) || generation !== state.articleRefreshGeneration) return false;
      state.pageError = `暫時無法同步最新文章：${errorMessage(error)}`;
      return false;
    } finally {
      if (sessionIsCurrent(session) && generation === state.articleRefreshGeneration) {
        state.loading = false;
        if (state.route === "articles") {
          renderArticles();
          if (state.pageError) focusMain();
        }
      }
    }
  }

  function refreshArticleListInBackground() {
    const session = sessionSnapshot();
    if (!session.client) return;
    const generation = ++state.articleRefreshGeneration;
    void session.client.listArticles().then((result) => {
      if (!sessionIsCurrent(session) || generation !== state.articleRefreshGeneration) return;
      state.articles = result.articles.map((item) => ({ ...core.parseArticle(item.raw, item.id), articleSha: item.articleSha }));
      state.contentHeadSha = String(result.headSha || state.contentHeadSha || "");
      if (state.route === "articles") {
        const list = root.querySelector("[data-article-list]");
        if (list) list.innerHTML = articleRows();
      }
    }).catch((error) => {
      if (!sessionIsCurrent(session) || generation !== state.articleRefreshGeneration) return;
      showToast(`資料已存好；文章清單稍後再同步：${errorMessage(error)}`, "danger", 7000);
    });
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
    state.conflictDetected = false;
    state.importUndo = null;
    state.route = "editor";
    state.articleOpenGeneration += 1;
    state.articleRefreshGeneration += 1;
    state.loading = false;
    render();
    focusMain();
    return true;
  }

  function requiredExistingImageEntries(article = state.editor, loaded = state.loaded) {
    if (!article || !loaded) return { prefix: "", entries: [] };
    const prefix = `posts/${article.id}/`;
    const imageEntries = (loaded.files || []).filter((file) => {
      const relative = relativeAssetPathFor(file.path, prefix);
      return /^assets\//i.test(relative) && /\.(?:png|jpe?g|webp|gif|avif|svg)$/i.test(relative);
    });
    const byKey = new Map(imageEntries.map((entry) => [
      decodePath(normalizeAssetKey(relativeAssetPathFor(entry.path, prefix))).toLowerCase(),
      entry,
    ]));
    const requiredKeys = [...core.extractAssetPaths(article.body || "")];
    if (article.featureImage && !/^https?:\/\//i.test(article.featureImage)) requiredKeys.unshift(article.featureImage);
    const entries = [];
    const seen = new Set();
    for (const value of requiredKeys) {
      const key = decodePath(normalizeAssetKey(value)).toLowerCase();
      const entry = byKey.get(key);
      if (!entry || seen.has(entry.path)) continue;
      seen.add(entry.path);
      entries.push(entry);
    }
    return { prefix, entries };
  }

  function previewAssetLimitMessage(article = state.editor, loaded = state.loaded) {
    const { entries } = requiredExistingImageEntries(article, loaded);
    const requiredBytes = entries.reduce((total, entry) => total + Number(entry.size || 0), 0);
    if (entries.length <= MAX_EXISTING_PREVIEW_COUNT && requiredBytes <= MAX_EXISTING_PREVIEW_BYTES) return "";
    const sizeMb = Math.max(1, Math.ceil(requiredBytes / 1024 / 1024));
    return `這篇文章一次引用 ${entries.length} 張、約 ${sizeMb} MB 的圖片，超過後台安全預覽上限。請用「從文章移除」減少圖片，或先在電腦縮小圖片再重新上傳。`;
  }

  function releaseUnreferencedAssetUrls(article = state.editor) {
    const required = new Set(core.extractAssetPaths(article?.body || "")
      .map((value) => decodePath(normalizeAssetKey(value)).toLowerCase()));
    if (article?.featureImage && !/^https?:\/\//i.test(article.featureImage)) {
      required.add(decodePath(normalizeAssetKey(article.featureImage)).toLowerCase());
    }
    const pendingUrls = new Set([...state.pendingAssets.values()].map((item) => item.url));
    const urls = new Map();
    for (const [key, url] of state.assetUrls) {
      if (!urls.has(url)) urls.set(url, []);
      urls.get(url).push(key);
    }
    for (const [url, keys] of urls) {
      const stillUsed = pendingUrls.has(url) || keys.some((key) => required.has(decodePath(normalizeAssetKey(key)).toLowerCase()));
      if (stillUsed) continue;
      for (const key of keys) state.assetUrls.delete(key);
      if (String(url).startsWith("blob:")) URL.revokeObjectURL(url);
    }
  }

  function refreshAssetView() {
    if (state.route !== "editor" || !state.editor) return;
    const cover = root.querySelector(".cover-drop");
    if (cover) cover.innerHTML = coverMarkup();
    const entries = new Map(assetEntries().map((item) => [item.path, item]));
    for (const row of root.querySelectorAll("[data-asset-path]")) {
      const item = entries.get(row.dataset.assetPath);
      const thumb = row.querySelector("[data-asset-thumb]");
      if (item && thumb) thumb.innerHTML = assetThumbMarkup(item);
    }
    const loading = root.querySelector("[data-assets-loading]");
    if (loading) loading.hidden = !state.assetsLoading;
    const retry = root.querySelector("[data-action='retry-assets']");
    if (retry) retry.hidden = !(state.assetLoadFailures.size || state.assetLoadLimitMessage);
    const error = root.querySelector("[data-assets-error]");
    if (error) {
      error.hidden = !state.assetLoadLimitMessage;
      error.textContent = state.assetLoadLimitMessage;
    }
  }

  async function loadAssetUrls(article, loaded, loadToken) {
    const { prefix, entries: requiredEntries } = requiredExistingImageEntries(article, loaded);
    releaseUnreferencedAssetUrls(article);
    const requiredPathKeys = new Set(requiredEntries.map((entry) => (
      decodePath(normalizeAssetKey(relativeAssetPathFor(entry.path, prefix))).toLowerCase()
    )));
    for (const failure of [...state.assetLoadFailures]) {
      if (!requiredPathKeys.has(decodePath(normalizeAssetKey(failure)).toLowerCase())) state.assetLoadFailures.delete(failure);
    }
    state.assetLoadLimitMessage = previewAssetLimitMessage(article, loaded);
    if (state.assetLoadLimitMessage) {
      for (const entry of requiredEntries) {
        const relative = relativeAssetPathFor(entry.path, prefix);
        if (!assetUrlFor(relative)) state.assetLoadFailures.add(relative);
      }
      return;
    }
    state.assetLoadLimitMessage = "";
    const pendingPaths = new Set([...state.pendingAssets.keys()].map((value) => decodePath(normalizeAssetKey(value)).toLowerCase()));
    const entriesToLoad = requiredEntries.filter((entry) => {
      const relative = relativeAssetPathFor(entry.path, prefix);
      const key = decodePath(normalizeAssetKey(relative)).toLowerCase();
      return !pendingPaths.has(key) && !assetUrlFor(relative);
    });
    const client = state.client;
    let cursor = 0;
    const worker = async () => {
      while (cursor < entriesToLoad.length && state.assetLoadToken === loadToken && state.client === client) {
        const entry = entriesToLoad[cursor];
        cursor += 1;
        const relative = relativeAssetPathFor(entry.path, prefix);
        try {
          const url = await client.blobObjectUrl(github.CONTENT_REPO, entry.sha, entry.path);
          if (state.assetLoadToken !== loadToken || state.client !== client) {
            if (String(url).startsWith("blob:")) URL.revokeObjectURL(url);
            return;
          }
          state.assetUrls.set(relative, url);
          state.assetUrls.set(decodePath(relative), url);
          state.assetUrls.set(encodeURI(decodePath(relative)), url);
          state.assetLoadFailures.delete(relative);
        } catch {
          if (state.assetLoadToken === loadToken && state.client === client) {
            state.assetLoadFailures.add(relative);
          }
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(3, entriesToLoad.length) }, worker));
  }

  function retryAssetLoading() {
    if (!state.editor || !state.loaded || state.assetsLoading) return false;
    state.assetLoadFailures.clear();
    state.assetLoadLimitMessage = "";
    state.assetsLoading = true;
    const loadToken = ++state.assetLoadToken;
    refreshAssetView();
    void loadAssetUrls(state.editor, state.loaded, loadToken).finally(() => {
      if (state.assetLoadToken !== loadToken) return;
      state.assetsLoading = false;
      refreshAssetView();
    });
    return true;
  }

  function relativeAssetPathFor(filePath, prefix) {
    return filePath.startsWith(prefix) ? filePath.slice(prefix.length) : filePath;
  }

  async function openArticle(id) {
    if (!persistEditorBeforeTransition({ confirmLeave: true, blockPendingAssets: true })) return false;
    const session = sessionSnapshot();
    if (!session.client) return false;
    const generation = ++state.articleOpenGeneration;
    state.articleRefreshGeneration += 1;
    const openIsCurrent = () => sessionIsCurrent(session) && generation === state.articleOpenGeneration;
    state.loading = true;
    state.pageError = "";
    renderLoading("正在打開文章與圖片…");
    try {
      revokeAssetUrls();
      state.pendingAssets.clear();
      const loaded = await session.client.loadArticle(id);
      if (!openIsCurrent()) return false;
      const article = core.parseArticle(loaded.raw, id);
      const sourceEntry = loaded.files.find((file) => /\/IMAGE_SOURCES\.md$/i.test(file.path));
      loaded.imageSourcesText = sourceEntry
        ? await session.client.blobText(github.CONTENT_REPO, sourceEntry.sha)
        : "";
      if (!openIsCurrent()) return false;
      state.editor = article;
      state.loaded = loaded;
      state.dirty = false;
      state.editorRevision = 0;
      state.previewFingerprint = "";
      state.recovery = findLocalDraft(id, loaded.articleSha);
      state.conflictDetected = false;
      state.importUndo = null;
      state.assetsLoading = true;
      const loadToken = ++state.assetLoadToken;
      state.route = "editor";
      render();
      focusMain();
      void loadAssetUrls(article, loaded, loadToken).finally(() => {
        if (state.assetLoadToken !== loadToken) return;
        state.assetsLoading = false;
        refreshAssetView();
      });
    } catch (error) {
      if (!openIsCurrent()) return false;
      state.route = "articles";
      state.pageError = errorMessage(error);
      render();
      focusMain();
    } finally {
      if (openIsCurrent()) state.loading = false;
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

  function pendingAssetBytes() {
    return [...state.pendingAssets.values()].reduce((total, item) => total + (item.bytes?.byteLength || 0), 0);
  }

  function linkUploadedImages(article, additions) {
    const byOriginalName = new Map();
    for (const item of additions) {
      byOriginalName.set(decodePath(item.originalName).toLowerCase(), item.path);
    }
    const matched = new Set();
    let inFence = false;
    article.body = String(article.body || "").replace(/\r\n/g, "\n").split("\n").map((line) => {
      if (/^\s*(?:```|\\`\\`\\`|~~~)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return line.replace(
        /!\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^\s)]+))(\s+["'][^"']*["'])?\s*\)/g,
        (whole, alt, anglePath, plainPath, title = "") => {
          const originalPath = decodePath(anglePath || plainPath || "").replace(/\\/g, "/");
          const originalName = originalPath.split("/").pop().toLowerCase();
          const replacement = byOriginalName.get(originalName);
          if (!replacement) return whole;
          matched.add(replacement);
          return `![${alt}](${replacement}${title})`;
        },
      );
    }).join("\n");
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
    if (images.length > MAX_IMAGE_BATCH_COUNT) {
      const error = new Error(`一次最多選 ${MAX_IMAGE_BATCH_COUNT} 張圖片，請分批上傳。`);
      error.userMessage = error.message;
      throw error;
    }
    const oversized = images.find((file) => file.size > MAX_IMAGE_BYTES);
    if (oversized) {
      const error = new Error(`${oversized.name} 超過 12 MB，請先縮小圖片。`);
      error.userMessage = error.message;
      throw error;
    }
    if (state.pendingAssets.size + images.length > MAX_PENDING_IMAGE_COUNT) {
      const error = new Error(`尚未儲存的圖片最多 ${MAX_PENDING_IMAGE_COUNT} 張。請先儲存草稿，再繼續上傳。`);
      error.userMessage = error.message;
      throw error;
    }
    const selectedBytes = images.reduce((total, file) => total + Number(file.size || 0), 0);
    if (pendingAssetBytes() + selectedBytes > MAX_PENDING_IMAGE_BYTES) {
      const error = new Error("尚未儲存的圖片合計超過 48 MB。請先儲存草稿，再繼續上傳。");
      error.userMessage = error.message;
      throw error;
    }
    const used = usedFilenames();
    const additions = [];
    for (const file of images) {
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

  function applyPreparedImages(article, additions, { cover = false, insert = true, selection = null, matchReferences = false } = {}) {
    for (const item of additions) {
      const url = URL.createObjectURL(item.file);
      item.url = url;
      state.pendingAssets.set(item.path, { path: item.path, bytes: item.bytes, url, originalName: item.originalName, type: item.type });
      state.assetUrls.set(item.path, url);
    }
    let unlinked = additions;
    if (!cover && matchReferences) unlinked = linkUploadedImages(article, additions);
    if (cover) {
      article.featureImage = additions[0].path;
      article.featureImageAlt = "請填寫圖片說明";
    }
    if (insert && unlinked.length) {
      const lines = unlinked.map((item) => `![請填寫圖片說明](${item.path})`).join("\n\n");
      const selectionEnd = Math.max(0, Math.min(selection?.end ?? article.body.length, article.body.length));
      const nextLineBreak = selection?.start !== selection?.end ? article.body.indexOf("\n", selectionEnd) : -1;
      const insertionPoint = nextLineBreak >= 0 ? nextLineBreak + 1 : selection?.start !== selection?.end ? article.body.length : selectionEnd;
      article.body = `${article.body.slice(0, insertionPoint)}\n${lines}\n${article.body.slice(insertionPoint)}`;
    }
    if (article.imageSourcePath && article.imageSourcePath !== "IMAGE_SOURCES.md" && !article.priorImageSourcePath) {
      article.priorImageSourceType = article.imageSourceType;
      article.priorImageSourcePath = article.imageSourcePath;
    }
    if (!article.imageSourceType || article.imageSourceType === "none") article.imageSourceType = "original_upload";
    article.imageSourcePath = "IMAGE_SOURCES.md";
  }

  function removePendingImage(path) {
    const item = state.pendingAssets.get(path);
    if (!item || !state.editor) return false;
    syncEditorFromDom();
    const target = decodePath(normalizeAssetKey(path)).toLowerCase();
    if (decodePath(normalizeAssetKey(state.editor.featureImage)).toLowerCase() === target) {
      state.editor.featureImage = "";
      state.editor.featureImageAlt = "";
    }
    state.editor.body = core.removeMarkdownImage(state.editor.body || "", path);
    state.pendingAssets.delete(path);
    state.assetDescriptions.delete(assetDescriptionKey(path));
    state.assetLoadFailures.delete(path);
    for (const [key, url] of [...state.assetUrls]) {
      if (url === item.url || decodePath(normalizeAssetKey(key)).toLowerCase() === target) state.assetUrls.delete(key);
    }
    if (String(item.url).startsWith("blob:")) URL.revokeObjectURL(item.url);
    markDirty();
    renderEditor();
    showToast("這張尚未儲存的圖片已移除，內文與封面引用也一起清掉。", "success");
    return true;
  }

  function requestRemovePendingImage(path) {
    const item = state.pendingAssets.get(path);
    if (!item) return false;
    const name = path.replace(/^assets\//i, "");
    showConfirm({
      title: "移除這張尚未儲存的圖片？",
      lead: `「${name}」會從這個分頁、文章內文與封面一起移除。GitHub 上既有的圖片不會受影響。`,
      confirmLabel: "移除圖片",
      danger: true,
      onConfirm: () => removePendingImage(path),
    });
    return true;
  }

  function unlinkImageFromArticle(path) {
    if (!state.editor) return false;
    syncEditorFromDom();
    const target = decodePath(normalizeAssetKey(path)).toLowerCase();
    const wasCover = decodePath(normalizeAssetKey(state.editor.featureImage)).toLowerCase() === target;
    const nextBody = core.removeMarkdownImage(state.editor.body || "", path);
    if (!wasCover && nextBody === state.editor.body) return false;
    if (wasCover) {
      state.editor.featureImage = "";
      state.editor.featureImageAlt = "";
    }
    state.editor.body = nextBody;
    markDirty();
    renderEditor();
    showToast("圖片已從文章與封面移除；GitHub 裡的原圖仍保留，可隨時再插入。", "success");
    return true;
  }

  function requestUnlinkImage(path) {
    if (!assetIsUsed(path) || state.pendingAssets.has(path)) return false;
    const name = path.replace(/^assets\//i, "");
    showConfirm({
      title: "把這張圖從文章移除？",
      lead: `「${name}」在內文中的所有位置與封面設定都會清除；GitHub 裡的原圖仍會保留，所以之後還能重新插入。`,
      confirmLabel: "從文章移除",
      danger: true,
      onConfirm: () => unlinkImageFromArticle(path),
    });
    return true;
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
    state.pageError = "";
    state.conflictDetected = false;
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
      if (cover && !TEST_MODE) {
        window.requestAnimationFrame(() => root.querySelector('[data-field="featureImageAlt"]')?.focus());
      } else if (!cover) {
        focusImageDescription(additions[0]?.path);
      }
      showToast(cover ? "封面已帶入；請補上圖片說明，再儲存草稿。" : "圖片已插入；請補上圖片說明，再儲存草稿。", "success");
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

  function mergeImportedMarkdown(currentArticle, originalMarkdown) {
    let nextArticle = { ...currentArticle };
    const parts = core.splitFrontmatter(originalMarkdown);
    if (!parts.hasFrontmatter) {
      nextArticle.body = String(originalMarkdown || "").trim();
      return nextArticle;
    }
    const stableId = nextArticle.id;
    const stableSlug = nextArticle.slug;
    const stableStatus = nextArticle.status || "draft";
    nextArticle = { ...nextArticle, ...core.parseArticle(originalMarkdown, stableId) };
    nextArticle.id = stableId || "";
    nextArticle.slug = stableId ? stableSlug : "";
    nextArticle.status = stableStatus;
    return nextArticle;
  }

  async function importMarkdownAndImages(files) {
    if (state.busy || !state.editor) return;
    syncEditorFromDom();
    const list = [...files];
    const markdownFiles = list.filter((file) => /\.md$/i.test(file.name) || file.type === "text/markdown");
    if (markdownFiles.length > 1) {
      state.pageError = "一次只能匯入一份 .md 講義。請保留要使用的那一份，再重新選擇。";
      renderEditor();
      focusMain();
      return;
    }
    const markdownFile = markdownFiles[0] || null;
    const imageFiles = supportedImageFiles(list.filter((file) => file !== markdownFile));
    if (markdownFile) {
      const names = new Set();
      const duplicate = imageFiles.find((file) => {
        const name = decodePath(file.name).toLowerCase();
        if (names.has(name)) return true;
        names.add(name);
        return false;
      });
      if (duplicate) {
        state.pageError = `選到兩張同名的「${duplicate.name}」，系統無法判斷講義要用哪張。請先改成不同檔名再匯入。`;
        renderEditor();
        focusMain();
        return;
      }
    }
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
      assetDescriptions: new Map(state.assetDescriptions),
    };
    state.activeOperation = operation;
    state.pageError = "";
    setInterfaceBusy(true, "正在帶入講義與圖片…");
    try {
      const [originalMarkdown, additions] = await Promise.all([
        markdownFile ? markdownFile.text() : Promise.resolve(""),
        prepareImages(imageFiles),
      ]);
      if (!currentEditorOperation(operation)) return;
      let nextArticle = { ...operation.editor };
      if (markdownFile) {
        nextArticle = mergeImportedMarkdown(nextArticle, originalMarkdown);
      }
      if (additions.length) {
        applyPreparedImages(nextArticle, additions, { cover: false, insert: !markdownFile, selection: operation.selection, matchReferences: Boolean(markdownFile) });
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
    releaseUnreferencedAssetUrls();
    state.assetLoadLimitMessage = previewAssetLimitMessage();
    refreshAssetView();
    if (state.assetLoadLimitMessage) {
      showToast(state.assetLoadLimitMessage, "danger", 7500);
      return;
    }
    if (!state.assetsLoading && unloadedExistingRequiredAssets().length) retryAssetLoading();
    if (state.assetsLoading) {
      showToast(state.assetLoadLimitMessage || "圖片還在背景載入。你可以繼續寫字，等圖片載完後再開預覽。", "danger", 6500);
      return;
    }
    if (previewAssetFailures().length) {
      showToast(state.assetLoadLimitMessage || "有圖片暫時無法顯示。請先按右側的「重新載入圖片」，確認畫面後再預覽。", "danger", 7500);
      return;
    }
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
    state.assetDescriptions = normalizedAssetDescriptions(undo.assetDescriptions);
    state.importUndo = null;
    markDirty();
    renderEditor();
    showToast("已恢復匯入前的內容。", "success");
  }

  async function reloadConflictVersion() {
    if (!state.conflictDetected || !state.client || !state.editor?.id || state.busy) return false;
    syncEditorFromDom();
    if (!persistLocalDraftNow()) {
      state.pageError = "這個瀏覽器目前無法保存本機備份，所以已停止讀取 GitHub 版本。你的修改仍留在畫面上；請先複製文字備份，或釋放瀏覽器儲存空間後再試。";
      renderEditor();
      focusMain();
      return false;
    }
    const session = sessionSnapshot();
    const articleId = state.editor.id;
    const localVersion = {
      savedAt: new Date().toISOString(),
      baseSha: state.loaded?.articleSha || "",
      conflict: true,
      article: { ...state.editor },
      pendingAssets: new Map(state.pendingAssets),
      assetUrls: new Map([...state.pendingAssets].map(([path, item]) => [path, item.url])),
      assetDescriptions: new Map(state.assetDescriptions),
    };
    setInterfaceBusy(true, "正在讀取 GitHub 最新版本…");
    try {
      const loaded = await session.client.loadArticle(articleId);
      if (!sessionIsCurrent(session) || state.editor?.id !== articleId) return false;
      const sourceEntry = loaded.files.find((file) => /\/IMAGE_SOURCES\.md$/i.test(file.path));
      loaded.imageSourcesText = sourceEntry
        ? await session.client.blobText(github.CONTENT_REPO, sourceEntry.sha)
        : "";
      if (!sessionIsCurrent(session) || state.editor?.id !== articleId) return false;

      const pendingUrls = new Set([...localVersion.assetUrls.values()]);
      for (const url of new Set(state.assetUrls.values())) {
        if (!pendingUrls.has(url) && String(url).startsWith("blob:")) URL.revokeObjectURL(url);
      }
      state.assetLoadToken += 1;
      state.assetUrls = new Map();
      state.assetDescriptions = new Map();
      state.assetLoadFailures.clear();
      state.pendingAssets = new Map();
      state.editor = core.parseArticle(loaded.raw, articleId);
      state.loaded = loaded;
      state.recovery = localVersion;
      state.conflictDetected = false;
      state.dirty = false;
      state.editorRevision += 1;
      state.previewFingerprint = "";
      state.pageError = "";
      state.assetsLoading = true;
      const loadToken = ++state.assetLoadToken;
      setInterfaceBusy(false);
      renderEditor();
      focusMain();
      showToast("已讀取 GitHub 最新版本。請按「比較版本」，選好後再儲存。", "success", 7500);
      void loadAssetUrls(state.editor, loaded, loadToken).finally(() => {
        if (state.assetLoadToken !== loadToken) return;
        state.assetsLoading = false;
        refreshAssetView();
      });
      return true;
    } catch (error) {
      if (!sessionIsCurrent(session)) return false;
      state.pageError = `無法讀取 GitHub 最新版本：${errorMessage(error)}`;
      setInterfaceBusy(false);
      renderEditor();
      focusMain();
      return false;
    }
  }

  function restoreRecoveryVersion(version = state.recovery) {
    if (!version?.article || !state.editor) return;
    const stableId = state.editor.id;
    const stableSlug = state.editor.slug;
    const stableStatus = state.editor.status;
    const pendingAssets = version.pendingAssets instanceof Map ? new Map(version.pendingAssets) : new Map();
    const assetUrls = version.assetUrls instanceof Map ? new Map(version.assetUrls) : new Map();
    const descriptions = normalizedAssetDescriptions(version.assetDescriptions);
    revokeAssetUrls();
    state.editor = { ...state.editor, ...version.article, id: stableId, slug: stableSlug, status: stableStatus };
    state.pendingAssets = pendingAssets;
    state.assetUrls = assetUrls;
    state.assetDescriptions = descriptions;
    state.recovery = null;
    state.conflictDetected = false;
    markDirty();
    renderEditor();
    showToast("已改用這台電腦留下的版本；請預覽後再儲存。", "success");
  }

  function blockUnresolvedRecovery() {
    if (!state.recovery) return false;
    state.pageError = "這台電腦還保留另一個版本。請先按「比較版本」，選擇要保留哪一份，再儲存、發布、下架或移除。";
    renderEditor();
    focusMain();
    return true;
  }

  function recoveryArticleSummary(article) {
    return `<dl class="compare-meta"><div><dt>原版本狀態</dt><dd>${escape(statusInfo(article.status).label)}</dd></div><div><dt>分類</dt><dd>${escape(article.category || "未填")}</dd></div><div><dt>摘要</dt><dd>${escape(article.excerpt || "未填")}</dd></div><div><dt>封面</dt><dd>${escape(article.featureImage || "未設定")}</dd></div><div><dt>封面說明</dt><dd>${escape(article.featureImageAlt || "未填")}</dd></div></dl>`;
  }

  function requestDiscardRecovery() {
    if (!state.recovery) return;
    showConfirm({
      title: "刪除這台電腦保留的版本？",
      lead: "GitHub 上的文章不會改變，但這台電腦尚未存上去的標題、摘要、分類、封面、內文與圖片檔會全部刪除。",
      checks: ["我已比較過兩個版本，確定只保留 GitHub 版本"],
      confirmLabel: "刪除本機保留版",
      danger: true,
      onConfirm: () => {
        if (state.recovery?.assetUrls instanceof Map) {
          for (const url of new Set(state.recovery.assetUrls.values())) {
            if (String(url).startsWith("blob:")) URL.revokeObjectURL(url);
          }
        }
        clearLocalDraft();
        state.recovery = null;
        state.conflictDetected = false;
        renderEditor();
        showToast("已保留 GitHub 版本。", "success");
      },
    });
  }

  function showRecoveryComparison() {
    if (!state.recovery?.article || !state.editor) return;
    const localVersions = [state.recovery, ...(state.recovery.alternates || [])];
    const dialog = document.createElement("dialog");
    const titleId = `recovery-title-${Date.now()}`;
    dialog.className = "compare-dialog";
    dialog.setAttribute("aria-labelledby", titleId);
    const localPanes = localVersions.map((version, index) => `<section class="compare-pane"><h3>${index === 0 ? "這台電腦最新保留版" : `較早保留版本 ${index}`}</h3><strong>${escape(version.article.title || "尚無標題")}</strong>${recoveryArticleSummary(version.article)}<pre>${escape(version.article.body || "（空白）")}</pre><button class="button button--primary button--small" type="button" data-use-local="${index}">改用這個版本</button></section>`).join("");
    dialog.innerHTML = `<div class="dialog-header"><h2 id="${titleId}">比較保留的版本</h2><button class="dialog-close" type="button" aria-label="關閉">×</button></div><div class="dialog-body"><p class="dialog-lead">第一格是 GitHub 上的版本，其他是這台電腦尚未存好的版本。系統不會自動覆蓋。無論選哪份文字，公開／草稿狀態都會沿用目前 GitHub 版本，避免意外重新發布。</p><div class="compare-grid"><section class="compare-pane"><h3>GitHub 版本</h3><strong>${escape(state.editor.title || "尚無標題")}</strong>${recoveryArticleSummary(state.editor)}<pre>${escape(state.editor.body || "（空白）")}</pre></section>${localPanes}</div></div><div class="dialog-footer"><button class="button button--danger" type="button" data-keep-cloud>刪除本機保留版，只留 GitHub</button></div>`;
    dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
    dialog.querySelector("[data-keep-cloud]").addEventListener("click", () => {
      dialog.close();
      requestDiscardRecovery();
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
    if (state.pendingAssets.size || recoveryPendingAssets().size) {
      persistLocalDraftNow();
      blockEditorTransition(recoveryPendingAssets().size
        ? "版本比較裡還保留尚未儲存的圖片，無法安全登出。請先選擇版本並按「儲存草稿」存到 GitHub。"
        : "還有尚未儲存的圖片，無法安全登出。請先按「儲存草稿」把圖片存到 GitHub。");
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
      conflictDetected: false,
      importUndo: null,
      liveRegistryChecked: false,
      liveDeploymentChecked: false,
      liveDeploymentContainsHead: false,
      contentHeadSha: "",
      lastArticleSyncAt: 0,
      articleRefreshGeneration: state.articleRefreshGeneration + 1,
      articleOpenGeneration: state.articleOpenGeneration + 1,
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
    if (blockUnresolvedRecovery()) return false;
    syncEditorFromDom();
    releaseUnreferencedAssetUrls();
    state.assetLoadLimitMessage = previewAssetLimitMessage();
    refreshAssetView();
    if (state.assetLoadLimitMessage) {
      showToast(state.assetLoadLimitMessage, "danger", 7500);
      return false;
    }
    if (!state.assetsLoading && unloadedExistingRequiredAssets().length) retryAssetLoading();
    if (state.assetsLoading || previewAssetFailures().length) {
      showToast(state.assetLoadLimitMessage || (state.assetsLoading ? "圖片還在載入，載完後才能發布。" : "請先重新載入圖片並完成預覽，再發布。"), "danger", 7000);
      return;
    }
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
    if (blockUnresolvedRecovery()) return false;
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
      state.contentHeadSha = String(result.commitSha || state.contentHeadSha || "");
      state.liveDeploymentContainsHead = false;

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
      const newFiles = files.map((file) => ({
        path: file.path,
        type: "blob",
        sha: result.fileShas[file.path],
        size: file.bytes?.byteLength ?? new TextEncoder().encode(String(file.content || "")).byteLength,
      }));
      const newPaths = new Set(newFiles.map((file) => file.path));
      state.loaded = {
        ...(operation.loaded || {}),
        id: built.id,
        articleSha: result.fileShas[articlePath],
        imageSourcesText: nextImageSourcesText,
        files: [...existingFiles.filter((file) => !newPaths.has(file.path)), ...newFiles],
      };
      const articleSummary = { ...state.editor, articleSha: result.fileShas[articlePath] };
      state.articles = [...state.articles.filter((article) => article.id !== built.id), articleSummary];
      state.pendingAssets.clear();
      releaseUnreferencedAssetUrls(state.editor);
      state.dirty = false;
      state.editorRevision += 1;
      state.previewFingerprint = "";
      state.recovery = null;
      state.conflictDetected = false;
      state.importUndo = null;
      clearLocalDraft([operation.oldDraftKey, localDraftKey()]);
      const needsDeployment = status === "published" || previousStatus === "published" || mode === "remove";
      if (needsDeployment) {
        state.deployments.set(built.id, { stage: "saved", mode, commitSha: result.commitSha, message: "已安全存到 GitHub。" });
      }
      state.activeOperation = null;
      setInterfaceBusy(false);
      renderEditor();
      updateSaveState(status === "published" ? "已存好，正在更新網站" : "草稿已安全存好", "success");
      showToast(status === "published" ? "文章與圖片已一起存好，正在更新網站。" : "草稿已存好，網站不會公開。", "success");
      if (needsDeployment) {
        void trackDeployment(result.commitSha, built.id, mode);
      }
      refreshArticleListInBackground();
    } catch (error) {
      if (state.activeOperation !== operation) return;
      state.activeOperation = null;
      setInterfaceBusy(false);
      state.conflictDetected = error?.code === "EDIT_CONFLICT";
      state.pageError = state.conflictDetected
        ? "另一台電腦已先修改這篇文章。你的文字與尚未儲存圖片仍在這個分頁；請讀取 GitHub 版本並比較，系統不會直接覆寫。"
        : errorMessage(error);
      updateSaveState("沒有存檔", "danger");
      renderEditor();
      focusMain();
    }
  }

  async function trackDeployment(commitSha, articleId, mode = "publish") {
    const client = state.client;
    const sessionVersion = state.sessionVersion;
    const sessionActive = () => state.client === client && state.sessionVersion === sessionVersion;
    const trackerActive = () => sessionActive() && deploymentTrackerIsCurrent(articleId, commitSha);
    const updateTrackedDeployment = (patch) => {
      if (!trackerActive()) return false;
      setDeployment(articleId, { ...deploymentFor(articleId), ...patch, mode, commitSha });
      return true;
    };
    if (!client || !trackerActive()) return;
    updateTrackedDeployment({ stage: "saved", message: "已安全存到 GitHub。" });
    let run = null;
    try {
      for (let attempt = 0; attempt < 45; attempt += 1) {
        if (!trackerActive()) return;
        run = await client.workflowForCommit(commitSha);
        if (!trackerActive()) return;
        if (!run) {
          updateTrackedDeployment({ stage: "building", message: "正在等待網站製作開始。" });
        } else if (run.status !== "completed") {
          updateTrackedDeployment({ stage: "building", message: "正在排版文章與檢查圖片。" });
        } else if (run.conclusion !== "success") {
          updateTrackedDeployment({ stage: "failed", failedAt: 1, message: "網站檢查沒有通過，文章沒有被說成已上線。", url: run.html_url || "" });
          return;
        } else {
          updateTrackedDeployment({ stage: "deploying", message: "文章已產生，正在等網站換成新版本。" });
          break;
        }
        await sleep(4000);
      }

      for (let attempt = 0; attempt < 36; attempt += 1) {
        if (!trackerActive()) return;
        const cacheKey = `${encodeURIComponent(commitSha)}-${Date.now()}`;
        let deployStatus;
        try {
          deployStatus = await readPublicJson(`${PUBLIC_DEPLOY_STATUS}?studio=${cacheKey}`);
        } catch {
          if (!trackerActive()) return;
          updateTrackedDeployment({ stage: "deploying", message: "公開網站暫時沒有回應，仍在安全確認中。" });
          await sleep(5000);
          continue;
        }
        if (!trackerActive()) return;
        const deployedSha = String(deployStatus?.sourceSha || "");
        let containsCommit = deployedSha.toLowerCase() === String(commitSha).toLowerCase();
        if (!containsCommit && deployedSha) {
          try {
            containsCommit = await client.deploymentContainsCommit(commitSha, deployedSha);
            if (!trackerActive()) return;
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
        const currentHeadSha = String(state.contentHeadSha || "");
        if (currentHeadSha && deployedSha) {
          try {
            containsCurrentHead = await client.deploymentContainsCommit(currentHeadSha, deployedSha);
            currentHeadChecked = true;
            if (!trackerActive()) return;
            if (String(state.contentHeadSha || "") !== currentHeadSha) continue;
          } catch {
            // The per-article commit is deployed, but the current repository head is still unconfirmed.
          }
        }

        let registry;
        try {
          registry = await readPublicJson(`${PUBLIC_REGISTRY}?studio=${cacheKey}`);
        } catch {
          if (!trackerActive()) return;
          updateTrackedDeployment({ stage: "deploying", message: "文章已產生，正在確認公開頁面。" });
          await sleep(5000);
          continue;
        }
        if (!trackerActive()) return;
        if (String(state.contentHeadSha || "") !== currentHeadSha) continue;
        if (!Array.isArray(registry)) {
          updateTrackedDeployment({ stage: "deploying", message: "公開文章清單格式異常，尚未宣告完成。" });
          await sleep(5000);
          continue;
        }

        state.liveRegistryChecked = true;
        state.livePosts = new Map(registry.map((item) => [item.submissionId, item]));
        state.liveDeploymentChecked = currentHeadChecked;
        state.liveDeploymentContainsHead = containsCurrentHead;
        const published = state.livePosts.get(articleId) || null;
        const registryMatchesMode = mode === "remove" ? !published : Boolean(published);
        if (deploymentCanFinish(registryMatchesMode, currentHeadChecked, containsCurrentHead)) {
          if (!updateTrackedDeployment({ stage: "live", message: mode === "remove" ? "公開頁面已移除。" : "已從公開網站重新讀取確認。", url: published?.url || "" })) return;
          showToast(mode === "remove" ? "文章已從網站下架。" : "文章真的上線了，可以放心。", "success", 7000);
          return;
        }
        updateTrackedDeployment({
          stage: "deploying",
          message: registryMatchesMode
            ? "公開網站仍是較早版本，正在等待目前版本完成部署。"
            : mode === "remove" ? "正在等待公開頁面移除。" : "正在等待公開文章出現。",
        });
        await sleep(5000);
      }
      if (!trackerActive()) return;
      updateTrackedDeployment({ stage: "deploying", message: "網站平台還在更新。可以先離開，稍後回文章清單查看。" });
    } catch (error) {
      if (!trackerActive()) return;
      updateTrackedDeployment({ stage: "failed", failedAt: 2, message: `無法確認網站狀態：${errorMessage(error)}`, url: run?.html_url || "" });
    }
  }

  function requestUnpublish() {
    if (blockUnresolvedRecovery()) return false;
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
    if (blockUnresolvedRecovery()) return false;
    const removal = sourceRemovalState();
    if (!removal.allowed) {
      state.pageError = removal.reason;
      renderEditor();
      focusMain();
      return false;
    }
    showConfirm({
      title: "移除這篇文章？",
      lead: "公開頁已確認下架。文章與圖片會從目前清單移除，GitHub 歷史仍可協助復原。",
      checks: ["我確認要移除這篇文章"],
      confirmLabel: "移除文章",
      danger: true,
      onConfirm: deleteArticle,
    });
    return true;
  }

  async function deleteArticle() {
    if (!state.loaded || state.busy) return;
    if (blockUnresolvedRecovery()) return false;
    const removal = sourceRemovalState();
    if (!removal.allowed) {
      state.pageError = removal.reason;
      renderEditor();
      focusMain();
      return false;
    }
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
      state.contentHeadSha = String(result.commitSha || state.contentHeadSha || "");
      state.liveDeploymentContainsHead = false;
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
      state.articles = state.articles.filter((article) => article.id !== operation.id);
      state.deployments.delete(operation.id);
      state.activeOperation = null;
      setInterfaceBusy(false);
      render();
      focusMain();
      showToast("文章來源已移除；公開頁先前已確認下架。", "success");
      refreshArticleListInBackground();
      return true;
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
    if (route !== state.route && !persistEditorBeforeTransition({ confirmLeave: true, blockPendingAssets: true })) return false;
    state.pageError = "";
    state.articleOpenGeneration += 1;
    state.articleRefreshGeneration += 1;
    state.loading = false;
    state.route = route;
    render();
    focusMain();
    if (route === "inbox" && !state.inboxLoaded) void loadInbox();
    return true;
  }

  if (TEST_MODE) {
    window.__CALUMAI_STUDIO_TEST_API__ = {
      SESSION_TOKEN_KEY,
      deploymentCanFinish,
      deploymentTrackerIsCurrent,
      applyPreparedImages,
      assetDescriptionFor,
      linkUploadedImages,
      logout,
      markDirty,
      mergeImportedMarkdown,
      openArticle,
      persistEditorBeforeTransition,
      persistLocalDraftNow,
      prepareImages,
      previewAssetLimitMessage,
      readPublicJson,
      refreshArticles,
      refreshArticleListInBackground,
      retryAssetLoading,
      loadAssetUrls,
      reloadConflictVersion,
      requestDelete,
      removePendingImage,
      releaseUnreferencedAssetUrls,
      unlinkImageFromArticle,
      updateFeatureImageDescription,
      restoreRecoveryVersion,
      routeTo,
      saveArticle,
      sourceRemovalState,
      startNewArticle,
      state,
      trackDeployment,
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
    if (action === "refresh-articles") void refreshArticles();
    if (action === "new-article") startNewArticle();
    if (action === "open-article") void openArticle(target.dataset.id);
    if (action === "back-to-list") routeTo("articles");
    if (action === "preview") showPreview();
    if (action === "save-draft") void saveArticle("draft");
    if (action === "request-publish") requestPublish();
    if (action === "request-unpublish") requestUnpublish();
    if (action === "request-delete") requestDelete();
    if (action === "reload-conflict") void reloadConflictVersion();
    if (action === "retry-deployment") {
      const deployment = deploymentFor(state.editor?.id);
      if (deployment?.commitSha) void trackDeployment(deployment.commitSha, state.editor.id, deployment.mode);
    }
    if (action === "choose-body-images") root.querySelector('[data-file-input="body"]')?.click();
    if (action === "choose-cover") root.querySelector('[data-file-input="cover"]')?.click();
    if (action === "choose-markdown") requestMarkdownImport();
    if (action === "retry-assets") retryAssetLoading();
    if (action === "insert-existing-image") insertExistingImage(target);
    if (action === "request-remove-pending") requestRemovePendingImage(target.dataset.path);
    if (action === "request-unlink-image") requestUnlinkImage(target.dataset.path);
    if (action === "remove-cover") { state.editor.featureImage = ""; state.editor.featureImageAlt = ""; markDirty(); renderEditor(); }
    if (action === "compare-recovery") showRecoveryComparison();
    if (action === "discard-recovery") requestDiscardRecovery();
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
    if (event.target.matches("[data-image-alt-path]")) {
      if (!state.editor) return;
      const path = event.target.dataset.imageAltPath;
      const description = cleanImageDescription(event.target.value);
      state.assetDescriptions.set(assetDescriptionKey(path), description);
      const nextBody = core.replaceImageAlt(state.editor.body, path, description);
      let changed = false;
      if (nextBody !== state.editor.body) {
        state.editor.body = nextBody;
        const textarea = root.querySelector("[data-body-input]");
        if (textarea) textarea.value = nextBody;
        changed = true;
      }
      if (
        decodePath(normalizeAssetKey(state.editor.featureImage)).toLowerCase()
        === decodePath(normalizeAssetKey(path)).toLowerCase()
        && state.editor.featureImageAlt !== description
      ) {
        state.editor.featureImageAlt = description;
        const coverAlt = root.querySelector('[data-field="featureImageAlt"]');
        if (coverAlt) coverAlt.value = description;
        changed = true;
      }
      if (changed) markDirty();
      if (description && description !== "請填寫圖片說明") event.target.removeAttribute("aria-invalid");
      return;
    }
    if (event.target.matches("[data-field]")) {
      if (!state.editor) return;
      const field = event.target.dataset.field;
      if (field === "featureImageAlt") {
        updateFeatureImageDescription(event.target.value);
        const textarea = root.querySelector("[data-body-input]");
        if (textarea) textarea.value = state.editor.body;
      } else {
        state.editor[field] = event.target.value;
      }
      if (field === "featureImageAlt" && state.editor.featureImage) {
        const featurePath = state.editor.featureImage;
        for (const input of root.querySelectorAll("[data-image-alt-path]")) {
          if (decodePath(normalizeAssetKey(input.dataset.imageAltPath)).toLowerCase() === decodePath(normalizeAssetKey(featurePath)).toLowerCase()) {
            input.value = event.target.value;
          }
        }
      }
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
      const field = event.target.dataset.field;
      if (field === "featureImageAlt") {
        updateFeatureImageDescription(event.target.value);
        const textarea = root.querySelector("[data-body-input]");
        if (textarea) textarea.value = state.editor.body;
      } else {
        state.editor[field] = event.target.value;
      }
      markDirty();
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (!state.dirty && !state.pendingAssets.size && !recoveryPendingAssets().size) return;
    persistLocalDraftNow();
    event.preventDefault();
    event.returnValue = "";
  });

  window.addEventListener("focus", () => {
    if (!state.client || state.route !== "articles" || state.loading || state.busy) return;
    if (Date.now() - state.lastArticleSyncAt < 30000) return;
    void refreshArticles({ announce: false });
  });

  if (!root || !core || !github) {
    document.body.textContent = "管理台必要檔案沒有載入，請重新整理頁面。";
    return;
  }
  void resumeSession();
})();
