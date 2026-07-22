(() => {
  "use strict";

  const PANEL_ID = "calumai-admin-friendly-guide";
  const TOGGLE_ID = "calumai-admin-friendly-toggle";
  const STORAGE_KEY = "calumai-admin-guide-collapsed";

  const style = document.createElement("style");
  style.textContent = `
    #${PANEL_ID} {
      position: fixed;
      left: 18px;
      bottom: 18px;
      z-index: 99998;
      width: min(360px, calc(100vw - 36px));
      border: 1px solid rgba(36, 86, 66, 0.2);
      border-radius: 18px;
      background: #fffaf0;
      color: #18231f;
      box-shadow: 0 18px 46px rgba(31, 41, 36, 0.18);
      font: 600 14px/1.55 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      overflow: hidden;
    }
    #${PANEL_ID}[data-collapsed="true"] .calumai-admin-guide-body { display: none; }
    #${TOGGLE_ID} {
      width: 100%;
      border: 0;
      background: #245642;
      color: #fffaf0;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 14px;
      font: 900 14px/1.25 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      text-align: left;
    }
    #${TOGGLE_ID} span:last-child {
      font-size: 12px;
      opacity: 0.82;
      white-space: nowrap;
    }
    #${PANEL_ID} .calumai-admin-guide-body {
      padding: 14px 16px 15px;
    }
    #${PANEL_ID} h2 {
      margin: 0 0 8px;
      color: #245642;
      font-size: 17px;
      line-height: 1.35;
    }
    #${PANEL_ID} p {
      margin: 0 0 10px;
      color: #52615a;
      font-weight: 650;
    }
    #${PANEL_ID} ol {
      margin: 0;
      padding-left: 20px;
    }
    #${PANEL_ID} li {
      margin: 7px 0;
    }
    #${PANEL_ID} strong {
      color: #bf4f35;
    }
    @media (max-width: 720px) {
      #${PANEL_ID} {
        left: 10px;
        right: 10px;
        bottom: 10px;
        width: auto;
      }
    }
  `;
  document.head.appendChild(style);

  const guides = {
    ai100: {
      title: "AI-100 內容怎麼發？",
      intro: "影片和圖文講義都在這裡。不要急著 published，先看正式預覽。",
      steps: [
        "內容編號：影片用 EP001；圖文講義／延伸教學用 SP001。",
        "內容類型選對：有 YouTube 選影片課程；只有 Markdown 選圖文講義。",
        "圖文講義可以上傳 .md，確認它有帶入「講義內文」。",
        "先儲存，等自動發布跑完，再按「打開 AI-100 預覽」。",
        "預覽沒問題後，再勾確認欄位並把狀態改成 published。"
      ]
    },
    blog: {
      title: "部落格文章怎麼發？",
      intro: "部落格有正式發布前預覽。先檢查排版，再公開。",
      steps: [
        "資料夾編號用 YYYYMMDD-英文短名，例如 20260722-my-post。",
        "網址 slug 用小寫英文和連字號，例如 my-post。",
        "先用 draft 或 awaiting_human_review，不要一開始就 published。",
        "儲存後等自動發布跑完，再按「打開部落格預覽」。",
        "主圖與圖片來源都確認後，再把狀態改成 published。"
      ]
    },
    site: {
      title: "網站文字怎麼改？",
      intro: "這裡是首頁、遊戲頁、小工具頁的文字設定。改小地方就好。",
      steps: [
        "只改你看得懂的標題、說明、按鈕文字。",
        "網址欄位不要亂改，除非你確定連結要換。",
        "首頁想學清單可以改卡片文字與留言區文案。",
        "儲存後等自動發布跑完，再去前台按 Ctrl + F5 看結果。"
      ]
    },
    default: {
      title: "CalumAi 後台小抄",
      intro: "先選左側功能：AI-100、部落格、或網站文字。",
      steps: [
        "AI-100：放影片課程或圖文講義。",
        "部落格文章：寫製作心得，發布前可預覽。",
        "網站內容設定：改首頁和頁面文案。",
        "任何內容都先儲存、看預覽，確認後才 published。"
      ]
    }
  };

  function getContext() {
    const haystack = `${location.hash} ${document.body?.textContent || ""}`;
    if (/collections\/episodes|AI-100|內容編號|圖文講義/i.test(haystack)) return "ai100";
    if (/collections\/posts|部落格文章|資料夾編號|folder_id/i.test(haystack)) return "blog";
    if (/site_content|網站內容設定|首頁想學清單|網站文字/i.test(haystack)) return "site";
    return "default";
  }

  function renderGuide() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const guide = guides[getContext()] || guides.default;
    panel.querySelector("h2").textContent = guide.title;
    panel.querySelector("p").textContent = guide.intro;
    panel.querySelector("ol").innerHTML = guide.steps.map((step) => `<li>${step}</li>`).join("");
  }

  const panel = document.createElement("aside");
  panel.id = PANEL_ID;
  panel.setAttribute("aria-label", "CalumAi 後台小抄");
  panel.dataset.collapsed = localStorage.getItem(STORAGE_KEY) === "true" ? "true" : "false";
  panel.innerHTML = `
    <button id="${TOGGLE_ID}" type="button">
      <span>後台小抄</span>
      <span data-guide-state>${panel.dataset.collapsed === "true" ? "打開" : "收起"}</span>
    </button>
    <div class="calumai-admin-guide-body">
      <h2></h2>
      <p></p>
      <ol></ol>
    </div>
  `;

  panel.querySelector("button").addEventListener("click", () => {
    const collapsed = panel.dataset.collapsed !== "true";
    panel.dataset.collapsed = String(collapsed);
    panel.querySelector("[data-guide-state]").textContent = collapsed ? "打開" : "收起";
    localStorage.setItem(STORAGE_KEY, String(collapsed));
  });

  window.addEventListener("load", () => {
    document.body.appendChild(panel);
    renderGuide();
  });
  window.addEventListener("hashchange", renderGuide);
  setInterval(renderGuide, 1800);
})();
