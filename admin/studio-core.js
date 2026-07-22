(function attachStudioCore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.CalumAiStudioCore = api;
})(typeof globalThis !== "undefined" ? globalThis : window, () => {
  "use strict";

  const STATUS = Object.freeze({
    draft: { label: "草稿", tone: "neutral" },
    awaiting_human_review: { label: "等待確認", tone: "warning" },
    published: { label: "已公開", tone: "success" },
  });

  function resolvePublicationStatus({
    articleStatus,
    registryContainsArticle = false,
    registryChecked = false,
    deploymentChecked = false,
    deploymentContainsHead = false,
  } = {}) {
    const fallback = STATUS[articleStatus] || STATUS.draft;
    if (!registryChecked || !deploymentChecked) {
      if (articleStatus === "published" || registryContainsArticle) {
        return { state: "unknown", label: "公開狀態待確認", tone: "warning" };
      }
      return { state: "local", ...fallback };
    }

    if (articleStatus === "published") {
      if (registryContainsArticle && deploymentContainsHead) {
        return { state: "live", label: "已上線", tone: "success" };
      }
      if (!deploymentContainsHead) {
        return registryContainsArticle
          ? { state: "older-version", label: "網站仍是較早版本／等待部署", tone: "warning" }
          : { state: "publish-pending", label: "等待部署", tone: "warning" };
      }
      return { state: "not-live", label: "尚未上線", tone: "warning" };
    }

    if (registryContainsArticle) {
      return deploymentContainsHead
        ? { state: "still-live", label: "網站仍在線", tone: "danger" }
        : { state: "unpublish-pending", label: "下架待部署", tone: "warning" };
    }
    return { state: "local", ...fallback };
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function splitFrontmatter(raw) {
    const normalized = String(raw || "").replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
    const match = normalized.match(/^---\s*\n([\s\S]*?)\n---\s*\n?/);
    if (!match) return { header: "", body: normalized, hasFrontmatter: false };
    return {
      header: match[1],
      body: normalized.slice(match[0].length),
      hasFrontmatter: true,
    };
  }

  function readHeaderValue(header, key) {
    const lines = String(header || "").split("\n");
    const pattern = new RegExp(`^${escapeRegExp(key)}:\\s*(.*)$`);
    const index = lines.findIndex((line) => pattern.test(line));
    if (index < 0) return "";
    const token = lines[index].match(pattern)?.[1]?.trim() || "";

    if (/^[>|][-+]?$/.test(token)) {
      const chunks = [];
      for (let i = index + 1; i < lines.length; i += 1) {
        if (/^[A-Za-z0-9_]+:\s*/.test(lines[i])) break;
        if (/^\s+/.test(lines[i])) chunks.push(lines[i].replace(/^\s{2}/, ""));
        else if (!lines[i].trim()) chunks.push("");
        else break;
      }
      return token.startsWith(">") ? chunks.join(" ").trim() : chunks.join("\n").trim();
    }

    if (token.startsWith('"')) {
      try { return JSON.parse(token); } catch { return token.slice(1, -1); }
    }
    if (token.startsWith("'") && token.endsWith("'")) return token.slice(1, -1).replace(/''/g, "'");
    if (token === "true") return true;
    if (token === "false") return false;
    if (token === "null" || token === "~") return null;
    if (/^-?\d+(?:\.\d+)?$/.test(token)) return Number(token);
    return token;
  }

  function serializeHeaderValue(value) {
    if (typeof value === "boolean" || typeof value === "number") return String(value);
    if (value === null || value === undefined) return "";
    return JSON.stringify(String(value));
  }

  function readBoolean(value, fallback = false) {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const normalized = String(value ?? "").trim().toLowerCase();
    if (["true", "yes", "on", "1"].includes(normalized)) return true;
    if (["false", "no", "off", "0", ""].includes(normalized)) return false;
    return fallback;
  }

  function replaceHeaderValue(header, key, value) {
    const lines = String(header || "").split("\n");
    const pattern = new RegExp(`^${escapeRegExp(key)}:\\s*`);
    const start = lines.findIndex((line) => pattern.test(line));
    const replacement = `${key}: ${serializeHeaderValue(value)}`;
    if (start < 0) {
      if (lines.length === 1 && !lines[0]) return replacement;
      lines.push(replacement);
      return lines.join("\n");
    }

    let end = start + 1;
    while (end < lines.length) {
      if (/^[A-Za-z0-9_]+:\s*/.test(lines[end])) break;
      if (/^\s+/.test(lines[end]) || !lines[end].trim()) end += 1;
      else break;
    }
    lines.splice(start, end - start, replacement);
    return lines.join("\n");
  }

  function removeHeaderValue(header, key) {
    const lines = String(header || "").split("\n");
    const pattern = new RegExp(`^${escapeRegExp(key)}:\\s*`);
    const start = lines.findIndex((line) => pattern.test(line));
    if (start < 0) return String(header || "");
    let end = start + 1;
    while (end < lines.length) {
      if (/^[A-Za-z0-9_]+:\s*/.test(lines[end])) break;
      if (/^\s+/.test(lines[end]) || !lines[end].trim()) end += 1;
      else break;
    }
    lines.splice(start, end - start);
    return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  function normalizeBody(body, title = "") {
    let value = String(body || "").replace(/\r\n/g, "\n").trim();
    const firstHeading = value.match(/^#\s+(.+)\n+/);
    if (firstHeading && (!title || firstHeading[1].trim() === String(title).trim())) {
      value = value.slice(firstHeading[0].length).trimStart();
    }
    return value;
  }

  function plainExcerpt(body, max = 150) {
    const text = String(body || "")
      .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[`*_>#|~-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length <= max) return text;
    return `${text.slice(0, max - 1).trim()}…`;
  }

  function slugifyTitle(value, fallback = "article") {
    const slug = String(value || "")
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 64);
    return slug || fallback;
  }

  function dateStamp(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Taipei",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}${value.month}${value.day}`;
  }

  function timeStamp(date = new Date()) {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Taipei",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).formatToParts(date);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.hour}${value.minute}${value.second}`;
  }

  function makeIdentity(title, now = new Date()) {
    const fallback = `article-${timeStamp(now)}`;
    const slug = slugifyTitle(title, fallback);
    return { id: `${dateStamp(now)}-${slug}`, slug };
  }

  function sanitizeFilename(name) {
    const raw = String(name || "image").replace(/\\/g, "/").split("/").pop() || "image";
    const dot = raw.lastIndexOf(".");
    const extension = dot > 0
      ? raw.slice(dot + 1).normalize("NFKD").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 16)
      : "";
    let base = (dot > 0 ? raw.slice(0, dot) : raw)
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/[-_.]{2,}/g, "-")
      .replace(/^[-_.]+|[-_.]+$/g, "");
    if (!base || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(base)) base = "image";
    const maxBaseLength = Math.max(1, 80 - (extension ? extension.length + 1 : 0));
    base = base.slice(0, maxBaseLength).replace(/^[-_.]+|[-_.]+$/g, "") || "image";
    return `${base}${extension ? `.${extension}` : ""}`;
  }

  function uniqueFilename(name, used = new Set()) {
    const safe = sanitizeFilename(name);
    if (!used.has(safe.toLowerCase())) return safe;
    const dot = safe.lastIndexOf(".");
    const base = dot > 0 ? safe.slice(0, dot) : safe;
    const extension = dot > 0 ? safe.slice(dot) : "";
    let index = 2;
    let candidate = `${base}-${index}${extension}`;
    while (used.has(candidate.toLowerCase())) candidate = `${base}-${index += 1}${extension}`;
    return candidate;
  }

  function parseArticle(raw, id = "") {
    const parts = splitFrontmatter(raw);
    const title = String(readHeaderValue(parts.header, "title") || "");
    const body = normalizeBody(parts.body, title);
    return {
      // A caller-supplied id comes from the real repository folder and is the
      // trusted identity. Frontmatter can be stale or damaged and must not
      // redirect a later save into a different posts/ namespace.
      id: String(id || readHeaderValue(parts.header, "folder_id") || ""),
      slug: String(readHeaderValue(parts.header, "slug") || ""),
      title,
      excerpt: String(readHeaderValue(parts.header, "excerpt") || readHeaderValue(parts.header, "summary") || ""),
      status: String(readHeaderValue(parts.header, "status") || "draft"),
      category: String(readHeaderValue(parts.header, "category") || ""),
      author: String(readHeaderValue(parts.header, "author") || "CalumAi Studio"),
      featureImage: String(readHeaderValue(parts.header, "feature_image") || ""),
      featureImageAlt: String(readHeaderValue(parts.header, "feature_image_alt") || ""),
      featured: readBoolean(readHeaderValue(parts.header, "featured"), false),
      imageSourceType: String(readHeaderValue(parts.header, "image_source_type") || "none"),
      imageSourcePath: String(readHeaderValue(parts.header, "image_source_path") || ""),
      body,
      raw: String(raw || ""),
      header: parts.header,
    };
  }

  function buildArticle(article, status = article.status || "draft") {
    const generated = makeIdentity(article.title);
    const identity = {
      slug: String(article.slug || generated.slug),
      id: String(article.id || `${dateStamp()}-${article.slug || generated.slug}`),
    };
    const body = normalizeBody(article.body, article.title);
    let header = article.header || "";
    const excerpt = String(article.excerpt || plainExcerpt(body));
    const imageType = article.featureImage || extractAssetPaths(body).length
      ? (article.imageSourceType && article.imageSourceType !== "none" ? article.imageSourceType : "original_upload")
      : "none";

    const values = {
      title: article.title,
      slug: identity.slug,
      folder_id: identity.id,
      excerpt,
      status,
      approval_required: true,
      featured: Boolean(article.featured),
      author: article.author || "CalumAi Studio",
      category: article.category || "製作心得",
      image_source_type: imageType,
    };
    for (const [key, value] of Object.entries(values)) header = replaceHeaderValue(header, key, value);

    if (article.featureImage) {
      header = replaceHeaderValue(header, "feature_image", article.featureImage);
      header = replaceHeaderValue(header, "feature_image_alt", article.featureImageAlt || "請填寫圖片說明");
    } else {
      header = removeHeaderValue(removeHeaderValue(header, "feature_image"), "feature_image_alt");
    }
    if (imageType === "none") header = removeHeaderValue(header, "image_source_path");
    else header = replaceHeaderValue(header, "image_source_path", article.imageSourcePath || "IMAGE_SOURCES.md");

    return {
      id: identity.id,
      slug: identity.slug,
      status,
      content: `---\n${header.trim()}\n---\n${body ? `${body}\n` : ""}`,
    };
  }

  function stripMarkdownCode(markdown) {
    const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    let inFence = false;
    return lines.map((line) => {
      if (/^\s*(?:```|\\`\\`\\`)/.test(line)) {
        inFence = !inFence;
        return "";
      }
      if (inFence) return "";
      return line.replace(/`[^`\n]*`/g, "");
    }).join("\n");
  }

  function extractImageReferences(markdown) {
    const references = [];
    const regex = /!\[[^\]]*\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+["'][^"']*["'])?\s*\)/g;
    let match;
    while ((match = regex.exec(stripMarkdownCode(markdown))) !== null) {
      const value = unwrapMarkdownDestination(match[1]);
      if (value && !references.includes(value)) references.push(value);
    }
    return references;
  }

  function imageReferenceKey(raw) {
    const reference = unwrapMarkdownDestination(raw);
    const inspected = inspectAssetReference(reference);
    if (inspected.valid && !inspected.remote) return inspected.path.toLowerCase();
    return String(reference || "").trim().replace(/^\.\//, "").toLowerCase();
  }

  function listMarkdownImages(markdown) {
    const images = [];
    const regex = /!\[([^\]]*)\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+["'][^"']*["'])?\s*\)/g;
    let match;
    const visibleMarkdown = stripMarkdownCode(markdown);
    while ((match = regex.exec(visibleMarkdown)) !== null) {
      images.push({
        alt: match[1],
        reference: unwrapMarkdownDestination(match[2]),
      });
    }
    return images;
  }

  function imageAltFor(markdown, reference) {
    const target = imageReferenceKey(reference);
    return listMarkdownImages(markdown).find((image) => imageReferenceKey(image.reference) === target)?.alt || "";
  }

  function replaceImageAlt(markdown, reference, nextAlt) {
    const target = imageReferenceKey(reference);
    const safeAlt = String(nextAlt || "")
      .replace(/[\r\n]+/g, " ")
      .replace(/[\[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    let inFence = false;
    return lines.map((line) => {
      if (/^\s*(?:```|\\`\\`\\`)/.test(line)) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;
      return line.replace(
        /!\[([^\]]*)\]\(\s*(<[^>]+>|[^\s)]+)((?:\s+["'][^"']*["'])?)\s*\)/g,
        (whole, _oldAlt, destination, title = "") => (
          imageReferenceKey(destination) === target
            ? `![${safeAlt}](${destination}${title})`
            : whole
        ),
      );
    }).join("\n");
  }

  function removeMarkdownImage(markdown, reference) {
    const source = String(markdown || "");
    const target = imageReferenceKey(reference);
    if (!target) return source;

    const lines = source.replace(/\r\n/g, "\n").split("\n");
    const output = [];
    let inFence = false;
    let skipNextBlank = false;
    const imagePattern = /!\[([^\]]*)\]\(\s*(<[^>]+>|[^\s)]+)((?:\s+["'][^"']*["'])?)\s*\)/g;

    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (/^\s*(?:```|\\`\\`\\`|~~~)/.test(line)) {
        inFence = !inFence;
        output.push(line);
        continue;
      }
      if (inFence) {
        output.push(line);
        continue;
      }
      if (skipNextBlank && !line.trim()) {
        skipNextBlank = false;
        continue;
      }
      skipNextBlank = false;

      let removed = false;
      const nextLine = line.replace(imagePattern, (whole, _alt, destination) => {
        if (imageReferenceKey(destination) !== target) return whole;
        removed = true;
        return "";
      });

      if (removed && !nextLine.trim()) {
        const previousIsBlank = output.length > 0 && !output[output.length - 1].trim();
        const nextIsBlank = index + 1 < lines.length && !lines[index + 1].trim();
        if (nextIsBlank && (!output.length || previousIsBlank)) skipNextBlank = true;
        if (!nextIsBlank && index === lines.length - 1 && previousIsBlank) output.pop();
        continue;
      }
      output.push(nextLine);
    }
    return output.join("\n");
  }

  function isRemoteAssetReference(value) {
    return /^https?:\/\//i.test(String(value || "").trim());
  }

  function inspectAssetReference(raw) {
    const original = String(raw || "").trim();
    if (!original) return { valid: false, original, reason: "empty" };
    if (isRemoteAssetReference(original)) return { valid: false, original, remote: true, reason: "remote_image_not_uploaded" };
    if (/^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(original)) {
      return { valid: false, original, reason: "unsafe_scheme" };
    }

    let value = original.replace(/\\/g, "/").split(/[?#]/, 1)[0];
    try {
      value = decodeURIComponent(value).replace(/\\/g, "/");
    } catch {
      // Keep malformed legacy percent signs literal, matching the publisher.
    }
    if (/[\u0000-\u001F\u007F]/.test(value)) return { valid: false, original, reason: "control_character" };
    if (/^(?:\/|[a-z]:\/)/i.test(value)) return { valid: false, original, reason: "absolute_path" };

    const segments = value.split("/").filter((segment) => segment && segment !== ".");
    if (segments.includes("..")) return { valid: false, original, reason: "path_traversal" };
    const path = segments.join("/");
    if (!/^assets\/[^/]/i.test(path)) return { valid: false, original, reason: "outside_assets" };
    if (!/\.(?:png|jpe?g|webp|gif|avif|svg)$/i.test(path)) return { valid: false, original, reason: "unsupported_image_type" };
    return { valid: true, original, remote: false, path };
  }

  function extractAssetPaths(markdown) {
    const paths = [];
    for (const reference of extractImageReferences(markdown)) {
      const inspected = inspectAssetReference(reference);
      if (!inspected.remote) {
        const value = inspected.valid ? inspected.path : reference.replace(/^\.\//, "");
        if (!paths.includes(value)) paths.push(value);
      }
    }
    return paths;
  }

  function inventoryValue(item) {
    if (typeof item === "string") return item;
    if (!item || typeof item !== "object") return "";
    return item.path || item.relativePath || item.name || "";
  }

  function normalizeInventoryPath(item) {
    let value = String(inventoryValue(item) || "").trim().replace(/\\/g, "/");
    const assetMarker = value.toLowerCase().lastIndexOf("/assets/");
    if (assetMarker >= 0) value = value.slice(assetMarker + 1);
    if (value && !value.includes("/")) value = `assets/${value}`;
    const inspected = inspectAssetReference(value);
    return inspected.valid && !inspected.remote ? inspected.path : "";
  }

  function validateAssetReferences(articleOrMarkdown, availableAssets) {
    const article = typeof articleOrMarkdown === "string"
      ? { body: articleOrMarkdown }
      : (articleOrMarkdown || {});
    const references = extractImageReferences(article.body || "").map((reference) => ({
      field: "body",
      reference,
    }));
    const featureImage = article.featureImage ?? article.feature_image;
    if (String(featureImage || "").trim()) {
      references.unshift({ field: "featureImage", reference: String(featureImage).trim() });
    }

    const hasInventory = availableAssets !== undefined && availableAssets !== null;
    const inventoryItems = availableAssets instanceof Set
      ? [...availableAssets]
      : (Array.isArray(availableAssets) ? availableAssets : []);
    const inventory = new Set(inventoryItems.map(normalizeInventoryPath).filter(Boolean));
    const errors = [];
    const seen = new Set();

    for (const item of references) {
      const inspected = inspectAssetReference(item.reference);
      const errorKey = `${item.field}:${item.reference}`;
      if (seen.has(errorKey)) continue;
      seen.add(errorKey);
      if (inspected.remote && inspected.valid) continue;
      if (!inspected.valid) {
        const message = inspected.reason === "remote_image_not_uploaded"
          ? `圖片「${item.reference}」還在外部網站。請先下載後，用「插入圖片」上傳到這篇文章。`
          : `圖片路徑「${item.reference}」不安全或不在 assets/ 資料夾內。`;
        errors.push({
          field: item.field,
          code: "invalid_asset_reference",
          reference: item.reference,
          reason: inspected.reason,
          message,
        });
      } else if (hasInventory && !inventory.has(inspected.path)) {
        errors.push({
          field: item.field,
          code: "missing_asset",
          reference: inspected.path,
          message: `找不到文章引用的圖片「${inspected.path}」。`,
        });
      }
    }
    return errors;
  }

  function resolveAssetInventory(article, options) {
    if (options instanceof Set || Array.isArray(options)) return options;
    if (options && Object.prototype.hasOwnProperty.call(options, "assetPaths")) return options.assetPaths;
    if (options && Object.prototype.hasOwnProperty.call(options, "assets")) return options.assets;
    if (article && Object.prototype.hasOwnProperty.call(article, "assetPaths")) return article.assetPaths;
    if (article && Object.prototype.hasOwnProperty.call(article, "assets")) return article.assets;
    return undefined;
  }

  function validateArticle(article = {}, status = article.status || "draft", options) {
    if (status && typeof status === "object") {
      options = status;
      status = article.status || "draft";
    }
    const errors = [];
    const title = String(article.title || "").trim();
    const body = String(article.body || "").trim();
    const publishing = status === "published";
    if (publishing && !title) errors.push({ field: "title", message: "請先寫文章標題。" });
    if (publishing && !body) errors.push({ field: "body", message: "文章內文還是空白的。" });
    if (!publishing && !title && !body) {
      errors.push({ field: "body", message: "先寫一點標題或內文，就可以儲存草稿。" });
    }
    if (title.length > 100) errors.push({ field: "title", message: "標題請控制在 100 個字以內。" });
    if (publishing && body.length < 40) {
      errors.push({ field: "body", message: "內文太短，請確認不是只留下測試文字。" });
    }
    if (publishing && article.featureImage) {
      const coverAlt = String(article.featureImageAlt || "").trim();
      if (!coverAlt || coverAlt === "請填寫圖片說明") {
        errors.push({ field: "featureImageAlt", message: "請替封面寫一句能說明畫面內容的文字。" });
      }
    }
    if (publishing && listMarkdownImages(body).some((image) => {
      const alt = String(image.alt || "").trim();
      return !alt || alt === "請填寫圖片說明";
    })) {
      errors.push({ field: "body", message: "請替每張內文圖片寫一句能說明畫面內容的文字。" });
    }
    // A half-written draft must remain saveable across devices. Broken or
    // external image references are shown as preview warnings and become hard
    // errors only at the human-controlled publish gate.
    if (publishing) errors.push(...validateAssetReferences(article, resolveAssetInventory(article, options)));
    return errors;
  }

  function validateSvgText(source) {
    const text = String(source || "");
    const errors = [];
    const add = (code, message) => {
      if (!errors.some((item) => item.code === code)) errors.push({ code, message });
    };
    if (!/<svg\b/i.test(text)) add("not_svg", "檔案裡找不到 SVG 圖片內容。");
    if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(text)) add("xml_external_content", "SVG 含有不安全的外部 XML 設定。");
    if (/<\s*(?:[\w.-]+:)?(?:script|foreignObject|iframe|object|embed|audio|video|image|style|animate|animateMotion|animateTransform|set|discard|handler)\b/i.test(text)) add("active_content", "SVG 含有會執行或載入外部內容的元素。");
    if (/\b(?:[\w.-]+:)?on[a-z][a-z0-9_-]*\s*=/i.test(text)) add("event_handler", "SVG 含有會自動執行的事件指令。");
    if (/\bstyle\s*=/i.test(text)) add("active_style", "SVG 含有無法安全檢查的動態樣式。");
    if (/\b(?:javascript|vbscript)\s*:/i.test(text)) add("script_url", "SVG 含有不安全的程式網址。");
    if (/\b(?:[\w.-]+:)?href\s*=\s*["']\s*(?!#)[^"']+/i.test(text)) add("external_reference", "SVG 含有外部連結或檔案參照。");
    if (/(?:@import|expression\s*\(|url\s*\()/i.test(text)) add("css_external_content", "SVG 樣式會載入外部內容。");
    return errors;
  }

  function validateImageBytes(fileName, input) {
    const name = String(fileName || "");
    const extension = name.match(/\.([^.]+)$/)?.[1]?.toLowerCase() || "";
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || 0);
    const ascii = (start, length) => String.fromCharCode(...bytes.subarray(start, start + length));
    if (extension === "svg") return validateSvgText(new TextDecoder().decode(bytes));
    const rasterExtension = /^(?:png|jpe?g|gif|webp|avif)$/.test(extension);
    const header = ascii(0, Math.min(bytes.length, 64));
    const valid = rasterExtension && (
      (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value))
      || (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
      || ascii(0, 6) === "GIF87a"
      || ascii(0, 6) === "GIF89a"
      || (bytes.length >= 12 && ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP")
      || (bytes.length >= 16 && header.slice(4, 8) === "ftyp" && /(?:avif|avis)/.test(header.slice(8)))
    );
    return valid ? [] : [{ code: "invalid_image_signature", message: "檔案內容不是可辨識的安全圖片。" }];
  }

  function safeUrl(raw, assetUrl) {
    const value = String(raw || "").trim();
    if (/^https?:\/\//i.test(value)) return value;
    if (/^(mailto:|#)/i.test(value)) return value;
    if (/^(data:|javascript:|vbscript:|file:|\/\/)/i.test(value)) return "#";
    if (assetUrl) return assetUrl(value.replace(/^\.\//, ""));
    return value.replace(/^\.\//, "");
  }

  function unwrapMarkdownDestination(value) {
    const destination = String(value || "").trim();
    return destination.startsWith("<") && destination.endsWith(">")
      ? destination.slice(1, -1).trim()
      : destination;
  }

  function renderInline(source, options = {}) {
    const tokenPattern = /!\[([^\]]*)\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+["'][^"']*["'])?\s*\)|\[([^\]]+)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)|`([^`]+)`|\*\*([^*]+)\*\*|\*([^*]+)\*/g;
    let output = "";
    let cursor = 0;
    let match;
    const text = String(source || "");
    while ((match = tokenPattern.exec(text)) !== null) {
      output += escapeHtml(text.slice(cursor, match.index));
      if (match[1] !== undefined) {
        const src = safeUrl(unwrapMarkdownDestination(match[2]), options.assetUrl);
        if (src !== "#") output += `<figure><img src="${escapeHtml(src)}" alt="${escapeHtml(match[1])}" loading="lazy"></figure>`;
      } else if (match[3] !== undefined) {
        const href = safeUrl(match[4]);
        const external = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : "";
        output += `<a href="${escapeHtml(href)}"${external}>${escapeHtml(match[3])}</a>`;
      } else if (match[5] !== undefined) output += `<code>${escapeHtml(match[5])}</code>`;
      else if (match[6] !== undefined) output += `<strong>${escapeHtml(match[6])}</strong>`;
      else if (match[7] !== undefined) output += `<em>${escapeHtml(match[7])}</em>`;
      cursor = tokenPattern.lastIndex;
    }
    return output + escapeHtml(text.slice(cursor));
  }

  function fenceMatch(line) {
    return String(line || "").match(/^(?:```|\\`\\`\\`)\s*([\w-]*)\s*$/);
  }

  function isFenceClose(line) {
    return /^(?:```|\\`\\`\\`)\s*$/.test(String(line || ""));
  }

  function collectListItems(lines, start, itemPattern, stripPattern) {
    const items = [];
    let index = start;
    while (index < lines.length && itemPattern.test(lines[index])) {
      items.push(lines[index].replace(stripPattern, ""));
      index += 1;
      const blankStart = index;
      while (index < lines.length && !lines[index].trim()) index += 1;
      if (index >= lines.length || !itemPattern.test(lines[index])) return { items, nextIndex: blankStart };
    }
    return { items, nextIndex: index };
  }

  function renderMarkdown(markdown, options = {}) {
    const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
    const html = [];
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) { index += 1; continue; }

      if (/^\s*---+\s*$/.test(line)) {
        html.push("<hr>");
        index += 1;
        continue;
      }

      const fence = fenceMatch(line);
      if (fence) {
        const code = [];
        index += 1;
        while (index < lines.length && !isFenceClose(lines[index])) code.push(lines[index++]);
        if (index < lines.length) index += 1;
        html.push(`<pre><code${fence[1] ? ` class="language-${escapeHtml(fence[1])}"` : ""}>${escapeHtml(code.join("\n"))}</code></pre>`);
        continue;
      }

      const heading = line.match(/^(#{1,6})\s+(.+)$/);
      if (heading) {
        const level = heading[1].length;
        html.push(`<h${level}>${renderInline(heading[2], options)}</h${level}>`);
        index += 1;
        continue;
      }

      if (/^>\s?/.test(line)) {
        const quote = [];
        while (index < lines.length && /^>\s?/.test(lines[index])) quote.push(lines[index++].replace(/^>\s?/, ""));
        html.push(`<blockquote>${quote.map((item) => renderInline(item, options)).join("<br>")}</blockquote>`);
        continue;
      }

      if (/^\s*[-*+]\s+/.test(line)) {
        const { items, nextIndex } = collectListItems(lines, index, /^\s*[-*+]\s+/, /^\s*[-*+]\s+/);
        index = nextIndex;
        html.push(`<ul>${items.map((item) => `<li>${renderInline(item, options)}</li>`).join("")}</ul>`);
        continue;
      }

      if (/^\s*\d+\.\s+/.test(line)) {
        const { items, nextIndex } = collectListItems(lines, index, /^\s*\d+\.\s+/, /^\s*\d+\.\s+/);
        index = nextIndex;
        html.push(`<ol>${items.map((item) => `<li>${renderInline(item, options)}</li>`).join("")}</ol>`);
        continue;
      }

      if (/^!\[[^\]]*\]\([^)]+\)\s*$/.test(line.trim())) {
        html.push(renderInline(line.trim(), options));
        index += 1;
        continue;
      }

      const tableRow = /^\s*\|(.+)\|\s*$/;
      const isSeparatorRow = (value) => {
        const trimmed = value.trim();
        return /^\|?[\s:|-]+\|?$/.test(trimmed) && trimmed.includes("-");
      };
      const parseRow = (value) => value
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim());

      if (tableRow.test(line) && index + 1 < lines.length && isSeparatorRow(lines[index + 1])) {
        const headerCells = parseRow(line);
        index += 2;
        const bodyRows = [];
        while (index < lines.length && tableRow.test(lines[index])) {
          bodyRows.push(parseRow(lines[index]));
          index += 1;
        }
        const thead = `<thead><tr>${headerCells.map((cell) => `<th>${renderInline(cell, options)}</th>`).join("")}</tr></thead>`;
        const tbody = `<tbody>${bodyRows.map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell, options)}</td>`).join("")}</tr>`).join("")}</tbody>`;
        html.push(`<table>${thead}${tbody}</table>`);
        continue;
      }

      const paragraph = [line.trim()];
      index += 1;
      while (index < lines.length && lines[index].trim() && !/^(#{1,6})\s+|^```|^\\`\\`\\`|^>\s?|^\s*[-*+]\s+|^\s*\d+\.\s+/.test(lines[index])) {
        paragraph.push(lines[index].trim());
        index += 1;
      }
      html.push(`<p>${renderInline(paragraph.join(" "), options)}</p>`);
    }
    return html.join("\n");
  }

  return {
    STATUS,
    buildArticle,
    dateStamp,
    escapeHtml,
    extractAssetPaths,
    extractImageReferences,
    imageAltFor,
    listMarkdownImages,
    makeIdentity,
    normalizeBody,
    parseArticle,
    plainExcerpt,
    readHeaderValue,
    removeMarkdownImage,
    renderMarkdown,
    replaceImageAlt,
    resolvePublicationStatus,
    sanitizeFilename,
    splitFrontmatter,
    stripMarkdownCode,
    uniqueFilename,
    validateAssetReferences,
    validateArticle,
    validateImageBytes,
    validateSvgText,
  };
});
