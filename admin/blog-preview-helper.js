(() => {
  "use strict";

  const BUTTON_ID = "calumai-blog-preview-button";
  const NOTICE_ID = "calumai-blog-preview-notice";

  const style = document.createElement("style");
  style.textContent = `
    #${BUTTON_ID} {
      position: fixed;
      right: 18px;
      bottom: 72px;
      z-index: 99999;
      border: 1px solid rgba(36, 86, 66, 0.24);
      border-radius: 999px;
      background: #fffaf0;
      color: #245642;
      box-shadow: 0 14px 34px rgba(31, 41, 36, 0.16);
      cursor: pointer;
      font: 800 14px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 13px 17px;
    }
    #${BUTTON_ID}:hover { background: #f5ecda; }
    #${NOTICE_ID} {
      position: fixed;
      left: 50%;
      bottom: 128px;
      z-index: 100000;
      max-width: min(560px, calc(100vw - 36px));
      transform: translateX(-50%);
      border-radius: 16px;
      background: #17201c;
      color: #fff;
      box-shadow: 0 18px 50px rgba(31, 41, 36, 0.28);
      font: 600 14px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 13px 16px;
    }
  `;
  document.head.appendChild(style);

  function visible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function contextText(element) {
    const region = element.closest("label, [class*='field'], [class*='Field'], [data-testid], div") || element.parentElement;
    return [
      element.getAttribute("aria-label"),
      element.getAttribute("name"),
      element.getAttribute("placeholder"),
      element.id,
      region?.textContent,
    ].filter(Boolean).join(" ");
  }

  function showNotice(message) {
    document.getElementById(NOTICE_ID)?.remove();
    const notice = document.createElement("div");
    notice.id = NOTICE_ID;
    notice.textContent = message;
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 6200);
  }

  function findFolderId() {
    const candidates = [...document.querySelectorAll("input:not([type='file']), textarea")]
      .filter(visible)
      .map((element) => {
        const text = contextText(element);
        let score = 0;
        if (/folder_id|資料夾編號/i.test(text)) score += 20;
        if (/^\d{8}-[a-z0-9-]+$/.test(String(element.value || "").trim())) score += 10;
        if (/slug|網址|title|標題|summary|摘要|body|內文/i.test(text)) score -= 6;
        return { element, score };
      })
      .sort((a, b) => b.score - a.score);

    const value = String(candidates.find((item) => item.score > 0)?.element?.value || "").trim();
    return /^\d{8}-[a-z0-9-]+$/.test(value) ? value : "";
  }

  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.textContent = "打開部落格預覽";
  button.addEventListener("click", () => {
    const folderId = findFolderId();
    if (!folderId) {
      showNotice("我找不到這篇文章的「資料夾編號」。請先確認你在部落格文章編輯頁，且資料夾編號像 20260722-my-post。");
      return;
    }

    showNotice("如果剛剛才儲存，請等自動發布跑完後再重新整理預覽頁。");
    window.open(`/admin/previews/blog/${encodeURIComponent(folderId)}/`, "_blank", "noopener,noreferrer");
  });

  window.addEventListener("load", () => {
    document.body.appendChild(button);
  });
})();
