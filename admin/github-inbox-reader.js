(() => {
  "use strict";

  const BUTTON_ID = "calumai-github-inbox-button";
  const PANEL_ID = "calumai-github-inbox-panel";
  const NOTICE_ID = "calumai-github-inbox-notice";
  const TOKEN_KEY = "calumai-github-inbox-token";
  const OWNER = "Calumai";
  const INBOX_REPO = "calumai-blog-inbox";
  const BLOG_REPO = "blog-content";
  const BRANCH = "main";

  const style = document.createElement("style");
  style.textContent = `
    #${BUTTON_ID} {
      position: fixed;
      right: 18px;
      bottom: 76px;
      z-index: 99999;
      border: 0;
      border-radius: 999px;
      background: #bf4f35;
      color: #fff;
      box-shadow: 0 14px 34px rgba(31, 41, 36, 0.24);
      cursor: pointer;
      font: 800 14px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 13px 17px;
    }
    #${BUTTON_ID}:hover { background: #9f3e28; }
    #${PANEL_ID} {
      position: fixed;
      right: 18px;
      bottom: 132px;
      z-index: 100000;
      width: min(560px, calc(100vw - 36px));
      max-height: min(720px, calc(100vh - 160px));
      overflow: auto;
      border: 1px solid rgba(36, 86, 66, 0.18);
      border-radius: 18px;
      background: #fffaf0;
      color: #18231f;
      box-shadow: 0 18px 54px rgba(31, 41, 36, 0.22);
      font: 600 14px/1.55 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 16px;
      display: none;
    }
    #${PANEL_ID}[data-open="true"] { display: block; }
    #${PANEL_ID} h2 { margin: 0 0 8px; color: #245642; font-size: 18px; }
    #${PANEL_ID} p { margin: 0 0 10px; color: #52615a; }
    #${PANEL_ID} label { display: block; margin: 10px 0 4px; color: #245642; font-weight: 900; }
    #${PANEL_ID} input[type="password"], #${PANEL_ID} input[type="text"] {
      width: 100%;
      border: 1px solid #d7cbb9;
      border-radius: 10px;
      padding: 9px 10px;
      background: #fff;
      color: #18231f;
      font: 600 13px/1.3 ui-monospace, SFMono-Regular, Consolas, monospace;
      box-sizing: border-box;
    }
    #${PANEL_ID} .actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
    #${PANEL_ID} button, #${PANEL_ID} a.button {
      border: 0;
      border-radius: 999px;
      background: #245642;
      color: #fffaf0;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px 12px;
      text-decoration: none;
      font: 800 13px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #${PANEL_ID} button.secondary, #${PANEL_ID} a.secondary { background: #e7decf; color: #245642; }
    #${PANEL_ID} button.danger { background: #fee2e2; color: #b42318; }
    #${PANEL_ID} .submission {
      border: 1px solid #eadfce;
      border-radius: 14px;
      background: #fff;
      padding: 12px;
      margin: 10px 0;
    }
    #${PANEL_ID} .submission-title {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      color: #18231f;
      font-weight: 950;
      word-break: break-word;
    }
    #${PANEL_ID} .badges { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
    #${PANEL_ID} .badge {
      border-radius: 999px;
      padding: 3px 8px;
      font-size: 12px;
      font-weight: 900;
      background: #edf7f0;
      color: #245642;
    }
    #${PANEL_ID} .badge.warn { background: #fff0d6; color: #9a5b13; }
    #${PANEL_ID} .badge.bad { background: #fee2e2; color: #b42318; }
    #${PANEL_ID} code {
      background: #f2ecdf;
      color: #245642;
      border-radius: 6px;
      padding: 1px 5px;
      font-size: 12px;
    }
    #${PANEL_ID} .hint { color: #6b746f; font-size: 12px; }
    #${NOTICE_ID} {
      position: fixed;
      left: 50%;
      bottom: 18px;
      z-index: 100001;
      transform: translateX(-50%);
      max-width: min(560px, calc(100vw - 36px));
      border-radius: 14px;
      background: #17201c;
      color: #fff;
      box-shadow: 0 18px 50px rgba(31, 41, 36, 0.28);
      font: 700 14px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 12px 14px;
    }
    @media (max-width: 720px) {
      #${BUTTON_ID} { right: 10px; bottom: 76px; }
      #${PANEL_ID} { left: 10px; right: 10px; bottom: 132px; width: auto; }
    }
  `;
  document.head.appendChild(style);

  function showNotice(message) {
    document.getElementById(NOTICE_ID)?.remove();
    const notice = document.createElement("div");
    notice.id = NOTICE_ID;
    notice.textContent = message;
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 5200);
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getStoredToken() {
    return localStorage.getItem(TOKEN_KEY) || inferExistingGithubToken() || "";
  }

  function inferExistingGithubToken() {
    const stores = [localStorage, sessionStorage];
    for (const store of stores) {
      for (let i = 0; i < store.length; i += 1) {
        const key = store.key(i);
        const value = store.getItem(key) || "";
        const direct = value.match(/(github_pat_[A-Za-z0-9_]+|ghp_[A-Za-z0-9_]+)/)?.[1];
        if (direct) return direct;
        try {
          const parsed = JSON.parse(value);
          const stack = [parsed];
          while (stack.length) {
            const item = stack.pop();
            if (!item || typeof item !== "object") continue;
            for (const [field, fieldValue] of Object.entries(item)) {
              if (/token|access/i.test(field) && typeof fieldValue === "string") {
                const token = fieldValue.match(/(github_pat_[A-Za-z0-9_]+|ghp_[A-Za-z0-9_]+)/)?.[1];
                if (token) return token;
              }
              if (typeof fieldValue === "object") stack.push(fieldValue);
            }
          }
        } catch {
          // Ignore non-JSON storage values.
        }
      }
    }
    return "";
  }

  async function githubContents(path, token) {
    const url = `https://api.github.com/repos/${OWNER}/${INBOX_REPO}/contents/${path}?ref=${BRANCH}`;
    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github+json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (response.status === 401 || response.status === 403 || response.status === 404) {
      throw new Error("讀不到私人 GitHub 收件匣。請確認 token 有 repo 權限，並且你能讀 Calumai/calumai-blog-inbox。");
    }
    if (!response.ok) throw new Error(`GitHub 回應 ${response.status}`);
    return response.json();
  }

  function hasFile(files, name) {
    return files.some((file) => file.type === "file" && file.name.toLowerCase() === name.toLowerCase());
  }

  function hasDir(files, name) {
    return files.some((file) => file.type === "dir" && file.name.toLowerCase() === name.toLowerCase());
  }

  async function loadSubmissions(token) {
    const root = await githubContents("submissions", token);
    const dirs = root
      .filter((item) => item.type === "dir" && item.name !== "_template")
      .sort((a, b) => b.name.localeCompare(a.name, "zh-Hant"));

    const rows = [];
    for (const dir of dirs.slice(0, 30)) {
      const files = await githubContents(`submissions/${dir.name}`, token);
      rows.push({
        id: dir.name,
        htmlUrl: dir.html_url,
        article: hasFile(files, "article.md"),
        imageSources: hasFile(files, "IMAGE_SOURCES.md"),
        ready: hasFile(files, "READY_FOR_BLOG.md"),
        assets: hasDir(files, "assets"),
        sources: hasDir(files, "sources"),
      });
    }
    return rows;
  }

  function importCommand(id) {
    return `cd C:\\Users\\asd81\\Documents\\CalumAi\\blog-content && node scripts\\import-blog-inbox.js ..\\calumai-blog-inbox ${id}`;
  }

  function pullCommand() {
    return "cd C:\\Users\\asd81\\Documents\\CalumAi\\calumai-blog-inbox && git pull";
  }

  async function copyText(text, label) {
    await navigator.clipboard.writeText(text);
    showNotice(`已複製：${label}`);
  }

  function renderRows(rows) {
    if (!rows.length) {
      return `<p>目前沒有看到交件資料夾。</p>`;
    }
    return rows.map((row) => {
      const missing = [
        row.article ? null : "缺 article.md",
        row.imageSources ? null : "缺 IMAGE_SOURCES.md",
      ].filter(Boolean);
      return `
        <div class="submission">
          <div class="submission-title">
            <span>${escapeHtml(row.id)}</span>
            <span>${row.ready ? "READY" : "WRITING"}</span>
          </div>
          <div class="badges">
            <span class="badge ${row.article ? "" : "bad"}">${row.article ? "有 article.md" : "缺 article.md"}</span>
            <span class="badge ${row.imageSources ? "" : "bad"}">${row.imageSources ? "有 IMAGE_SOURCES.md" : "缺 IMAGE_SOURCES.md"}</span>
            <span class="badge ${row.assets ? "" : "warn"}">${row.assets ? "有 assets/" : "無 assets/"}</span>
            <span class="badge ${row.sources ? "" : "warn"}">${row.sources ? "有 sources/" : "無 sources/"}</span>
            <span class="badge ${row.ready ? "" : "warn"}">${row.ready ? "可處理" : "尚未 READY"}</span>
          </div>
          ${missing.length ? `<p class="hint">還不能匯入：${missing.map(escapeHtml).join("、")}</p>` : `<p class="hint">可先拉取本機收件匣，再執行匯入指令。</p>`}
          <div class="actions">
            <a class="button secondary" href="${row.htmlUrl}" target="_blank" rel="noopener noreferrer">GitHub 打開</a>
            <button class="secondary" type="button" data-copy-id="${escapeHtml(row.id)}">複製交件 ID</button>
            <button type="button" data-copy-command="${escapeHtml(row.id)}">複製匯入指令</button>
          </div>
        </div>
      `;
    }).join("");
  }

  const panel = document.createElement("section");
  panel.id = PANEL_ID;
  panel.setAttribute("aria-label", "GitHub 收件匣");
  panel.innerHTML = `
    <h2>GitHub 收件匣</h2>
    <p>讀取 <code>${OWNER}/${INBOX_REPO}</code> 的 <code>submissions/</code>，幫你看有沒有新的部落格交件。</p>
    <p class="hint">注意：這個面板先做「讀取與複製匯入指令」。真正匯入仍要在本機執行，避免瀏覽器直接亂改文章庫。</p>
    <label for="calumai-inbox-token">GitHub token（只存在這台瀏覽器）</label>
    <input id="calumai-inbox-token" type="password" autocomplete="off" placeholder="如果 Sveltia token 讀不到，再貼有 repo 權限的 GitHub token">
    <div class="actions">
      <button type="button" data-action="load">讀取收件匣</button>
      <button class="secondary" type="button" data-action="copy-pull">複製更新本機收件匣指令</button>
      <button class="danger" type="button" data-action="clear-token">清除 token</button>
      <a class="button secondary" href="https://github.com/${OWNER}/${INBOX_REPO}/tree/${BRANCH}/submissions" target="_blank" rel="noopener noreferrer">直接打開 GitHub</a>
    </div>
    <div id="calumai-inbox-result" class="hint">按「讀取收件匣」開始。</div>
  `;

  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.textContent = "📥 GitHub 收件匣";

  async function handleLoad() {
    const tokenInput = panel.querySelector("#calumai-inbox-token");
    const result = panel.querySelector("#calumai-inbox-result");
    const token = tokenInput.value.trim() || getStoredToken();
    if (!token) {
      result.innerHTML = "需要 GitHub token 才能讀私人收件匣。請貼 token 後再按一次。";
      return;
    }
    localStorage.setItem(TOKEN_KEY, token);
    tokenInput.value = token;
    result.innerHTML = "讀取中...";
    try {
      const rows = await loadSubmissions(token);
      result.innerHTML = renderRows(rows);
    } catch (error) {
      result.innerHTML = `<span style="color:#b42318;">${escapeHtml(error.message || error)}</span>`;
    }
  }

  panel.addEventListener("click", async (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    const action = target.dataset.action;
    const id = target.dataset.copyId || target.dataset.copyCommand;
    if (action === "load") await handleLoad();
    if (action === "copy-pull") await copyText(pullCommand(), "更新本機收件匣指令");
    if (action === "clear-token") {
      localStorage.removeItem(TOKEN_KEY);
      panel.querySelector("#calumai-inbox-token").value = "";
      showNotice("已清除這個面板保存的 GitHub token");
    }
    if (target.dataset.copyId) await copyText(id, "交件 ID");
    if (target.dataset.copyCommand) await copyText(importCommand(id), "匯入指令");
  });

  button.addEventListener("click", () => {
    const open = panel.dataset.open !== "true";
    panel.dataset.open = String(open);
    if (open) {
      const token = getStoredToken();
      if (token) panel.querySelector("#calumai-inbox-token").value = token;
    }
  });

  window.addEventListener("load", () => {
    document.body.appendChild(panel);
    document.body.appendChild(button);
  });
})();

