(() => {
  "use strict";

  const NAV_ID = "calumai-site-content-nav";
  const BANNER_ID = "calumai-site-content-banner";
  const SECTION_LABELS = [
    { label: "全站設定", icon: "⚙" },
    { label: "首頁", icon: "⌂" },
    { label: "遊戲頁", icon: "▣" },
    { label: "小工具頁", icon: "▤" },
  ];

  function isSiteContent() {
    if (/collections\/site_content/i.test(window.location.hash)) return true;
    const root = document.querySelector(".content-editor");
    return Boolean(root && /網站基本內容/.test(root.innerText || ""));
  }

  function editorRoot() {
    return document.querySelector(".content-editor");
  }

  function firstEditorHeading(label) {
    const root = editorRoot();
    if (!root) return null;
    return Array.from(root.querySelectorAll("h4")).find((heading) => (
      (heading.innerText || "").trim() === label
    )) || null;
  }

  function scrollToSection(label) {
    const heading = firstEditorHeading(label);
    if (!heading) return;
    heading.classList.add("calumai-site-section-focus");
    heading.scrollIntoView({ behavior: "smooth", block: "start" });
    heading.focus?.({ preventScroll: true });
  }

  function toggleSveltiaPreview() {
    const root = editorRoot();
    if (!root) return;
    const previewButton = Array.from(root.querySelectorAll("button")).find((button) => (
      /Show Preview|Hide Preview/.test((button.innerText || "").trim())
    ));
    previewButton?.click();
  }

  function renderNav() {
    const shouldShow = isSiteContent();
    let nav = document.getElementById(NAV_ID);
    if (!shouldShow) {
      if (nav) nav.hidden = true;
      document.body.classList.remove("calumai-site-content");
      return;
    }
    document.body.classList.add("calumai-site-content");
    if (!editorRoot()) return;
    if (!nav) {
      nav = document.createElement("aside");
      nav.id = NAV_ID;
      nav.className = "calumai-site-content-nav";
      nav.setAttribute("aria-label", "網站內容快速導覽");
      nav.innerHTML = `
        <h2 class="calumai-site-content-nav-title">網站內容</h2>
        <p class="calumai-site-content-nav-note">選一區直接編輯，儲存後再看預覽。</p>
        <div class="calumai-site-content-nav-actions">
          <button type="button" data-site-action="preview">▣ 開啟／關閉預覽</button>
        </div>
        <div class="calumai-site-content-nav-divider" aria-hidden="true"></div>
        <div class="calumai-site-content-nav-sections"></div>
      `;
      nav.querySelector("[data-site-action=preview]").addEventListener("click", toggleSveltiaPreview);
      document.body.append(nav);
    }
    nav.hidden = false;
    const sections = nav.querySelector(".calumai-site-content-nav-sections");
    if (sections && !sections.children.length) {
      for (const section of SECTION_LABELS) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.siteSection = section.label;
        button.textContent = `${section.icon} ${section.label}`;
        button.addEventListener("click", () => scrollToSection(section.label));
        sections.append(button);
      }
    }
    addBanner();
  }

  function addBanner() {
    const root = editorRoot();
    if (!root || root.querySelector(`#${BANNER_ID}`)) return;
    const body = root.querySelector(".body");
    if (!body) return;
    const banner = document.createElement("div");
    banner.id = BANNER_ID;
    banner.className = "calumai-site-content-banner";
    banner.innerHTML = `
      <div><strong>網站基本內容</strong><span>首頁、遊戲頁與小工具的文字和連結集中管理。</span></div>
      <span aria-hidden="true">草稿先儲存，再預覽</span>
    `;
    body.prepend(banner);
  }

  let scheduled = 0;
  function scheduleRender() {
    if (scheduled) return;
    scheduled = window.setTimeout(() => {
      scheduled = 0;
      renderNav();
    }, 120);
  }

  const observer = new MutationObserver(scheduleRender);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  window.addEventListener("hashchange", scheduleRender);
  window.addEventListener("load", scheduleRender);
  scheduleRender();
})();
