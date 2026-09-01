(function () {
  "use strict";

  document.documentElement.classList.add("js");

  const STORAGE_KEY = "calumai-ntnu-vibe-course-v1";
  const THEME_KEY = "calumai-ntnu-vibe-theme";

  const units = {
    1: {
      title: "誰負責什麼？",
      description: "把工作分給老師或 AI，建立正確的人機分工。"
    },
    2: {
      title: "四問藍圖產生器",
      description: "回答使用者、成果、操作與資料，產生第一版需求摘要。"
    },
    3: {
      title: "MVP 版本排序",
      description: "把功能排成能測試、能回頭的小版本。"
    },
    4: {
      title: "族語聽力流程拼圖",
      description: "排出主流程與答錯分支，讓 AI 少猜。"
    },
    5: {
      title: "網站透視鏡",
      description: "看懂 HTML、CSS 與 JavaScript 各自在做什麼。"
    },
    6: {
      title: "安全修改與上線演練",
      description: "練習可回復的修改循環，避免作品越修越亂。"
    }
  };

  const slideTitles = [
    "Vibe Coding 入門",
    "Vibe Coding 就是先用人話告訴 AI 我想做什麼",
    "以前先學很多技術，現在可以先做出教材第一版",
    "不是完全不用懂程式，而是先做、再慢慢理解",
    "Vibe Coding 在 2025 年流行，老師的角色更像導演",
    "它突然熱門，因為四個條件同時改變",
    "工具不用一次全學，依需求分成三個階段",
    "族語教材最適合從可立即操作的小活動開始",
    "Vibe Coding 也能先解決老師自己的備課問題",
    "最大價值是更快把教材想法變成可測試版本",
    "風險比優點更需要先知道",
    "不用先變成工程師，才有資格開始做數位教材",
    "先想清楚，再叫 AI 動手",
    "AI 是施工團隊，需求不清楚，漂亮網站也可能不好用",
    "AI 是施工團隊，需求不清楚，漂亮網站也可能不好用",
    "一般人可以先從小工具、網站與學習活動開始",
    "族語教材可以從單一互動，逐步組成完整任務",
    "開始前先回答內容、功能、資料、使用者",
    "把學習流程畫出來，AI 才知道每一步要發生什麼",
    "不要一次蓋整棟大樓，用版本一步一步增加功能",
    "先求能用，再求漂亮，修改時說清楚哪些能動",
    "網站壞掉時，用預期、實際、重現、限制四段回報",
    "懂一點網站地圖，就能判斷問題大概在哪一區",
    "需要儲存與讀取資料時，會遇到前端、後端與資料庫",
    "從一頁教材走到 Web App，分五級逐步增加難度",
    "先畫流程，再叫 AI 動手",
    "規劃讓 AI 少猜，也讓老師提早發現未決定的地方",
    "開始前回答四個問題，需求就會從模糊變得可執行",
    "先記中文意思，再看英文名稱",
    "使用者流程，就是學生從開始到完成怎麼操作",
    "流程圖把操作、選擇與下一步畫出來",
    "幾乎所有互動教材，都能先畫成可檢查路徑",
    "畫面草圖先決定東西放哪裡，不需要先漂亮",
    "流程圖、畫面草圖與資料流各自解決一個問題",
    "用有條理的提示詞限定功能、流程與邊界",
    "第一版的任務，是證明核心流程能跑",
    "最安全的流程，是每一階段只回答一個問題",
    "句子搬運遊戲先畫清楚，AI 才能做出正確互動",
    "看懂網頁，才知道怎麼指揮 AI",
    "十個網頁觀念，讓 Vibe Coding 變成可判斷的開發",
    "圖片破圖或連結失效，常常是路徑指錯地方",
    "新手先從靜態網頁開始，再進入動態網頁",
    "HTML 管內容、CSS 管外觀、JavaScript 管互動",
    "看懂常用標籤，就能指出 AI 應該修改的區塊",
    "內嵌適合原型，外部檔案適合長期維護",
    "同一套網頁要能適應桌機、平板與手機",
    "選對圖片格式，兼顧畫質、透明背景與載入速度",
    "用開發者工具看網頁真正呈現的狀態",
    "部署後取得穩定網址，學生才真的能使用",
    "會判斷結構、路徑、互動、錯誤與部署，才能掌握作品",
    "下載原始碼，才真正擁有作品",
    "看懂資料夾，避免圖片、音檔與程式失聯",
    "越方便的修改方式，不一定越適合長期保存",
    "先限制修改範圍，不要讓 AI 重寫整個網站",
    "問題分類正確，AI 才不會修改錯檔案",
    "修改前留退路，修改後做回歸測試",
    "完成下載、修改、測試、再上線的完整循環"
  ];

  const mvpItems = [
    { id: "question", label: "只出一題並顯示題目" },
    { id: "answer", label: "加入可選答案" },
    { id: "feedback", label: "加入答對與答錯回饋" },
    { id: "next", label: "加入下一題" },
    { id: "audio", label: "加入族語音檔" },
    { id: "mobile", label: "調整手機操作" },
    { id: "polish", label: "最後做視覺美化" }
  ];

  const flowItems = [
    { id: "start", label: "開始" },
    { id: "audio", label: "播放族語音檔" },
    { id: "answer", label: "學生選擇圖片" },
    { id: "judge", label: "判斷答案" },
    { id: "finish", label: "進入下一題或結果頁" }
  ];

  const shipItems = [
    { id: "download", label: "下載完整原始碼" },
    { id: "extract", label: "完整解壓縮，不在壓縮檔內編輯" },
    { id: "backup", label: "建立可正常使用的備份版本" },
    { id: "baseline", label: "先開啟 index.html 跑一次核心流程" },
    { id: "change", label: "一次只修改一件事" },
    { id: "regression", label: "重新測試所有核心流程" },
    { id: "version", label: "建立新的可回復版本" },
    { id: "deploy", label: "部署並記錄測試結果" }
  ];

  const lensContent = {
    html: {
      code: '<main>\n  <h1>qbsuran</h1>\n  <p>點選正確的中文意思</p>\n  <button>朋友</button>\n  <button>祖父母</button>\n</main>',
      note: "內容與結構：標題、文字、按鈕與答案。",
      className: "inspect-html"
    },
    css: {
      code: '.demo-card {\n  display: grid;\n  gap: 16px;\n  padding: 24px;\n}\n\nbutton {\n  min-height: 44px;\n  color: #102033;\n}',
      note: "外觀與排版：顏色、大小、留白與手機版。",
      className: "inspect-css"
    },
    js: {
      code: 'answerButtons.forEach((button) => {\n  button.addEventListener("click", () => {\n    checkAnswer(button.dataset.answer);\n  });\n});',
      note: "互動與狀態：接住點擊，判斷答案，再更新畫面。",
      className: "inspect-js"
    }
  };

  const defaultState = {
    activeUnit: 1,
    completed: [],
    blueprint: { audience: "", goal: "", actions: "", data: "" },
    mvpOrder: [],
    flowOrder: [],
    flowBranch: "",
    shipOrder: [],
    slide: 1
  };

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return saved ? { ...defaultState, ...saved, blueprint: { ...defaultState.blueprint, ...(saved.blueprint || {}) } } : { ...defaultState };
    } catch (error) {
      return { ...defaultState };
    }
  }

  let state = loadState();

  function saveState() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      showToast("目前無法保存進度，但本頁仍可繼續使用。");
    }
  }

  function refreshIcons() {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }
  }

  let toastTimer = null;

  function showToast(message) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.hidden = false;
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toast.hidden = true;
    }, 2600);
  }

  function setupTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY);
    if (savedTheme === "light" || savedTheme === "dark") {
      document.documentElement.dataset.theme = savedTheme;
    }

    const button = document.getElementById("theme-toggle");
    button.addEventListener("click", function () {
      const current = document.documentElement.dataset.theme;
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const next = current === "dark" || (!current && systemDark) ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      localStorage.setItem(THEME_KEY, next);
      showToast(next === "dark" ? "已切換為深色模式" : "已切換為淺色模式");
    });
  }

  function setupReveal() {
    const items = Array.from(document.querySelectorAll(".reveal"));
    if (!("IntersectionObserver" in window)) {
      items.forEach(function (item) { item.classList.add("is-visible"); });
      return;
    }

    const observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px" });

    items.forEach(function (item) { observer.observe(item); });
  }

  function activateUnit(unitNumber, shouldScroll) {
    const unit = Number(unitNumber);
    if (!units[unit]) return;
    state.activeUnit = unit;
    saveState();

    document.querySelectorAll(".module-row").forEach(function (row) {
      row.classList.toggle("is-active", Number(row.dataset.unit) === unit);
    });
    document.querySelectorAll("[data-lab]").forEach(function (button) {
      button.classList.toggle("is-active", Number(button.dataset.lab) === unit);
    });
    document.querySelectorAll("[data-panel]").forEach(function (panel) {
      const active = Number(panel.dataset.panel) === unit;
      panel.classList.toggle("is-active", active);
      panel.hidden = !active;
    });

    document.getElementById("lab-step").textContent = "模組 " + unit + " / 6";
    document.getElementById("lab-title").textContent = units[unit].title;
    document.getElementById("lab-description").textContent = units[unit].description;
    updateCompletionUI();

    if (shouldScroll) {
      document.getElementById("lab").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }
  }

  function setupModules() {
    document.querySelectorAll(".module-row").forEach(function (row) {
      row.addEventListener("click", function () { activateUnit(row.dataset.unit, true); });
    });
    document.querySelectorAll("[data-lab]").forEach(function (button) {
      button.addEventListener("click", function () { activateUnit(button.dataset.lab, false); });
    });
    document.getElementById("mark-complete").addEventListener("click", function () {
      const unit = state.activeUnit;
      const completed = new Set(state.completed);
      if (completed.has(unit)) {
        completed.delete(unit);
      } else {
        completed.add(unit);
      }
      state.completed = Array.from(completed).sort();
      saveState();
      updateCompletionUI();
    });
    activateUnit(state.activeUnit || 1, false);
  }

  function updateCompletionUI() {
    const completed = new Set(state.completed.map(Number));
    const count = completed.size;
    document.getElementById("completion-label").textContent = count + " / 6";
    document.getElementById("completion-bar").style.width = ((count / 6) * 100) + "%";
    const button = document.getElementById("mark-complete");
    const isComplete = completed.has(Number(state.activeUnit));
    button.classList.toggle("is-complete", isComplete);
    button.innerHTML = isComplete
      ? '<i data-lucide="check-circle" aria-hidden="true"></i>已完成，點擊取消'
      : '<i data-lucide="check" aria-hidden="true"></i>標記完成';
    refreshIcons();
  }

  function setupRoleLab() {
    const grid = document.getElementById("role-grid");
    grid.addEventListener("click", function (event) {
      const button = event.target.closest("button[data-role]");
      if (!button) return;
      const article = button.closest("article");
      article.dataset.choice = button.dataset.role;
      article.querySelectorAll("button").forEach(function (choice) {
        choice.classList.toggle("is-selected", choice === button);
      });
      evaluateRoles();
    });

    document.querySelector('[data-reset="roles"]').addEventListener("click", function () {
      grid.querySelectorAll("article").forEach(function (article) {
        delete article.dataset.choice;
        article.classList.remove("is-correct", "is-wrong");
        article.querySelectorAll("button").forEach(function (button) { button.classList.remove("is-selected"); });
      });
      const feedback = document.getElementById("role-feedback");
      feedback.className = "feedback";
      feedback.textContent = "完成六項分類後，這裡會顯示結果。";
    });
  }

  function evaluateRoles() {
    const articles = Array.from(document.querySelectorAll("#role-grid article"));
    const answered = articles.filter(function (article) { return article.dataset.choice; });
    const feedback = document.getElementById("role-feedback");
    if (answered.length < articles.length) {
      feedback.className = "feedback";
      feedback.textContent = "已完成 " + answered.length + " / " + articles.length + " 項。";
      return;
    }

    let score = 0;
    articles.forEach(function (article) {
      const correct = article.dataset.choice === article.dataset.answer;
      article.classList.toggle("is-correct", correct);
      article.classList.toggle("is-wrong", !correct);
      if (correct) score += 1;
    });
    feedback.className = "feedback " + (score === articles.length ? "is-success" : "is-error");
    feedback.textContent = score === articles.length
      ? "全對。語言、文化、教學判斷與公開邊界都由老師負責。"
      : "答對 " + score + " / " + articles.length + "。AI 可以協作，但教學與公開決策不能外包。";
  }

  function setupBlueprint() {
    const form = document.getElementById("blueprint-form");
    Object.keys(state.blueprint).forEach(function (key) {
      if (form.elements[key]) form.elements[key].value = state.blueprint[key];
    });
    updateBlueprint();

    form.addEventListener("input", function () {
      state.blueprint = Object.fromEntries(new FormData(form).entries());
      saveState();
      updateBlueprint();
    });

    document.querySelector('[data-reset="blueprint"]').addEventListener("click", function () {
      form.reset();
      state.blueprint = { audience: "", goal: "", actions: "", data: "" };
      saveState();
      updateBlueprint();
    });

    document.getElementById("copy-blueprint").addEventListener("click", async function () {
      const result = document.getElementById("blueprint-result");
      if (result.hidden || !result.textContent.trim()) {
        showToast("先填寫至少一項需求，再複製摘要。");
        return;
      }
      try {
        await navigator.clipboard.writeText(result.textContent);
        showToast("需求摘要已複製");
      } catch (error) {
        const textarea = document.createElement("textarea");
        textarea.value = result.textContent;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        const copied = document.execCommand("copy");
        textarea.remove();
        showToast(copied ? "需求摘要已複製" : "無法自動複製，請手動選取文字。");
      }
    });
  }

  function updateBlueprint() {
    const values = state.blueprint;
    const hasContent = Object.values(values).some(function (value) { return String(value).trim(); });
    const empty = document.getElementById("blueprint-empty");
    const result = document.getElementById("blueprint-result");
    empty.hidden = hasContent;
    result.hidden = !hasContent;
    if (!hasContent) {
      result.textContent = "";
      return;
    }

    const audience = values.audience.trim() || "請填寫使用者";
    const goal = values.goal.trim() || "請填寫學習成果";
    const actions = values.actions.trim() || "請填寫學生操作";
    const data = values.data.trim() || "請填寫教材資料";
    result.textContent = [
      "請幫我製作一個族語數位教材網頁。",
      "",
      "使用者：" + audience,
      "完成成果：" + goal,
      "操作流程：" + actions,
      "需要資料：" + data,
      "",
      "請先完成最小可用版本，只做核心流程。",
      "每次答題都要有清楚回饋，手機上也要容易操作。",
      "族語內容不要自行補寫，資料不足時請保留欄位並提醒我確認。"
    ].join("\n");
  }

  function shuffled(items) {
    const copy = items.map(function (item) { return { ...item }; });
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = copy[i];
      copy[i] = copy[j];
      copy[j] = temp;
    }
    return copy;
  }

  function restoreOrder(items, savedOrder) {
    if (!Array.isArray(savedOrder) || savedOrder.length !== items.length) return shuffled(items);
    const map = new Map(items.map(function (item) { return [item.id, item]; }));
    const restored = savedOrder.map(function (id) { return map.get(id); }).filter(Boolean);
    return restored.length === items.length ? restored : shuffled(items);
  }

  function renderSortable(listElement, items, stateKey) {
    listElement.innerHTML = "";
    items.forEach(function (item, index) {
      const li = document.createElement("li");
      li.dataset.id = item.id;
      const label = document.createElement("span");
      label.textContent = item.label;
      const controls = document.createElement("div");
      controls.className = "sort-controls";
      const up = document.createElement("button");
      up.type = "button";
      up.disabled = index === 0;
      up.setAttribute("aria-label", "上移 " + item.label);
      up.innerHTML = '<i data-lucide="chevron-up" aria-hidden="true"></i>';
      const down = document.createElement("button");
      down.type = "button";
      down.disabled = index === items.length - 1;
      down.setAttribute("aria-label", "下移 " + item.label);
      down.innerHTML = '<i data-lucide="chevron-down" aria-hidden="true"></i>';
      up.addEventListener("click", function () { moveItem(items, index, -1, listElement, stateKey); });
      down.addEventListener("click", function () { moveItem(items, index, 1, listElement, stateKey); });
      controls.append(up, down);
      li.append(label, controls);
      listElement.appendChild(li);
    });
    state[stateKey] = items.map(function (item) { return item.id; });
    saveState();
    refreshIcons();
  }

  function moveItem(items, index, direction, listElement, stateKey) {
    const next = index + direction;
    if (next < 0 || next >= items.length) return;
    const temp = items[index];
    items[index] = items[next];
    items[next] = temp;
    renderSortable(listElement, items, stateKey);
  }

  function orderMatches(items, correctItems) {
    return items.every(function (item, index) { return item.id === correctItems[index].id; });
  }

  function setupMvp() {
    const list = document.getElementById("mvp-list");
    let items = restoreOrder(mvpItems, state.mvpOrder);
    renderSortable(list, items, "mvpOrder");
    document.querySelector('[data-reset="mvp"]').addEventListener("click", function () {
      items = shuffled(mvpItems);
      renderSortable(list, items, "mvpOrder");
      setFeedback("mvp-feedback", "已重新打亂，請從核心流程開始。", "");
    });
    document.getElementById("check-mvp").addEventListener("click", function () {
      const correct = orderMatches(items, mvpItems);
      setFeedback("mvp-feedback", correct ? "順序正確。先能用，再加內容與精修。" : "還可以更安全。把出題、回答、回饋與下一題放在最前面。", correct ? "success" : "error");
    });
  }

  function setupFlow() {
    const list = document.getElementById("flow-list");
    let items = restoreOrder(flowItems, state.flowOrder);
    renderSortable(list, items, "flowOrder");
    document.querySelectorAll("[data-branch]").forEach(function (button) {
      button.classList.toggle("is-selected", button.dataset.branch === state.flowBranch);
      button.addEventListener("click", function () {
        state.flowBranch = button.dataset.branch;
        document.querySelectorAll("[data-branch]").forEach(function (choice) {
          choice.classList.toggle("is-selected", choice === button);
        });
        saveState();
      });
    });
    document.querySelector('[data-reset="flow"]').addEventListener("click", function () {
      items = shuffled(flowItems);
      state.flowBranch = "";
      renderSortable(list, items, "flowOrder");
      document.querySelectorAll("[data-branch]").forEach(function (button) { button.classList.remove("is-selected"); });
      setFeedback("flow-feedback", "先排列主流程，再選擇答錯分支。", "");
    });
    document.getElementById("check-flow").addEventListener("click", function () {
      const orderCorrect = orderMatches(items, flowItems);
      const branchCorrect = state.flowBranch === "retry";
      const correct = orderCorrect && branchCorrect;
      setFeedback("flow-feedback", correct ? "流程完成。答錯先給提示再試一次，保留學習機會。" : "再看一次主流程與答錯分支。先播放、作答、判斷，再決定下一步。", correct ? "success" : "error");
    });
  }

  function setFeedback(id, message, status) {
    const element = document.getElementById(id);
    element.textContent = message;
    element.className = "feedback" + (status ? " is-" + status : "");
  }

  function setupLens() {
    const site = document.getElementById("demo-site");
    const code = document.getElementById("lens-code");
    const note = document.getElementById("lens-note");

    function activateLayer(layer) {
      const content = lensContent[layer];
      document.querySelectorAll("[data-layer]").forEach(function (button) {
        button.setAttribute("aria-selected", String(button.dataset.layer === layer));
      });
      site.classList.remove("inspect-html", "inspect-css", "inspect-js");
      site.classList.add(content.className);
      code.textContent = content.code;
      note.textContent = content.note;
    }

    document.querySelectorAll("[data-layer]").forEach(function (button) {
      button.addEventListener("click", function () { activateLayer(button.dataset.layer); });
    });

    document.querySelectorAll("[data-demo-answer]").forEach(function (button) {
      button.addEventListener("click", function () {
        const correct = button.dataset.demoAnswer === "right";
        const feedback = document.getElementById("demo-feedback");
        feedback.textContent = correct ? "答對了。qbsuran 是祖父母。" : "再試一次。可以加入圖片或音檔提示。";
        feedback.style.color = correct ? "var(--accent-strong)" : "var(--danger)";
      });
    });

    document.querySelector('[data-reset="lens"]').addEventListener("click", function () {
      document.getElementById("demo-feedback").textContent = "等待作答";
      document.getElementById("demo-feedback").style.color = "";
      activateLayer("html");
    });

    activateLayer("html");
  }

  function setupShip() {
    const list = document.getElementById("ship-list");
    let items = restoreOrder(shipItems, state.shipOrder);
    renderSortable(list, items, "shipOrder");
    document.querySelector('[data-reset="ship"]').addEventListener("click", function () {
      items = shuffled(shipItems);
      renderSortable(list, items, "shipOrder");
      setFeedback("ship-feedback", "已重新打亂，先替自己留一條回復路線。", "");
    });
    document.getElementById("check-ship").addEventListener("click", function () {
      const correct = orderMatches(items, shipItems);
      setFeedback("ship-feedback", correct ? "流程正確。現在每一次修改都能測試、追蹤與回復。" : "順序還有風險。下載後先解壓、備份並確認基準版本，再開始修改。", correct ? "success" : "error");
    });
  }

  function setupSlides() {
    const image = document.getElementById("slide-image");
    const range = document.getElementById("slide-range");
    const output = document.getElementById("slide-count");
    const rail = document.getElementById("thumbnail-rail");
    const errorState = document.getElementById("viewer-error");

    for (let index = 1; index <= 57; index += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.slide = String(index);
      button.setAttribute("aria-label", "前往投影片 " + index + "：" + slideTitles[index - 1]);
      const thumb = document.createElement("img");
      thumb.src = "assets/slides/slide-" + index + ".png";
      thumb.alt = "";
      thumb.loading = "lazy";
      thumb.width = 320;
      thumb.height = 180;
      const label = document.createElement("span");
      label.textContent = String(index).padStart(2, "0");
      button.append(thumb, label);
      button.addEventListener("click", function () { setSlide(index, true); });
      rail.appendChild(button);
    }

    function setSlide(number, centerThumbnail) {
      const slide = Math.max(1, Math.min(57, Number(number)));
      state.slide = slide;
      saveState();
      image.hidden = false;
      errorState.hidden = true;
      image.src = "assets/slides/slide-" + slide + ".png";
      image.alt = "投影片 " + slide + "：" + slideTitles[slide - 1];
      range.value = String(slide);
      output.textContent = String(slide).padStart(2, "0") + " / 57";
      rail.querySelectorAll("button").forEach(function (button) {
        button.classList.toggle("is-active", Number(button.dataset.slide) === slide);
      });
      const active = rail.querySelector('[data-slide="' + slide + '"]');
      if (centerThumbnail && active) {
        active.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", inline: "center", block: "nearest" });
      }
    }

    image.addEventListener("error", function () {
      image.hidden = true;
      errorState.hidden = false;
    });
    range.addEventListener("input", function () { setSlide(range.value, false); });
    document.getElementById("slide-prev").addEventListener("click", function () { setSlide(state.slide - 1, true); });
    document.getElementById("slide-next").addEventListener("click", function () { setSlide(state.slide + 1, true); });
    setSlide(state.slide || 1, false);
  }

  function init() {
    setupTheme();
    setupReveal();
    setupModules();
    setupRoleLab();
    setupBlueprint();
    setupMvp();
    setupFlow();
    setupLens();
    setupShip();
    setupSlides();
    refreshIcons();
  }

  init();
}());
