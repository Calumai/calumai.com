(() => {
  "use strict";

  const MARKDOWN_FILE = /\.(md|markdown)$/i;
  const NOTICE_ID = "calumai-md-import-notice";
  const BUTTON_ID = "calumai-md-import-button";

  const style = document.createElement("style");
  style.textContent = `
    #${BUTTON_ID} {
      position: fixed;
      right: 18px;
      bottom: 18px;
      z-index: 99999;
      border: 0;
      border-radius: 999px;
      background: #245642;
      color: #fff;
      box-shadow: 0 14px 34px rgba(31, 41, 36, 0.24);
      cursor: pointer;
      font: 700 14px/1.2 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      padding: 13px 17px;
    }
    #${BUTTON_ID}:hover { background: #1b4434; }
    #${NOTICE_ID} {
      position: fixed;
      left: 50%;
      bottom: 76px;
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
    #${NOTICE_ID}[data-kind="warning"] { background: #8a4b12; }
  `;
  document.head.appendChild(style);

  function visible(element) {
    if (!element) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
  }

  function fieldText(element) {
    const region = element.closest("label, [class*='field'], [class*='Field'], [data-testid], div") || element.parentElement;
    return [
      element.getAttribute("aria-label"),
      element.getAttribute("name"),
      element.getAttribute("placeholder"),
      element.id,
      region?.textContent,
    ].filter(Boolean).join(" ");
  }

  function findBodyEditor() {
    const candidates = [...document.querySelectorAll("textarea, [contenteditable='true'], [role='textbox']")]
      .filter(visible)
      .map((element) => {
        const text = fieldText(element);
        let score = 0;
        if (/講義內文|body|markdown/i.test(text)) score += 10;
        if (/備註|notes|summary|摘要|title|標題/i.test(text)) score -= 8;
        if (element.tagName === "TEXTAREA") score += 4;
        return { element, score };
      })
      .sort((a, b) => b.score - a.score);

    return candidates.find((item) => item.score > 0)?.element || null;
  }

  function showNotice(message, kind = "info") {
    document.getElementById(NOTICE_ID)?.remove();
    const notice = document.createElement("div");
    notice.id = NOTICE_ID;
    notice.dataset.kind = kind;
    notice.textContent = message;
    document.body.appendChild(notice);
    setTimeout(() => notice.remove(), 5600);
  }

  function normalizeMarkdownInput(value) {
    return String(value || "")
      .replace(/\r\n/g, "\n")
      .replace(/^\\`\\`\\`/gm, "```")
      .trim();
  }

  function setEditorValue(editor, value) {
    editor.focus();

    if (editor.tagName === "TEXTAREA" || editor.tagName === "INPUT") {
      const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(editor), "value");
      if (descriptor?.set) descriptor.set.call(editor, value);
      else editor.value = value;
      editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste", data: value }));
      editor.dispatchEvent(new Event("change", { bubbles: true }));
      return true;
    }

    document.getSelection()?.selectAllChildren(editor);
    const inserted = document.execCommand?.("insertText", false, value);
    editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertFromPaste", data: value }));
    editor.dispatchEvent(new Event("change", { bubbles: true }));
    return Boolean(inserted);
  }

  function importMarkdownFile(file) {
    if (!file || !MARKDOWN_FILE.test(file.name)) return;

    const reader = new FileReader();
    reader.addEventListener("load", () => {
      const editor = findBodyEditor();
      if (!editor) {
        showNotice("我讀到 Markdown 檔了，但找不到「講義內文」欄位。請先點一下講義內文欄位，再按右下角「匯入 .md 到講義內文」。", "warning");
        return;
      }

      const ok = setEditorValue(editor, normalizeMarkdownInput(reader.result));
      if (ok) showNotice(`已把「${file.name}」帶入講義內文。你現在可以在右側預覽排版，儲存後就會發布這份內容。`);
      else showNotice("Markdown 已讀取，但瀏覽器沒有允許自動填入。請按右下角按鈕重試，或手動貼上內容。", "warning");
    });
    reader.addEventListener("error", () => {
      showNotice(`讀取「${file.name}」失敗，請確認檔案是一般文字格式的 .md。`, "warning");
    });
    reader.readAsText(file);
  }

  document.addEventListener("change", (event) => {
    const input = event.target?.closest?.("input[type='file']");
    const markdownFile = [...(input?.files || [])].find((file) => MARKDOWN_FILE.test(file.name));
    if (markdownFile) setTimeout(() => importMarkdownFile(markdownFile), 250);
  }, true);

  const button = document.createElement("button");
  button.id = BUTTON_ID;
  button.type = "button";
  button.textContent = "匯入 .md 到講義內文";
  button.addEventListener("click", () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".md,.markdown,text/markdown,text/plain";
    input.addEventListener("change", () => importMarkdownFile(input.files?.[0]));
    input.click();
  });

  window.addEventListener("load", () => {
    document.body.appendChild(button);
  });
})();
