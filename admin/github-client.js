(function attachGithubClient(root) {
  "use strict";

  const API = "https://api.github.com";
  const AUTH_BASE = "https://sveltia-cms-auth.islanduni.workers.dev";
  const AUTH_ORIGIN = new URL(AUTH_BASE).origin;
  const OWNER = "Calumai";
  const CONTENT_REPO = "blog-content";
  const INBOX_REPO = "calumai-blog-inbox";
  const BRANCH = "main";

  class GithubError extends Error {
    constructor(message, status = 0, data = null) {
      super(message);
      this.name = "GithubError";
      this.status = status;
      this.data = data;
    }
  }

  function bytesToBase64(bytes) {
    const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    let binary = "";
    const chunk = 0x8000;
    for (let index = 0; index < view.length; index += chunk) {
      binary += String.fromCharCode(...view.subarray(index, Math.min(index + chunk, view.length)));
    }
    return btoa(binary);
  }

  function base64ToBytes(value) {
    const binary = atob(String(value || "").replace(/\s/g, ""));
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    return bytes;
  }

  function base64ToText(value) {
    return new TextDecoder().decode(base64ToBytes(value));
  }

  function mimeFromPath(filePath) {
    const extension = String(filePath || "").split(".").pop().toLowerCase();
    return ({
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
      svg: "image/svg+xml",
      avif: "image/avif",
    })[extension] || "application/octet-stream";
  }

  function inboxRelativePath(id, filePath) {
    const prefix = `submissions/${id}/`;
    const value = String(filePath || "");
    return value.startsWith(prefix) ? value.slice(prefix.length) : "";
  }

  function findInboxFile(id, files, relativePath) {
    const expected = String(relativePath || "").toLowerCase();
    return (files || []).find((file) => inboxRelativePath(id, file.path).toLowerCase() === expected) || null;
  }

  function inspectInboxSubmission({ id, files = [], imported = false, raw = "" }, core) {
    if (!core?.parseArticle || !core?.plainExcerpt || !core?.validateAssetReferences) {
      throw new GithubError("收件匣驗證元件沒有載入，請重新整理後再試一次。");
    }

    const articleFile = findInboxFile(id, files, "article.md");
    const imageSourcesFile = findInboxFile(id, files, "IMAGE_SOURCES.md");
    const problems = [];
    let article = null;
    let inboxDisposition = "";
    let inboxDispositionLabel = "";

    if (!articleFile) {
      problems.push({ code: "missing_article", message: "缺少 article.md" });
    } else {
      article = core.parseArticle(raw, id);
      if (!String(article.title || "").trim()) {
        problems.push({ code: "empty_title", message: "article.md 沒有文章標題" });
      }
      const sourceStatus = String(article.status || "").trim().toLowerCase();
      if (sourceStatus === "withdrawn" || sourceStatus === "rejected" || sourceStatus === "cancelled") {
        inboxDisposition = "withdrawn";
        inboxDispositionLabel = "已撤回";
        problems.push({ code: "withdrawn", message: "這篇投稿已撤回，不會再次帶入文章清單" });
      } else if (sourceStatus === "split" || sourceStatus === "index") {
        inboxDisposition = "index";
        inboxDispositionLabel = "交件索引";
        problems.push({ code: "submission_index", message: "這是交件索引，不是要發布的單篇文章" });
      } else if (!new Set(["submitted", "awaiting_human_review", "draft"]).has(sourceStatus)) {
        problems.push({ code: "invalid_submission_status", message: `投稿狀態「${sourceStatus || "空白"}」不是可匯入狀態` });
      }
      const assetInventory = files
        .map((file) => inboxRelativePath(id, file.path))
        .filter((relative) => /^assets\/[^/]/i.test(relative));
      for (const error of core.validateAssetReferences(article, assetInventory)) {
        const label = error.field === "featureImage" ? "封面" : "內文";
        if (error.code === "missing_asset") {
          problems.push({
            code: "missing_asset",
            field: error.field,
            reference: error.reference,
            message: `${label}找不到圖片「${error.reference}」`,
          });
        } else if (error.code === "invalid_asset_reference") {
          problems.push({
            code: "invalid_asset_reference",
            field: error.field,
            reference: error.reference,
            message: error.reason === "remote_image_not_uploaded"
              ? `${label}使用外部網址圖片；請先下載並放進 assets/：「${error.reference}」`
              : `${label}圖片路徑不安全或不在 assets/ 資料夾內：「${error.reference}」`,
          });
        }
      }
    }

    if (!imageSourcesFile) {
      problems.push({ code: "missing_image_sources", message: "缺少 IMAGE_SOURCES.md" });
    }

    const title = String(article?.title || "").trim();
    const excerpt = String(article?.excerpt || "").trim()
      || (article ? core.plainExcerpt(article.body, 150) : "");
    return {
      id,
      files,
      imported,
      hasArticle: Boolean(articleFile),
      hasImageSources: Boolean(imageSourcesFile),
      imageCount: files.filter((file) => /^assets\//i.test(inboxRelativePath(id, file.path))).length,
      title,
      excerpt,
      problems,
      missingReasons: problems.map((problem) => problem.message),
      inboxDisposition,
      inboxDispositionLabel,
      canImport: !imported && problems.length === 0,
    };
  }

  function incompleteInboxError(problems) {
    const error = new GithubError(`這份投稿暫時不能帶入：${problems.map((problem) => problem.message).join("；")}`, 422, { problems });
    error.code = "INBOX_INCOMPLETE";
    error.userMessage = error.message;
    return error;
  }

  function waitForGithubSignIn() {
    return new Promise((resolve, reject) => {
      const width = 720;
      const height = 760;
      const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
      const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
      const authUrl = `${AUTH_BASE}/auth?provider=github&site_id=${encodeURIComponent(location.origin)}`;
      const popup = window.open(authUrl, "calumai-github-login", `popup=yes,width=${width},height=${height},left=${left},top=${top}`);
      if (!popup) {
        reject(new GithubError("登入視窗被瀏覽器擋住了，請允許這個網站開啟彈出視窗。"));
        return;
      }

      let finished = false;
      const cleanup = () => {
        finished = true;
        window.removeEventListener("message", onMessage);
        window.clearInterval(closedTimer);
        window.clearTimeout(timeout);
        try { popup.close(); } catch { /* no-op */ }
      };
      const fail = (message) => {
        cleanup();
        reject(new GithubError(message));
      };
      const onMessage = (event) => {
        if (event.origin !== AUTH_ORIGIN || event.source !== popup || typeof event.data !== "string") return;
        if (event.data === "authorizing:github") {
          popup.postMessage("authorizing:github", AUTH_ORIGIN);
          return;
        }
        const successPrefix = "authorization:github:success:";
        const errorPrefix = "authorization:github:error:";
        if (event.data.startsWith(successPrefix)) {
          try {
            const payload = JSON.parse(event.data.slice(successPrefix.length));
            if (!payload.token) throw new Error("missing token");
            cleanup();
            resolve(payload.token);
          } catch {
            fail("GitHub 登入完成，但沒有收到可用權限。請再登入一次。");
          }
        } else if (event.data.startsWith(errorPrefix)) {
          try {
            const payload = JSON.parse(event.data.slice(errorPrefix.length));
            fail(payload.error || "GitHub 登入沒有完成。");
          } catch {
            fail("GitHub 登入沒有完成。");
          }
        }
      };
      window.addEventListener("message", onMessage);
      const closedTimer = window.setInterval(() => {
        if (!finished && popup.closed) fail("登入視窗已關閉，文章沒有受到影響。");
      }, 500);
      const timeout = window.setTimeout(() => fail("登入等待時間過久，請重新登入。"), 5 * 60 * 1000);
    });
  }

  class GithubClient {
    constructor(token) {
      this.token = token;
    }

    async request(path, options = {}) {
      const response = await fetch(`${API}${path}`, {
        ...options,
        cache: "no-store",
        headers: {
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          Authorization: `Bearer ${this.token}`,
          ...(options.headers || {}),
        },
      });
      if (response.status === 204) return null;
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        const error = new GithubError(data?.message || `GitHub 回應 ${response.status}`, response.status, data);
        if (response.status === 401) error.userMessage = "GitHub 登入已過期，請重新登入。";
        if (response.status === 403) error.userMessage = "這個 GitHub 帳號目前沒有足夠權限。";
        if (response.status === 404) error.userMessage = "找不到指定資料，可能已在另一台電腦刪除。";
        if (response.status === 409 || response.status === 422) error.userMessage = "另一台電腦剛好也有修改，請重新載入後再儲存。";
        throw error;
      }
      return data;
    }

    async verify() {
      const [user, repo] = await Promise.all([
        this.request("/user"),
        this.request(`/repos/${OWNER}/${CONTENT_REPO}`),
      ]);
      if (!repo?.permissions?.push) throw new GithubError("這個帳號只能讀取，沒有文章儲存權限。", 403);
      return { user, repo };
    }

    async repositoryState(repo = CONTENT_REPO) {
      const ref = await this.request(`/repos/${OWNER}/${repo}/git/ref/heads/${BRANCH}`);
      const commit = await this.request(`/repos/${OWNER}/${repo}/git/commits/${ref.object.sha}`);
      const tree = await this.request(`/repos/${OWNER}/${repo}/git/trees/${commit.tree.sha}?recursive=1`);
      if (tree.truncated) throw new GithubError("GitHub 回傳的檔案清單不完整，為了避免覆寫，已停止這次操作。");
      return { headSha: ref.object.sha, treeSha: commit.tree.sha, entries: tree.tree || [] };
    }

    async blob(repo, sha) {
      return this.request(`/repos/${OWNER}/${repo}/git/blobs/${sha}`);
    }

    async blobText(repo, sha) {
      const data = await this.blob(repo, sha);
      return base64ToText(data.content);
    }

    async blobObjectUrl(repo, sha, filePath) {
      const data = await this.blob(repo, sha);
      const bytes = base64ToBytes(data.content);
      return URL.createObjectURL(new Blob([bytes], { type: mimeFromPath(filePath) }));
    }

    async listArticles() {
      const state = await this.repositoryState(CONTENT_REPO);
      const articleEntries = state.entries.filter((entry) => entry.type === "blob" && /^posts\/[^/]+\/article\.md$/i.test(entry.path));
      const articles = await Promise.all(articleEntries.map(async (entry) => {
        const id = entry.path.split("/")[1];
        const raw = await this.blobText(CONTENT_REPO, entry.sha);
        return { id, raw, articleSha: entry.sha };
      }));
      return { ...state, articles };
    }

    async loadArticle(id) {
      const state = await this.repositoryState(CONTENT_REPO);
      const articlePath = `posts/${id}/article.md`;
      const articleEntry = state.entries.find((entry) => entry.type === "blob" && entry.path === articlePath);
      if (!articleEntry) throw new GithubError("這篇文章已不存在，請回文章清單重新整理。", 404);
      const raw = await this.blobText(CONTENT_REPO, articleEntry.sha);
      const prefix = `posts/${id}/`;
      const files = state.entries.filter((entry) => entry.type === "blob" && entry.path.startsWith(prefix));
      return { ...state, id, raw, articleSha: articleEntry.sha, files };
    }

    async createBlob(file) {
      if (typeof file.content === "string") {
        return this.request(`/repos/${OWNER}/${CONTENT_REPO}/git/blobs`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: file.content, encoding: "utf-8" }),
        });
      }
      const bytes = file.bytes instanceof Uint8Array ? file.bytes : new Uint8Array(file.bytes);
      return this.request(`/repos/${OWNER}/${CONTENT_REPO}/git/blobs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: bytesToBase64(bytes), encoding: "base64" }),
      });
    }

    async commitFiles({ files, deletes = [], message, expectedArticle = null, expectedFiles = [] }) {
      const state = await this.repositoryState(CONTENT_REPO);
      const expectations = [...expectedFiles];
      if (expectedArticle?.path && !expectations.some((item) => item.path === expectedArticle.path)) expectations.push(expectedArticle);
      if (expectations.length) {
        const changed = expectations.find((expected) => {
          const current = state.entries.find((entry) => entry.path === expected.path);
          if (expected.sha) return !current || current.type !== "blob" || current.sha !== expected.sha;
          if (current) return true;
          return state.entries.some((entry) => (
            entry.path.startsWith(`${expected.path}/`)
            || (expected.path.startsWith(`${entry.path}/`) && entry.type === "blob")
          ));
        });
        if (changed) {
          const error = new GithubError("另一台電腦已經修改這篇文章。為了保護新內容，這次沒有覆寫。", 409);
          error.code = "EDIT_CONFLICT";
          error.data = { path: changed.path };
          throw error;
        }
      } else {
        const newArticle = files.find((file) => /^posts\/[^/]+\/article\.md$/i.test(file.path));
        const articlePrefix = newArticle ? newArticle.path.replace(/article\.md$/i, "") : "";
        const collision = articlePrefix && state.entries.find((entry) => entry.path.startsWith(articlePrefix));
        if (collision) {
          const error = new GithubError("剛好已有文章或圖片使用相同編號。這次沒有覆寫，請重新新增一次。", 409);
          error.code = "NEW_ARTICLE_CONFLICT";
          throw error;
        }
      }

      // Deleting article.md means deleting the complete article folder. The
      // caller lists every blob it saw when the article was loaded. If another
      // device added a blob under that folder meanwhile, fail instead of
      // leaving an orphan that blocks recreating the same article id later.
      const deletedArticle = deletes.find((filePath) => /^posts\/[^/]+\/article\.md$/i.test(filePath));
      if (deletedArticle) {
        const articlePrefix = deletedArticle.replace(/article\.md$/i, "");
        const plannedDeletes = new Set(deletes);
        const unexpected = state.entries.find((entry) => (
          entry.type === "blob"
          && entry.path.startsWith(articlePrefix)
          && !plannedDeletes.has(entry.path)
        ));
        if (unexpected) {
          const error = new GithubError("文章資料夾已在其他裝置新增檔案，請重新載入後再刪除。", 409);
          error.code = "EDIT_CONFLICT";
          error.data = { path: unexpected.path };
          throw error;
        }
      }

      const blobs = await Promise.all(files.map((file) => this.createBlob(file)));
      const treeEntries = files.map((file, index) => ({ path: file.path, mode: "100644", type: "blob", sha: blobs[index].sha }));
      for (const filePath of deletes) treeEntries.push({ path: filePath, mode: "100644", type: "blob", sha: null });

      const tree = await this.request(`/repos/${OWNER}/${CONTENT_REPO}/git/trees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ base_tree: state.treeSha, tree: treeEntries }),
      });
      const commit = await this.request(`/repos/${OWNER}/${CONTENT_REPO}/git/commits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, tree: tree.sha, parents: [state.headSha] }),
      });
      try {
        await this.request(`/repos/${OWNER}/${CONTENT_REPO}/git/refs/heads/${BRANCH}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sha: commit.sha, force: false }),
        });
      } catch (error) {
        if (error.status === 409 || error.status === 422) {
          error.code = "EDIT_CONFLICT";
          error.userMessage = "另一台電腦剛好先完成儲存，請重新載入後再試一次。";
        }
        throw error;
      }
      return { commitSha: commit.sha, fileShas: Object.fromEntries(files.map((file, index) => [file.path, blobs[index].sha])) };
    }

    async workflowForCommit(commitSha) {
      const result = await this.request(`/repos/${OWNER}/${CONTENT_REPO}/actions/runs?head_sha=${encodeURIComponent(commitSha)}&per_page=5`);
      return (result.workflow_runs || []).find((run) => run.path?.endsWith("publish.yml")) || result.workflow_runs?.[0] || null;
    }

    async deploymentContainsCommit(requiredSha, deployedSha) {
      if (!requiredSha || !deployedSha) return false;
      if (String(requiredSha).toLowerCase() === String(deployedSha).toLowerCase()) return true;
      const comparison = await this.request(`/repos/${OWNER}/${CONTENT_REPO}/compare/${encodeURIComponent(requiredSha)}...${encodeURIComponent(deployedSha)}`);
      return comparison?.status === "ahead" || comparison?.status === "identical";
    }

    async listInbox(core) {
      const [inbox, content] = await Promise.all([
        this.repositoryState(INBOX_REPO),
        this.repositoryState(CONTENT_REPO),
      ]);
      const groups = new Map();
      for (const entry of inbox.entries) {
        const match = entry.path.match(/^submissions\/([^/]+)\/(.+)$/);
        if (!match || match[1] === "_template" || entry.type !== "blob") continue;
        if (!groups.has(match[1])) groups.set(match[1], []);
        groups.get(match[1]).push(entry);
      }
      const imported = new Set(content.entries
        .map((entry) => entry.path.match(/^posts\/([^/]+)\/article\.md$/)?.[1])
        .filter(Boolean));
      const rows = await Promise.all([...groups.entries()].map(async ([id, files]) => {
        const articleFile = findInboxFile(id, files, "article.md");
        const raw = articleFile ? await this.blobText(INBOX_REPO, articleFile.sha) : "";
        return inspectInboxSubmission({ id, files, imported: imported.has(id), raw }, core);
      }));
      return rows.sort((a, b) => b.id.localeCompare(a.id));
    }

    async importInboxSubmission(row, core) {
      if (row.imported) throw new GithubError("這份投稿已經在文章清單裡。", 409);
      const sourceArticle = findInboxFile(row.id, row.files, "article.md");
      const raw = sourceArticle ? await this.blobText(INBOX_REPO, sourceArticle.sha) : "";
      const inspection = inspectInboxSubmission({ ...row, raw }, core);
      if (inspection.problems.length) throw incompleteInboxError(inspection.problems);
      const parsed = core.parseArticle(raw, row.id);
      parsed.id = row.id;
      parsed.slug = parsed.slug || row.id.replace(/^\d{8}-/, "");
      parsed.status = "awaiting_human_review";
      const built = core.buildArticle(parsed, "awaiting_human_review");
      const files = [{ path: `posts/${row.id}/article.md`, content: built.content }];
      for (const source of row.files) {
        const relative = inboxRelativePath(row.id, source.path);
        if (relative.toLowerCase() === "article.md") continue;
        if (!/^(IMAGE_SOURCES\.md|assets\/|sources\/)/i.test(relative)) continue;
        const data = await this.blob(INBOX_REPO, source.sha);
        const bytes = base64ToBytes(data.content);
        if (/^assets\//i.test(relative)) {
          const imageErrors = core.validateImageBytes?.(relative, bytes) || [];
          if (imageErrors.length) {
            const error = new GithubError(`圖片「${relative}」不是安全、完整的圖片，沒有帶入。請重新匯出成 PNG 或 JPG。`, 422, { problems: imageErrors });
            error.code = "UNSAFE_IMAGE";
            error.userMessage = error.message;
            throw error;
          }
        }
        files.push({ path: `posts/${row.id}/${relative}`, bytes });
      }
      return this.commitFiles({ files, message: `Import blog inbox submission: ${row.id}` });
    }
  }

  const api = {
    AUTH_BASE,
    CONTENT_REPO,
    GithubClient,
    GithubError,
    OWNER,
    base64ToBytes,
    inspectInboxSubmission,
    mimeFromPath,
    signIn: waitForGithubSignIn,
  };
  root.CalumAiGithub = api;
  if (typeof module === "object" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
