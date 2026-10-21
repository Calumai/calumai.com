(() => {
  "use strict";

  const lessons = window.TRUKU_LESSONS || [];
  const prompts = window.TRUKU_PROMPTS || {};
  const reviewHolds = {
    "09": { 2: "原稿第 2 張有已確認的族語拼字錯誤。" },
    "16": { 1: "原稿封面仍有英文 Placeholder。" },
    "19": { 1: "原稿封面標錯主題。", 9: "原稿第 9 張文字重疊。" }
  };
  const byId = new Map(lessons.map((lesson) => [lesson.id, lesson]));
  const groups = ["全部", ...new Set(lessons.map((lesson) => lesson.group))];
  const $ = (id) => document.getElementById(id);
  const home = $("home");
  const player = $("player");
  const grid = $("lessonGrid");
  const filters = $("filters");
  const search = $("searchInput");
  const stage = $("stage");
  const slideImage = $("slideImage");
  const promptLesson = $("promptLesson");
  const mechanicDetails = {
    "賓果": "給學生可印的賓果格；教師逐題出示詞卡，學生自己找格子，下一張才公布對應答案。",
    "配對遊戲": "每回合給兩組可對照的詞卡，學生口答或拿紙卡配對，下一張才公布配對結果。",
    "限時搶答": "每回合先顯示題目和清楚的選項，教師倒數後讓學生舉牌或口答，下一張才揭曉。",
    "闖關解謎": "設計四個由易到難的關卡；學生答對後由教師翻頁進入下一關，下一張附正解與解釋。",
    "角色扮演": "用教材已有詞句安排兩人輪流扮演，先顯示任務卡，再顯示可核對的教材原句。",
    "排序挑戰": "把教材支持的詞卡打亂，請學生說出排序理由；若不只一種合理順序，請列出可接受答案。",
    "比手畫腳": "只選適合安全演示的詞，一人表演、同學猜意思；下一張公布教材中文義。",
    "猜謎": "每回合提供能由教材支持的線索與三個候選詞，學生先猜，下一張公布正解。"
  };
  let activeGroup = "全部";
  let currentLesson = null;
  let currentSlide = 1;
  let votes = { A: 0, B: 0, C: 0 };
  let timerHandle = null;
  let timerEnd = 0;

  const slidePath = (lesson, number) => `assets/slides/${lesson.id}/${String(number).padStart(2, "0")}.webp`;
  const thumbPath = (lesson, number) => `assets/thumbs/${lesson.id}/${String(number).padStart(2, "0")}.webp`;

  function renderFilters() {
    filters.replaceChildren();
    groups.forEach((group) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `filter-button${group === activeGroup ? " active" : ""}`;
      button.textContent = group;
      button.setAttribute("aria-pressed", String(group === activeGroup));
      button.addEventListener("click", () => {
        activeGroup = group;
        renderFilters();
        renderCards();
      });
      filters.append(button);
    });
  }

  function createCard(lesson) {
    const card = document.createElement("article");
    card.className = "lesson-card";
    const cover = document.createElement("a");
    cover.className = "card-cover";
    cover.href = `#lesson=${lesson.id}&slide=1`;
    cover.setAttribute("aria-label", `開啟${lesson.title}`);
    const image = document.createElement("img");
    if (reviewHolds[lesson.id]?.[1]) {
      cover.classList.add("cover-unavailable");
      const hold = document.createElement("span");
      hold.textContent = "封面待修正";
      cover.append(hold);
    } else {
      image.src = `assets/thumbs/${lesson.id}.webp`;
      image.alt = `${lesson.title}的 NotebookLM 封面`;
      image.loading = "lazy";
      cover.append(image);
    }

    const body = document.createElement("div");
    body.className = "card-body";
    const meta = document.createElement("div");
    meta.className = "card-meta";
    const id = document.createElement("span");
    id.textContent = `#${lesson.id} · ${lesson.group}`;
    const mechanic = document.createElement("span");
    mechanic.textContent = lesson.mechanic;
    meta.append(id, mechanic);
    const title = document.createElement("h3");
    title.textContent = lesson.title;
    const action = document.createElement("p");
    action.textContent = lesson.action;
    const footer = document.createElement("div");
    footer.className = "card-footer";
    const count = document.createElement("span");
    count.textContent = `${lesson.slides} 張投影片`;
    const open = document.createElement("a");
    open.href = `#lesson=${lesson.id}&slide=1`;
    open.textContent = "進入活動 ↗";
    footer.append(count, open);
    if (lesson.issue) {
      const issue = document.createElement("span");
      issue.className = "issue-chip";
      issue.title = lesson.issue;
      issue.textContent = "已知問題";
      body.append(meta, title, action, issue, footer);
    } else {
      body.append(meta, title, action, footer);
    }
    card.append(cover, body);
    return card;
  }

  function renderCards() {
    const query = search.value.trim().toLocaleLowerCase("zh-Hant");
    const matching = lessons.filter((lesson) => {
      const groupMatches = activeGroup === "全部" || lesson.group === activeGroup;
      const text = `${lesson.id} ${lesson.title} ${lesson.group} ${lesson.mechanic} ${lesson.action}`.toLocaleLowerCase("zh-Hant");
      return groupMatches && (!query || text.includes(query));
    });
    grid.replaceChildren(...matching.map(createCard));
    $("resultCount").textContent = `顯示 ${matching.length}／${lessons.length} 個活動`;
    $("emptyState").hidden = matching.length > 0;
  }

  function updatePrompt() {
    const lesson = byId.get(promptLesson.value) || lessons[0];
    if (!lesson) return;
    $("originalPrompt").value = prompts[lesson.id] || "此活動的原始提示詞尚未載入。";
    const isCustom = $("newMechanic").value === "custom";
    $("customMechanicLabel").hidden = !isCustom;
    const mechanic = isCustom ? ($("customMechanic").value.trim() || "自行設計的課堂遊戲") : $("newMechanic").value;
    const mechanicDetail = mechanicDetails[mechanic] || "先說明完整規則、學生要做什麼、教師何時翻頁，以及如何核對答案；若這種玩法無法用靜態簡報實作，請改成課堂口答或紙卡操作。";
    const audience = $("promptAudience").value.trim() || "族語初學者";
    const minutes = Math.min(90, Math.max(3, Number($("promptMinutes").value) || 15));
    $("changePrompt").value = `我已將《太魯閣語單詞句型本》PDF 加入 NotebookLM 來源。請以「${lesson.title}」的教材主題重新製作一份繁體中文課堂簡報，給${audience}使用，活動約 ${minutes} 分鐘。\n\n這次把遊戲形式改成「${mechanic}」，不要沿用原簡報的玩法。具體操作：${mechanicDetail}\n\n請做 1 張玩法說明、至少 4 回合題目與答案、1 張教師答案總表。每回合先出題，下一張才揭曉；畫面大字、留白，適合投影。學生的操作是口答、舉牌、拿紙卡或討論，由教師翻頁，不要宣稱簡報可以自動判分或點擊跳關。\n\n族語詞句、中文義、答案與頁碼只能依上傳的 PDF。保留原書拼寫與註記，不自造族語句子、發音、文化知識或圖紋。若來源不足，請刪題或標示待確認，不要猜。生成後請列出每題的 PDF 頁碼，供教師逐題核對。`;
  }

  async function copyPrompt(field, label) {
    const content = $(field).value;
    let copied = false;
    try {
      await navigator.clipboard.writeText(content);
      copied = true;
    } catch (_) {
      $(field).focus();
      $(field).select();
      try { copied = document.execCommand("copy"); } catch (_) { copied = false; }
    }
    $("copyStatus").textContent = copied ? `已複製${label}，可貼到 NotebookLM 的「投影片簡報」自訂說明。` : "複製未成功，請選取文字後按 Ctrl+C。";
  }

  function clearTimer() {
    if (timerHandle) window.clearInterval(timerHandle);
    timerHandle = null;
    timerEnd = 0;
    $("timerDisplay").textContent = "—";
    $("timerDisplay").classList.remove("done");
  }

  function startTimer(seconds) {
    clearTimer();
    timerEnd = Date.now() + seconds * 1000;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((timerEnd - Date.now()) / 1000));
      $("timerDisplay").textContent = remaining ? String(remaining) : "時間到";
      $("timerDisplay").classList.toggle("done", remaining === 0);
      if (remaining === 0) {
        window.clearInterval(timerHandle);
        timerHandle = null;
      }
    };
    tick();
    timerHandle = window.setInterval(tick, 120);
  }

  function clearVotes() {
    votes = { A: 0, B: 0, C: 0 };
    for (const option of ["A", "B", "C"]) $("count" + option).textContent = "0";
  }

  function setSlide(number) {
    if (!currentLesson) return;
    const next = Math.min(currentLesson.slides, Math.max(1, number));
    if (next !== currentSlide) {
      clearTimer();
      clearVotes();
    }
    currentSlide = next;
    const holdReason = reviewHolds[currentLesson.id]?.[currentSlide];
    slideImage.hidden = Boolean(holdReason);
    $("slideHold").hidden = !holdReason;
    $("slideHoldReason").textContent = holdReason || "";
    if (holdReason) slideImage.removeAttribute("src");
    else slideImage.src = slidePath(currentLesson, currentSlide);
    slideImage.alt = holdReason ? "" : `${currentLesson.title}第 ${currentSlide} 張投影片，原始圖片；請教師檢查族語內容`;
    $("stageLabel").textContent = `${currentLesson.title} · 第 ${currentSlide} 張`;
    $("slideCounter").textContent = `${currentSlide} / ${currentLesson.slides}`;
    $("prevButton").disabled = currentSlide === 1;
    $("nextButton").disabled = currentSlide === currentLesson.slides;
    for (const button of $("thumbStrip").querySelectorAll("button")) {
      const isCurrent = Number(button.dataset.slide) === currentSlide;
      button.classList.toggle("active", isCurrent);
      button.setAttribute("aria-current", isCurrent ? "true" : "false");
    }
    const currentThumb = $("thumbStrip").querySelector("button.active");
    currentThumb?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }

  function openLesson(lesson, slide) {
    const changed = !currentLesson || currentLesson.id !== lesson.id;
    currentLesson = lesson;
    home.hidden = true;
    player.hidden = false;
    if (changed) {
      currentSlide = 1;
      clearTimer();
      clearVotes();
      $("playerTitle").textContent = lesson.title;
      $("playerMeta").textContent = `活動 ${lesson.id}／20 · ${lesson.group} · ${lesson.mechanic}`;
      $("lessonMechanic").textContent = lesson.mechanic;
      $("lessonAction").textContent = lesson.action;
      $("lessonWarning").hidden = !lesson.issue;
      $("lessonWarning").textContent = lesson.issue ? `授課前注意：${lesson.issue}` : "";
      $("lessonPromptLink").onclick = () => { promptLesson.value = lesson.id; updatePrompt(); };
      const strip = $("thumbStrip");
      strip.replaceChildren();
      for (let number = 1; number <= lesson.slides; number++) {
        const button = document.createElement("button");
        button.type = "button";
        button.dataset.slide = String(number);
        button.setAttribute("aria-label", `跳到第 ${number} 張`);
        const thumb = document.createElement("img");
        if (reviewHolds[lesson.id]?.[number]) {
          button.classList.add("thumb-unavailable");
        } else {
          thumb.src = thumbPath(lesson, number);
          thumb.alt = "";
          thumb.loading = "lazy";
          button.append(thumb);
        }
        const label = document.createElement("span");
        label.textContent = String(number);
        button.append(label);
        button.addEventListener("click", () => goToSlide(number));
        strip.append(button);
      }
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    setSlide(slide);
  }

  function goToSlide(number) {
    if (!currentLesson) return;
    const next = Math.min(currentLesson.slides, Math.max(1, number));
    if (next === currentSlide) return;
    location.hash = `lesson=${currentLesson.id}&slide=${next}`;
  }

  function route() {
    const value = location.hash.replace(/^#/, "");
    const params = new URLSearchParams(value);
    const lesson = byId.get(params.get("lesson"));
    if (!lesson) {
      home.hidden = false;
      player.hidden = true;
      currentLesson = null;
      clearTimer();
      if (value === "prompts") window.requestAnimationFrame(() => $("prompts").scrollIntoView());
      return;
    }
    const rawSlide = Number(params.get("slide"));
    openLesson(lesson, Number.isFinite(rawSlide) ? rawSlide : 1);
  }

  search.addEventListener("input", renderCards);
  for (const lesson of lessons) {
    const option = document.createElement("option");
    option.value = lesson.id;
    option.textContent = `${lesson.id}｜${lesson.title}`;
    promptLesson.append(option);
  }
  for (const id of ["promptLesson", "newMechanic", "customMechanic", "promptAudience", "promptMinutes"]) {
    $(id).addEventListener(["customMechanic", "promptAudience", "promptMinutes"].includes(id) ? "input" : "change", updatePrompt);
  }
  $("copyOriginal").addEventListener("click", () => copyPrompt("originalPrompt", "原始提示詞"));
  $("copyChange").addEventListener("click", () => copyPrompt("changePrompt", "改版指令"));
  $("prevButton").addEventListener("click", () => goToSlide(currentSlide - 1));
  $("nextButton").addEventListener("click", () => goToSlide(currentSlide + 1));
  $("timerReset").addEventListener("click", clearTimer);
  for (const button of document.querySelectorAll(".timer-choice")) {
    button.addEventListener("click", () => startTimer(Number(button.dataset.seconds)));
  }
  for (const button of document.querySelectorAll(".vote-button")) {
    button.addEventListener("click", () => {
      const option = button.dataset.vote;
      votes[option] += 1;
      $("count" + option).textContent = String(votes[option]);
    });
  }
  $("clearVotes").addEventListener("click", clearVotes);
  $("fullscreenButton").addEventListener("click", async () => {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await stage.requestFullscreen();
  });
  stage.addEventListener("click", (event) => {
    if (document.fullscreenElement === stage && !event.target.closest("button")) goToSlide(currentSlide + 1);
  });
  let touchStart = null;
  stage.addEventListener("touchstart", (event) => { touchStart = event.changedTouches[0]?.clientX ?? null; }, { passive: true });
  stage.addEventListener("touchend", (event) => {
    if (touchStart === null) return;
    const delta = event.changedTouches[0].clientX - touchStart;
    if (Math.abs(delta) > 65) goToSlide(currentSlide + (delta < 0 ? 1 : -1));
    touchStart = null;
  }, { passive: true });
  document.addEventListener("keydown", (event) => {
    if (!currentLesson || /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || "")) return;
    if (event.key === "ArrowRight") { event.preventDefault(); goToSlide(currentSlide + 1); }
    if (event.key === "ArrowLeft") { event.preventDefault(); goToSlide(currentSlide - 1); }
    if (event.key.toLowerCase() === "f" && !event.repeat) $("fullscreenButton").click();
  });
  window.addEventListener("hashchange", route);
  renderFilters();
  renderCards();
  updatePrompt();
  route();
})();
