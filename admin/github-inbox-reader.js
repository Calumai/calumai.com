(() => {
  "use strict";

  // This runs inside the CMS page. It deliberately uses the same GitHub sign-in
  // that the editor already uses: no second token field, no local helper, and no
  // Windows command window. GitHub API calls happen directly from the browser.
  const BUTTON_ID = "calumai-github-inbox-button";
  const PANEL_ID = "calumai-github-inbox-panel";
  const NOTICE_ID = "calumai-github-inbox-notice";
  const OWNER = "Calumai";
  const INBOX_REPO = "calumai-blog-inbox";
  const BLOG_REPO = "blog-content";
  const BRANCH = "main";
  const SAFE_ID = /^\d{8}-[a-z0-9-]+$/;
  const GITHUB_API_TIMEOUT_MS = 20 * 1000;
  const LEGACY_CMS_AUTH_KEYS = Object.freeze([
    "sveltia-cms.user",
    "sveltia-cms-user",
    "netlify-cms-user",
    "decap-cms-user",
  ]);

  if (typeof module === "object" && module.exports) {
    module.exports = { clearStoredGithubLogin, collectCmsGithubTokens, github };
    return;
  }

  const style = document.createElement("style");
  style.textContent = `
    #${BUTTON_ID} { position:fixed; right:18px; bottom:132px; z-index:99999; border:0; border-radius:999px; background:#bf4f35; color:#fff; box-shadow:0 14px 34px rgba(31,41,36,.24); cursor:pointer; font:800 14px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; padding:13px 17px; }
    #${BUTTON_ID}:hover { background:#9f3e28; }
    #${PANEL_ID} { position:fixed; right:18px; bottom:188px; z-index:100000; width:min(590px,calc(100vw - 36px)); max-height:min(720px,calc(100vh - 160px)); overflow:auto; border:1px solid rgba(36,86,66,.18); border-radius:18px; background:#fffaf0; color:#18231f; box-shadow:0 18px 54px rgba(31,41,36,.22); font:600 14px/1.55 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; padding:16px; display:none; }
    #${PANEL_ID}[data-open="true"] { display:block; }
    #${PANEL_ID} h2 { margin:0 0 8px; color:#245642; font-size:18px; }
    #${PANEL_ID} p { margin:0 0 10px; color:#52615a; }
    #${PANEL_ID} .actions { display:flex; flex-wrap:wrap; gap:8px; margin:12px 0; }
    #${PANEL_ID} button, #${PANEL_ID} a.button { border:0; border-radius:999px; background:#245642; color:#fffaf0; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; padding:8px 12px; text-decoration:none; font:800 13px/1.2 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    #${PANEL_ID} button.secondary, #${PANEL_ID} a.secondary { background:#e7decf; color:#245642; }
    #${PANEL_ID} .submission { border:1px solid #eadfce; border-radius:14px; background:#fff; padding:12px; margin:10px 0; }
    #${PANEL_ID} .submission-title { display:flex; justify-content:space-between; gap:10px; color:#18231f; font-weight:950; word-break:break-word; }
    #${PANEL_ID} .badges { display:flex; flex-wrap:wrap; gap:6px; margin:8px 0; }
    #${PANEL_ID} .badge { border-radius:999px; padding:3px 8px; font-size:12px; font-weight:900; background:#edf7f0; color:#245642; }
    #${PANEL_ID} .badge.warn { background:#fff0d6; color:#9a5b13; }
    #${PANEL_ID} .badge.bad { background:#fee2e2; color:#b42318; }
    #${PANEL_ID} .help-box, #${PANEL_ID} .result-box { border-radius:14px; padding:12px; margin:10px 0; }
    #${PANEL_ID} .help-box { border:1px solid #f2c9bc; background:#fff4ed; color:#3c2a22; }
    #${PANEL_ID} .result-box { border:1px solid #d8e6dd; background:#f5fbf7; }
    #${PANEL_ID} .hint { color:#6b746f; font-size:12px; }
    #${PANEL_ID} code { background:#f2ecdf; color:#245642; border-radius:6px; padding:1px 5px; font-size:12px; }
    #${NOTICE_ID} { position:fixed; left:50%; bottom:92px; z-index:100001; transform:translateX(-50%); max-width:min(560px,calc(100vw - 36px)); border-radius:14px; background:#17201c; color:#fff; box-shadow:0 18px 50px rgba(31,41,36,.28); font:700 14px/1.5 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; padding:12px 14px; }
    @media (max-width:720px) { #${BUTTON_ID}{right:10px;bottom:132px} #${PANEL_ID}{left:10px;right:10px;bottom:188px;width:auto} }
  `;
  document.head.appendChild(style);

  function escapeHtml(value) {
    return String(value || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function showNotice(message) {
    document.getElementById(NOTICE_ID)?.remove();
    const notice = document.createElement("div");
    notice.id = NOTICE_ID;
    notice.textContent = message;
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 4800);
  }

  // Only inspect the explicit auth records used by legacy CMS versions. Studio
  // drafts can contain GitHub-shaped text and must never be treated as auth.
  function collectCmsGithubTokens(stores = [localStorage, sessionStorage]) {
    const tokenPattern = /(?:github_pat_[A-Za-z0-9_]+|gh[opusr]_[A-Za-z0-9_]+)/g;
    const tokens = new Set();
    for (const store of stores) {
      for (const key of LEGACY_CMS_AUTH_KEYS) {
        const raw = store?.getItem(key) || "";
        for (const match of raw.matchAll(tokenPattern)) tokens.add(match[0]);
      }
    }
    return [...tokens];
  }

  function clearStoredGithubLogin(stores = [localStorage, sessionStorage]) {
    for (const store of stores) {
      for (const key of LEGACY_CMS_AUTH_KEYS) store?.removeItem(key);
    }
  }

  function githubTimeoutError(timeoutMs) {
    const seconds = Math.max(1, Math.round(timeoutMs / 1000));
    const error = new Error(`GitHub 連線逾時（${seconds} 秒），請檢查網路後再試一次。`);
    error.code = "GITHUB_API_TIMEOUT";
    error.userMessage = error.message;
    return error;
  }

  async function withGithubTimeout(task, timeoutMs) {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    let timeoutId;
    const timeout = new Promise((resolve, reject) => {
      timeoutId = setTimeout(() => {
        reject(githubTimeoutError(timeoutMs));
        controller?.abort();
      }, timeoutMs);
    });

    try {
      return await Promise.race([
        Promise.resolve().then(() => task(controller?.signal)),
        timeout,
      ]);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  async function getInboxToken() {
    const tokens = collectCmsGithubTokens();
    if (!tokens.length) throw new Error("沒有找到 GitHub 登入權限");

    const failures = [];
    for (const token of tokens) {
      try {
        await github(`/repos/${OWNER}/${INBOX_REPO}`, token);
        return token;
      } catch (error) {
        failures.push(error);
      }
    }

    const error = failures.find((item) => item.status === 404) || failures[0] || new Error("GitHub 登入權限不足");
    error.message = "目前瀏覽器裡有 GitHub 登入，但沒有一個能讀私人收件匣。";
    throw error;
  }

  async function github(path, token, options = {}) {
    const configuredTimeout = Number(options?.requestTimeoutMs);
    const timeoutMs = Number.isFinite(configuredTimeout) && configuredTimeout > 0
      ? configuredTimeout
      : GITHUB_API_TIMEOUT_MS;
    const { requestTimeoutMs, ...fetchOptions } = options;

    try {
      return await withGithubTimeout(async (timeoutSignal) => {
        const requestOptions = {
          ...fetchOptions,
          headers: {
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            Authorization: `Bearer ${token}`,
            ...(fetchOptions.headers || {}),
          },
        };
        if (!requestOptions.signal && timeoutSignal) requestOptions.signal = timeoutSignal;

        const response = await fetch(`https://api.github.com${path}`, requestOptions);
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          const error = new Error(data.message || `GitHub 回應 ${response.status}`);
          error.status = response.status;
          throw error;
        }
        return data;
      }, timeoutMs);
    } catch (error) {
      if (error?.code === "GITHUB_API_TIMEOUT" || Number.isFinite(error?.status)) throw error;
      const networkError = new Error("無法連線到 GitHub，請檢查網路後再試一次。");
      networkError.code = "GITHUB_NETWORK_ERROR";
      networkError.userMessage = networkError.message;
      networkError.cause = error;
      throw networkError;
    }
  }

  function decodeContent(content) {
    const bytes = Uint8Array.from(atob(String(content || "").replace(/\s/g, "")), (char) => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  }

  function encodeUtf8Base64(text) {
    const bytes = new TextEncoder().encode(text);
    let binary = "";
    for (const byte of bytes) binary += String.fromCharCode(byte);
    return btoa(binary);
  }

  async function loadSubmissions(token) {
    const root = await github(`/repos/${OWNER}/${INBOX_REPO}/contents/submissions?ref=${BRANCH}`, token);
    const dirs = root.filter((item) => item.type === "dir" && item.name !== "_template" && SAFE_ID.test(item.name));
    const rows = [];
    for (const dir of dirs.sort((a, b) => b.name.localeCompare(a.name, "zh-Hant")).slice(0, 50)) {
      const files = await github(`/repos/${OWNER}/${INBOX_REPO}/contents/submissions/${encodeURIComponent(dir.name)}?ref=${BRANCH}`, token);
      const has = (name, type) => files.some((file) => file.type === type && file.name.toLowerCase() === name.toLowerCase());
      rows.push({
        id: dir.name,
        htmlUrl: dir.html_url,
        article: has("article.md", "file"),
        imageSources: has("IMAGE_SOURCES.md", "file"),
        ready: has("READY_FOR_BLOG.md", "file"),
        assets: has("assets", "dir"),
        sources: has("sources", "dir"),
      });
    }
    return rows;
  }

  function normaliseArticle(id, rawArticle) {
    const match = String(rawArticle).match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
    if (!match) throw new Error(`${id} 的 article.md 缺少開頭的文章資料區塊。`);
    let header = match[1];
    const rest = rawArticle.slice(match[0].length);
    const set = (key, value, force = false) => {
      const expression = new RegExp(`^${key}:.*$`, "m");
      if (expression.test(header)) {
        if (force) header = header.replace(expression, `${key}: ${value}`);
      } else {
        header += `\n${key}: ${value}`;
      }
    };
    set("folder_id", JSON.stringify(id));
    set("slug", JSON.stringify(id.replace(/^\d{8}-/, "")));
    set("status", JSON.stringify("awaiting_human_review"), true);
    set("approval_required", "true");
    set("image_source_type", JSON.stringify("project_screenshot"));
    set("image_source_path", JSON.stringify("IMAGE_SOURCES.md"));
    return `---\n${header.trim()}\n---\n${rest.trimStart()}`;
  }

  async function listPackageFiles(id, token) {
    const tree = await github(`/repos/${OWNER}/${INBOX_REPO}/git/trees/${BRANCH}?recursive=1`, token);
    const prefix = `submissions/${id}/`;
    const allowed = new RegExp(`^submissions/${id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/(?:article\\.md|IMAGE_SOURCES\\.md|assets/|sources/)`, "i");
    return (tree.tree || []).filter((item) => item.type === "blob" && allowed.test(item.path) && item.path.startsWith(prefix));
  }

  async function importSubmission(id, token) {
    if (!SAFE_ID.test(id)) throw new Error("這篇文章的資料夾編號不正確，已停止匯入。");
    const [sourceFiles, blogTree, branch] = await Promise.all([
      listPackageFiles(id, token),
      github(`/repos/${OWNER}/${BLOG_REPO}/git/trees/${BRANCH}?recursive=1`, token),
      github(`/repos/${OWNER}/${BLOG_REPO}/git/ref/heads/${BRANCH}`, token),
    ]);
    if ((blogTree.tree || []).some((item) => item.path === `posts/${id}` || item.path.startsWith(`posts/${id}/`))) {
      return { id, status: "skipped", message: "這篇已經在後台裡了。" };
    }
    const article = sourceFiles.find((item) => item.path.toLowerCase() === `submissions/${id}/article.md`.toLowerCase());
    const imageSources = sourceFiles.find((item) => item.path.toLowerCase() === `submissions/${id}/image_sources.md`.toLowerCase());
    if (!article || !imageSources) throw new Error(`${id} 缺少 article.md 或 IMAGE_SOURCES.md，先不帶入。`);

    const articleBlob = await github(`/repos/${OWNER}/${INBOX_REPO}/git/blobs/${article.sha}`, token);
    const replacement = normaliseArticle(id, decodeContent(articleBlob.content));
    const prepared = [];
    for (const file of sourceFiles) {
      const targetPath = file.path.replace(`submissions/${id}/`, `posts/${id}/`);
      if (file.path === article.path) {
        prepared.push({ path: targetPath, content: encodeUtf8Base64(replacement) });
      } else {
        const blob = await github(`/repos/${OWNER}/${INBOX_REPO}/git/blobs/${file.sha}`, token);
        prepared.push({ path: targetPath, content: blob.content.replace(/\s/g, "") });
      }
    }

    const entries = [];
    for (const file of prepared) {
      const blob = await github(`/repos/${OWNER}/${BLOG_REPO}/git/blobs`, token, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: file.content, encoding: "base64" }),
      });
      entries.push({ path: file.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    const baseCommit = await github(`/repos/${OWNER}/${BLOG_REPO}/git/commits/${branch.object.sha}`, token);
    const newTree = await github(`/repos/${OWNER}/${BLOG_REPO}/git/trees`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ base_tree: baseCommit.tree.sha, tree: entries }),
    });
    const commit = await github(`/repos/${OWNER}/${BLOG_REPO}/git/commits`, token, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: `Import blog inbox submission: ${id}`, tree: newTree.sha, parents: [branch.object.sha] }),
    });
    await github(`/repos/${OWNER}/${BLOG_REPO}/git/refs/heads/${BRANCH}`, token, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sha: commit.sha, force: false }),
    });
    return { id, status: "imported", message: "已帶入為待人工確認草稿。" };
  }

  function authHelp(error) {
    const status = error?.status ? `（GitHub 回應 ${error.status}）` : "";
    const permissionNote = error?.status === 404
      ? "你其實已登入，但目前這次登入只被授權讀取 blog-content；GitHub 會把沒有權限的私人收件匣故意回傳成 404。"
      : "後台目前無法使用這次 GitHub 登入讀取收件匣。";
    return `<div class="help-box"><strong>收件匣權限還沒接上 ${escapeHtml(status)}</strong><p>${permissionNote}</p><p>按下面這顆按鈕，後台會清掉舊登入並重新載入；接著請按「使用 GitHub 登入」，授權後再同步收件匣。</p><div class="actions"><button type="button" data-action="reset-auth">清掉舊登入並重新登入</button></div><p class="hint">這個後台不需要另外開命令視窗、貼指令或建立第二把 token。</p></div>`;
  }

  function renderRows(rows) {
    if (!rows.length) return "<p>收件匣目前沒有可辨識的投稿資料夾。</p>";
    return rows.map((row) => {
      const missing = [row.article ? null : "缺 article.md", row.imageSources ? null : "缺 IMAGE_SOURCES.md"].filter(Boolean);
      return `<div class="submission"><div class="submission-title"><span>${escapeHtml(row.id)}</span><span>${row.ready ? "可檢查" : "撰寫中"}</span></div><div class="badges"><span class="badge ${row.article ? "" : "bad"}">${row.article ? "有文章" : "缺文章"}</span><span class="badge ${row.imageSources ? "" : "bad"}">${row.imageSources ? "有圖片來源" : "缺圖片來源"}</span><span class="badge ${row.assets ? "" : "warn"}">${row.assets ? "有圖片" : "尚無圖片"}</span><span class="badge ${row.sources ? "" : "warn"}">${row.sources ? "有證據資料" : "尚無證據資料"}</span></div><p class="hint">${missing.length ? escapeHtml(missing.join("、")) : "帶入後會變成「待人工確認」草稿，不會直接公開。"}</p><div class="actions"><a class="button secondary" href="${row.htmlUrl}" target="_blank" rel="noopener noreferrer">查看原稿</a>${missing.length ? "" : `<button type="button" data-import-id="${escapeHtml(row.id)}">帶入後台草稿</button>`}</div></div>`;
    }).join("");
  }

  const panel = document.createElement("section");
  panel.id = PANEL_ID;
  panel.setAttribute("aria-label", "GitHub 收件匣");
  panel.innerHTML = `<h2>GitHub 收件匣</h2><p>這裡直接使用你已登入後台的 GitHub 帳號讀取投稿。按下帶入後，文章和圖片會直接成為後台草稿；不需要桌面小助手。</p><div class="actions"><button type="button" data-action="load">同步收件匣</button><button class="secondary" type="button" data-action="import-all">帶入所有合格草稿</button><a class="button secondary" href="https://github.com/${OWNER}/${INBOX_REPO}/tree/${BRANCH}/submissions" target="_blank" rel="noopener noreferrer">查看 GitHub 收件匣</a></div><div id="calumai-inbox-result" class="hint">按「同步收件匣」查看最新投稿。</div>`;

  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.textContent = "📥 GitHub 收件匣";

  async function loadIntoPanel() {
    const result = panel.querySelector("#calumai-inbox-result");
    result.textContent = "正在同步收件匣…如果瀏覽器裡有舊登入，後台會自動跳過不能讀收件匣的那個。";
    try {
      const rows = await loadSubmissions(await getInboxToken());
      panel.dataset.rows = JSON.stringify(rows);
      result.innerHTML = renderRows(rows);
    } catch (error) {
      result.innerHTML = authHelp(error);
    }
  }

  async function importIds(ids) {
    const result = panel.querySelector("#calumai-inbox-result");
    result.innerHTML = `<div class="result-box">正在把 ${ids.length} 篇文章帶入後台草稿…</div>`;
    try {
      const token = await getInboxToken();
      const results = [];
      for (const id of ids) results.push(await importSubmission(id, token));
      result.innerHTML = `<div class="result-box"><strong>收件匣處理完成</strong><p>${results.map((item) => `${escapeHtml(item.id)}：${escapeHtml(item.message)}`).join("<br>")}</p><p class="hint">稍等一下重新整理後台，文章會出現在「部落格文章」裡。網站仍不會自動公開。</p></div>`;
    } catch (error) {
      result.innerHTML = `${authHelp(error)}<p style="color:#b42318">${escapeHtml(error.message || error)}</p>`;
    }
  }

  panel.addEventListener("click", async (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    if (target.dataset.action === "load") await loadIntoPanel();
    if (target.dataset.action === "reset-auth") {
      clearStoredGithubLogin();
      showNotice("舊登入已清除，正在重新載入後台。");
      window.location.href = `/admin/?v=${Date.now()}`;
      return;
    }
    if (target.dataset.action === "import-all") {
      const rows = JSON.parse(panel.dataset.rows || "[]");
      if (!rows.length) return loadIntoPanel();
      await importIds(rows.filter((row) => row.article && row.imageSources).map((row) => row.id));
    }
    if (target.dataset.importId) await importIds([target.dataset.importId]);
  });

  button.addEventListener("click", () => {
    const open = panel.dataset.open !== "true";
    panel.dataset.open = String(open);
    if (open) loadIntoPanel();
  });

  window.addEventListener("load", () => {
    document.body.appendChild(panel);
    document.body.appendChild(button);
  });
})();
