(() => {
  "use strict";

  const DOCK_ID = "calumai-ai100-review-dock";
  const STORAGE_KEY = "calumai-ai100-review-collapsed";
  const EPISODE_ROUTE = /collections\/episodes|\/episodes\//i;
  let refreshTimer = 0;

  function isReviewPage() {
    const text = `${location.hash} ${document.body?.textContent || ""}`;
    return EPISODE_ROUTE.test(location.hash) || /AI-100|內容編號|講義內文/i.test(text);
  }

  function visible(element) {
    if (!element || element.closest(`#${DOCK_ID}`)) return false;
    const style = window.getComputedStyle(element);
    return style.display !== "none" && style.visibility !== "hidden" && !element.disabled;
  }

  function labelFor(control) {
    const id = control.getAttribute("id");
    const linked = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
    const parent = control.closest('label, fieldset, [role="group"], [data-field], [class*="field"]');
    return `${linked?.textContent || ""} ${parent?.textContent || ""} ${control.getAttribute("aria-label") || ""} ${control.getAttribute("name") || ""} ${control.getAttribute("placeholder") || ""}`.replace(/\s+/g, " ").trim();
  }

  function controlValue(control) {
    if (control.matches("input[type=checkbox], input[type=radio]")) return control.checked;
    if (control.matches("input[type=file]")) return control.files?.length > 0;
    if (control.isContentEditable) return control.textContent.trim();
    return String(control.value || "").trim();
  }

  function controls() {
    return [...document.querySelectorAll("input, textarea, select, [contenteditable=true]")]
      .filter(visible)
      .map((control) => ({ control, label: labelFor(control), value: controlValue(control) }));
  }

  function findControl(pattern) {
    return controls().find((item) => pattern.test(item.label));
  }

  function isVideoLesson() {
    const item = findControl(/內容類型|content.?type/i);
    return !item || /video|影片|youtube/i.test(`${item.value} ${item.label}`);
  }

  function checkState() {
    const all = controls();
    const get = (pattern) => all.find((item) => pattern.test(item.label));
    const id = get(/內容編號|\bid\b/i);
    const title = get(/標題|title/i);
    const type = get(/內容類型|content.?type/i);
    const body = get(/講義內文|\bbody\b|markdown/i);
    const youtube = get(/YouTube 網址|youtube.?url/i);
    const contentApproved = get(/內容看過|content.?approved/i);
    const privacyApproved = get(/私人資料|privacy.?approved/i);
    const youtubeApproved = get(/YouTube 已確認|youtube.?approved/i);
    const status = get(/發布狀態|\bstatus\b/i);
    const video = isVideoLesson();
    const checks = [
      { key: "basic", label: "基本資料：編號、類型、路線、標題", done: Boolean(id?.value && title?.value && type?.value) },
      { key: "handout", label: "講義內文：有可閱讀的詳細步驟", done: Boolean(body?.value) },
      { key: "media", label: video ? "影片資料：YouTube 網址" : "素材資料：圖文講義內容", done: video ? Boolean(youtube?.value) : Boolean(body?.value) },
      { key: "approval", label: "發布確認：內容與隱私檢查完成", done: Boolean(contentApproved?.value && privacyApproved?.value && (!video || youtubeApproved?.value)) },
    ];
    const missing = checks.find((check) => !check.done);
    const preview = [...document.querySelectorAll("a[href]")].find((link) => /previews\/ai100/i.test(link.href));
    return { checks, missing, preview, status: status?.value || "" };
  }

  function firstIncomplete() {
    const state = checkState();
    if (!state.missing) return;
    const patterns = {
      basic: /內容編號|內容類型|路線|標題/i,
      handout: /講義內文|\bbody\b|markdown/i,
      media: /YouTube 網址|youtube.?url|講義內文|\bbody\b/i,
      approval: /內容看過|私人資料|YouTube 已確認|approved/i,
    };
    const item = findControl(patterns[state.missing.key]);
    if (item) {
      item.control.dataset.calumaiReviewMissing = "true";
      item.control.focus({ preventScroll: true });
      item.control.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  function render() {
    const active = isReviewPage();
    document.body.toggleAttribute("data-calumai-ai100-review", active);
    document.body.toggleAttribute("data-calumai-ai100-review-ready", active);
    let dock = document.getElementById(DOCK_ID);
    if (!active) {
      dock?.remove();
      return;
    }
    const state = checkState();
    const done = state.checks.filter((check) => check.done).length;
    if (!dock) {
      dock = document.createElement("aside");
      dock.id = DOCK_ID;
      dock.className = "calumai-review-dock";
      dock.dataset.collapsed = localStorage.getItem(STORAGE_KEY) === "true" ? "true" : "false";
      dock.innerHTML = `<button class="calumai-review-toggle" type="button"><span>AI-100 審稿導引</span><small data-review-count></small></button><div class="calumai-review-body"><h2>發布前檢查</h2><p>先把內容、講義與必要確認做完，再開預覽或發布。</p><div class="calumai-review-progress" aria-hidden="true"><span data-review-progress></span></div><ol class="calumai-review-steps" data-review-steps></ol><div class="calumai-review-actions"><button class="calumai-review-action" type="button" data-review-action="first">跳到第一個待補欄位</button><a class="calumai-review-action" data-review-action="preview" target="_blank" rel="noopener" hidden>打開 AI-100 預覽</a></div><p class="calumai-review-note" data-review-note></p></div>`;
      dock.querySelector(".calumai-review-toggle").addEventListener("click", () => {
        const collapsed = dock.dataset.collapsed !== "true";
        dock.dataset.collapsed = String(collapsed);
        localStorage.setItem(STORAGE_KEY, String(collapsed));
      });
      dock.querySelector('[data-review-action="first"]').addEventListener("click", firstIncomplete);
      document.body.appendChild(dock);
    }
    const count = dock.querySelector("[data-review-count]");
    const progress = dock.querySelector("[data-review-progress]");
    const steps = dock.querySelector("[data-review-steps]");
    const note = dock.querySelector("[data-review-note]");
    if (count) count.textContent = `${done}/${state.checks.length} 已完成`;
    if (progress) progress.style.width = `${(done / state.checks.length) * 100}%`;
    if (steps) steps.innerHTML = state.checks.map((check) => `<li class="calumai-review-step" data-state="${check.done ? "done" : "todo"}">${check.done ? "已完成" : "待補"}｜${check.label}</li>`).join("");
    const preview = dock.querySelector('[data-review-action="preview"]');
    if (preview) {
      preview.hidden = !state.preview;
      if (state.preview) preview.href = state.preview.href;
    }
    if (note) note.textContent = state.missing ? `下一步：${state.missing.label}` : "基本檢查已完成，請再人工看一次正式預覽。";
  }

  function schedule() {
    window.clearTimeout(refreshTimer);
    refreshTimer = window.setTimeout(render, 120);
  }

  window.addEventListener("hashchange", schedule);
  window.addEventListener("load", schedule);
  new MutationObserver((mutations) => {
    const onlyDockChanges = mutations.length > 0 && mutations.every((mutation) => {
      const target = mutation.target;
      return target === document.getElementById(DOCK_ID) || target.closest?.(`#${DOCK_ID}`);
    });
    if (!onlyDockChanges) schedule();
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["value", "checked", "aria-label"] });
  schedule();
})();
