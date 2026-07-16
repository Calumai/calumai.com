const ideas = [
  ["教材", "族語詞卡工具", "輸入或匯入族語、中文、例句與主題分類，產生適合 A4 列印的詞卡。"],
  ["教材", "例句練習產生器", "使用老師提供的詞彙與可信語料，整理成題目、提示、答案與適用程度。"],
  ["教材", "族語發音練習頁", "每張卡放入族語、中文、音檔播放、跟讀提醒與學生自評。"],
  ["遊戲", "族語配對遊戲", "配對族語詞與中文意思，完成後顯示分數、時間與需要再練習的內容。"],
  ["遊戲", "翻牌記憶遊戲", "翻開卡片配對族語與中文，記錄完成時間與錯誤次數。"],
  ["遊戲", "聽力選擇題", "播放老師提供的族語音檔，學生選擇答案並立即得到回饋。"],
  ["管理", "老師課程管理", "整理老師、語別、日期、堂數、助教與備註，並輸出課務報表。"],
  ["報表", "族語家教截圖報表", "每位老師一張卡片，每個日期保留代表截圖，並列印鐘點費表。"],
  ["報表", "鐘點費明細表", "建立可編輯、可核對、可列印的老師鐘點費明細。"],
  ["測試", "族語遊戲測試清單", "檢查手機操作、按鈕辨識、答題回饋、重新開始與文字尺寸。"],
  ["安全", "課務資料修改確認", "刪除、送出或覆蓋資料前，先清楚顯示即將修改的內容。"]
];

const ideaUrlKey = "indigenousToolIdeaUrls";
const feedbackSheetUrl = "https://docs.google.com/spreadsheets/d/1dECVvGtsBp9obg8Ll8b_SrhZnwe7Gqadeoqj3X7pkZc/gviz/tq?tqx=out:json&gid=944769991";

const cards = document.querySelector("#cards");
const empty = document.querySelector("#empty");
const search = document.querySelector("#search");
const tabs = [...document.querySelectorAll(".tab")];
const ideaUrls = readObject(ideaUrlKey);
let active = "all";
let feedbackLoadTimer;

function readObject(key) {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  }[char]));
}

function renderIdeas() {
  const query = search.value.trim().toLowerCase();
  const filtered = ideas.filter(([category, title, description]) => {
    const inCategory = active === "all" || category === active;
    const haystack = `${category} ${title} ${description}`.toLowerCase();
    return inCategory && (!query || haystack.includes(query));
  });

  cards.innerHTML = filtered.map(([category, title, description]) => {
    const savedUrl = ideaUrls[title] || "";
    return `
      <article class="idea-card">
        <span class="status">${escapeHtml(category)}</span>
        <h3>${escapeHtml(title)}</h3>
        <p>${escapeHtml(description)}</p>
        <input class="search" type="url" value="${escapeHtml(savedUrl)}" placeholder="完成後貼上網址 https://..." data-idea-title="${escapeHtml(title)}" aria-label="${escapeHtml(title)}完成網址">
        ${savedUrl
          ? `<a class="pill" href="${escapeHtml(savedUrl)}" target="_blank" rel="noopener">開啟成果</a>`
          : `<span class="status next">尚未完成</span>`}
      </article>`;
  }).join("");

  cards.querySelectorAll("[data-idea-title]").forEach(input => {
    input.addEventListener("change", () => saveIdeaUrl(input.dataset.ideaTitle, input.value.trim()));
  });

  empty.style.display = filtered.length ? "none" : "block";
}

function saveIdeaUrl(title, url) {
  if (url) {
    ideaUrls[title] = url;
  } else {
    delete ideaUrls[title];
  }
  localStorage.setItem(ideaUrlKey, JSON.stringify(ideaUrls));
  renderIdeas();
}

window.renderPublicFeedback = response => {
  window.clearTimeout(feedbackLoadTimer);
  const rows = response?.table?.rows || [];
  const items = rows.map(row => {
    const cells = row.c || [];
    return {
      createdAt: cells[0]?.f || cells[0]?.v || "",
      rating: Number(cells[1]?.v || 0),
      message: String(cells[2]?.v || "").trim()
    };
  }).filter(item => item.rating && item.message);

  const list = document.querySelector("#feedbackList");
  const emptyNote = document.querySelector("#feedbackEmpty");
  const count = document.querySelector("#feedbackCount");
  const average = document.querySelector("#feedbackAverage");
  const total = items.reduce((sum, item) => sum + item.rating, 0);

  count.textContent = items.length;
  average.textContent = items.length ? (total / items.length).toFixed(1) : "-";
  emptyNote.style.display = items.length ? "none" : "block";
  emptyNote.textContent = "尚無公開留言。";
  list.innerHTML = items.reverse().slice(0, 12).map(item => `
    <article class="feedback-item">
      <span class="status">${"★".repeat(item.rating)}${"☆".repeat(5 - item.rating)}</span>
      <p>${escapeHtml(item.message)}</p>
      <span class="hint">${escapeHtml(item.createdAt || "匿名訪客")}</span>
    </article>
  `).join("");
};

function loadPublicFeedback() {
  const emptyNote = document.querySelector("#feedbackEmpty");
  window.clearTimeout(feedbackLoadTimer);
  emptyNote.style.display = "block";
  emptyNote.textContent = "正在讀取公開留言...";

  document.querySelector("#feedbackSheetScript")?.remove();
  window.google = window.google || {};
  window.google.visualization = window.google.visualization || {};
  window.google.visualization.Query = window.google.visualization.Query || {};
  window.google.visualization.Query.setResponse = response => window.renderPublicFeedback(response);

  const script = document.createElement("script");
  script.id = "feedbackSheetScript";
  script.src = `${feedbackSheetUrl}&cache=${Date.now()}`;
  script.onerror = () => {
    window.clearTimeout(feedbackLoadTimer);
    emptyNote.textContent = "目前讀不到公開留言，請稍後再試。";
  };
  document.body.appendChild(script);

  feedbackLoadTimer = window.setTimeout(() => {
    if (emptyNote.textContent === "正在讀取公開留言...") {
      emptyNote.textContent = "公開留言暫時沒有回應，稍後按重新整理再試。";
    }
  }, 7000);
}

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    active = tab.dataset.filter;
    tabs.forEach(item => item.setAttribute("aria-pressed", String(item === tab)));
    renderIdeas();
  });
});

search.addEventListener("input", renderIdeas);
document.querySelector("#refreshFeedback").addEventListener("click", loadPublicFeedback);

renderIdeas();
loadPublicFeedback();
