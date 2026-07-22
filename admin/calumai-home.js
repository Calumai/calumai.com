(() => {
  "use strict";

  const OVERLAY_ID = "calumai-friendly-home";
  const style = document.createElement("style");
  style.textContent = `
    :root { --calumai-green: #195746; --calumai-ink: #17231f; --calumai-muted: #63716c; --calumai-paper: #f5f7f6; --calumai-line: #dce5e0; --calumai-orange: #c86242; }
    #${OVERLAY_ID} { position: fixed; inset: 0; z-index: 99990; overflow: auto; background: var(--calumai-paper); color: var(--calumai-ink); font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", sans-serif; }
    #${OVERLAY_ID}[hidden] { display: none; }
    #${OVERLAY_ID} * { box-sizing: border-box; }
    .calumai-home-shell { width: min(1080px, calc(100% - 40px)); margin: 0 auto; padding: 28px 0 54px; }
    .calumai-home-top { display: flex; align-items: center; justify-content: space-between; gap: 20px; padding-bottom: 30px; }
    .calumai-home-brand { display: flex; align-items: center; gap: 12px; color: var(--calumai-green); font-weight: 850; letter-spacing: .04em; }
    .calumai-home-brand img { width: 42px; height: 42px; border-radius: 14px; object-fit: cover; background: #fff; border: 1px solid var(--calumai-line); }
    .calumai-home-save { display: flex; align-items: center; gap: 8px; color: var(--calumai-muted); font-size: 13px; }
    .calumai-home-save::before { content: ""; width: 8px; height: 8px; border-radius: 50%; background: #44a57c; box-shadow: 0 0 0 4px rgba(68,165,124,.12); }
    .calumai-home-hero { max-width: 700px; padding: 20px 0 34px; }
    .calumai-home-kicker { margin: 0 0 12px; color: var(--calumai-orange); font-size: 13px; font-weight: 850; letter-spacing: .14em; text-transform: uppercase; }
    .calumai-home-hero h1 { margin: 0; font-size: clamp(34px, 6vw, 64px); line-height: 1.02; letter-spacing: -.055em; }
    .calumai-home-hero p { margin: 18px 0 0; max-width: 580px; color: var(--calumai-muted); font-size: 18px; line-height: 1.7; }
    .calumai-home-steps { display: flex; flex-wrap: wrap; gap: 10px 24px; margin: 0 0 28px; padding: 14px 0 18px; border-top: 1px solid var(--calumai-line); border-bottom: 1px solid var(--calumai-line); color: var(--calumai-muted); font-size: 13px; }
    .calumai-home-step { display: inline-flex; align-items: center; gap: 8px; }
    .calumai-home-step b { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 50%; background: #e5eee9; color: var(--calumai-green); font-size: 12px; }
    .calumai-home-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .calumai-home-card { display: flex; min-height: 154px; flex-direction: column; justify-content: space-between; padding: 22px; border: 1px solid var(--calumai-line); border-radius: 20px; background: rgba(255,255,255,.78); color: inherit; text-align: left; cursor: pointer; box-shadow: 0 10px 30px rgba(23,35,31,.04); transition: transform .16s ease, border-color .16s ease, box-shadow .16s ease; }
    .calumai-home-card:hover { transform: translateY(-2px); border-color: #9fc2b3; box-shadow: 0 16px 34px rgba(23,35,31,.09); }
    .calumai-home-card:active { transform: scale(.985); }
    .calumai-home-card:focus-visible, .calumai-home-secondary:focus-visible { outline: 3px solid rgba(200,98,66,.45); outline-offset: 3px; }
    .calumai-home-card .icon { display: grid; place-items: center; width: 40px; height: 40px; margin-bottom: 22px; border-radius: 13px; background: #e6f0eb; color: var(--calumai-green); font-size: 20px; font-weight: 850; }
    .calumai-home-card h2 { margin: 0; font-size: 21px; letter-spacing: -.025em; }
    .calumai-home-card p { margin: 7px 0 0; color: var(--calumai-muted); font-size: 14px; line-height: 1.55; }
    .calumai-home-card .arrow { align-self: flex-end; color: var(--calumai-green); font-size: 18px; }
    .calumai-home-bottom { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 24px; }
    .calumai-home-secondary { border: 1px solid var(--calumai-line); border-radius: 999px; padding: 12px 16px; background: #fff; color: var(--calumai-green); cursor: pointer; font: inherit; font-weight: 750; }
    .calumai-home-note { margin: 0; color: var(--calumai-muted); font-size: 13px; }
    @media (max-width: 680px) { .calumai-home-shell { width: min(100% - 28px, 560px); padding-top: 18px; } .calumai-home-top { align-items: flex-start; flex-direction: column; gap: 12px; } .calumai-home-hero h1 { font-size: 42px; } .calumai-home-actions { grid-template-columns: 1fr; } .calumai-home-card { min-height: 130px; } }
    @media (prefers-reduced-motion: reduce) { #${OVERLAY_ID} * { transition: none !important; } }
  `;
  document.head.appendChild(style);

  const overlay = document.createElement("main");
  overlay.id = OVERLAY_ID;
  overlay.setAttribute("aria-label", "CalumAi 後台工作選擇");
  overlay.innerHTML = `
    <div class="calumai-home-shell">
      <header class="calumai-home-top">
        <div class="calumai-home-brand"><img src="/assets/calumai-logo-mark.png" alt=""><span>CALUMAI 後台</span></div>
        <div class="calumai-home-save">登入後會自動存到 GitHub</div>
      </header>
      <section class="calumai-home-hero">
        <p class="calumai-home-kicker">今天要做什麼？</p>
        <h1>選一件事，<br>我們一步一步完成。</h1>
        <p>不用先理解資料夾、slug 或 YAML。先選你要做的工作，其他設定會在需要時出現。</p>
      </section>
      <nav class="calumai-home-steps" aria-label="工作流程">
        <span class="calumai-home-step"><b>1</b>選工作</span><span class="calumai-home-step"><b>2</b>編輯內容</span><span class="calumai-home-step"><b>3</b>看預覽</span><span class="calumai-home-step"><b>4</b>確認發布</span>
      </nav>
      <section class="calumai-home-actions" aria-label="工作選擇">
        <button class="calumai-home-card" data-action="posts" type="button"><span class="icon">Aa</span><span><h2>寫一篇部落格</h2><p>標題、內文、圖片，完成後先看預覽。</p></span><span class="arrow" aria-hidden="true">→</span></button>
        <button class="calumai-home-card" data-action="episodes" type="button"><span class="icon">▶</span><span><h2>新增 AI-100 課程</h2><p>影片課程或圖文講義，選對類型就好。</p></span><span class="arrow" aria-hidden="true">→</span></button>
        <button class="calumai-home-card" data-action="inbox" type="button"><span class="icon">↓</span><span><h2>帶入 GitHub 收件匣</h2><p>文章、圖片、來源檔案一起帶進後台。</p></span><span class="arrow" aria-hidden="true">→</span></button>
        <button class="calumai-home-card" data-action="site" type="button"><span class="icon">⌂</span><span><h2>修改首頁與遊戲頁</h2><p>只改看得到的文字和按鈕，不碰程式。</p></span><span class="arrow" aria-hidden="true">→</span></button>
      </section>
      <div class="calumai-home-bottom"><button class="calumai-home-secondary" data-action="editor" type="button">開啟完整編輯器</button><p class="calumai-home-note">圖片會放在每篇文章自己的 assets 資料夾。</p></div>
    </div>
  `;

  function hide() { overlay.hidden = true; }
  function go(action) {
    if (action === "editor") { hide(); return; }
    if (action === "posts") { hide(); location.hash = "#/collections/posts"; return; }
    if (action === "episodes") { hide(); location.hash = "#/collections/episodes"; return; }
    if (action === "site") { hide(); location.hash = "#/collections/site_content"; return; }
    if (action === "inbox") {
      hide();
      const started = Date.now();
      const timer = setInterval(() => {
        const button = document.getElementById("calumai-github-inbox-button");
        if (button) { clearInterval(timer); button.click(); }
        else if (Date.now() - started > 5000) { clearInterval(timer); window.alert("請先完成 GitHub 登入，再按一次「帶入 GitHub 收件匣」。"); }
      }, 250);
    }
  }
  overlay.addEventListener("click", (event) => {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action) go(action);
  });

  window.addEventListener("DOMContentLoaded", () => {
    document.body.appendChild(overlay);
    if (location.hash) hide();
  });
  window.addEventListener("hashchange", () => { if (location.hash) hide(); });
})();
