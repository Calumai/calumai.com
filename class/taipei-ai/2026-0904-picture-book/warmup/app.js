(() => {
  "use strict";

  const steps = [
    { title: "AI 會通靈嗎？", subtitle: "先看一個故意很模糊的圖片描述。" },
    { title: "多一個線索", subtitle: "依序點選不同句子，看看多一個線索後，圖片描述會怎麼變。" },
    { title: "換個場景", subtitle: "角色與動作不變，只替故事換一個地方。" },
    { title: "要看多近？", subtitle: "先用白話選距離，再認識特寫、中景與遠景。" },
    { title: "故事換衣服", subtitle: "內容不變，只替畫面換一種視覺風格。" },
    { title: "AI 偷加什麼？", subtitle: "找出你沒提到、AI 卻可能自己加進畫面的東西。" },
    { title: "救一句短句", subtitle: "兩個字就能開始，再補一個讓 AI 少猜的線索。" },
    { title: "我的第一幕", subtitle: "把剛才的選擇組合成可以直接使用的圖片描述。" }
  ];

  const detailOptions = [
    {
      text: "一隻飛鼠。",
      note: "只有角色",
      character: "一隻飛鼠",
      action: "出現在畫面中央"
    },
    {
      text: "一隻棕色小飛鼠。",
      note: "加上外觀",
      character: "一隻棕色小飛鼠",
      action: "出現在畫面中央"
    },
    {
      text: "一隻棕色小飛鼠，圓圓大眼睛，穿白色背心。",
      note: "角色更固定",
      character: "一隻棕色小飛鼠，圓圓大眼睛，穿白色背心",
      action: "出現在畫面中央"
    },
    {
      text: "一隻棕色小飛鼠，穿白色背心，坐在樹枝上看故事書。",
      note: "加入動作",
      character: "一隻棕色小飛鼠，穿白色背心",
      action: "坐在樹枝上看故事書"
    }
  ];

  const state = {
    current: 0,
    done: new Set(),
    selectedGuess: "",
    detailIndex: null,
    character: "一隻棕色小飛鼠，圓圓大眼睛，穿白色背心",
    action: "坐在樹枝上看故事書",
    scene: "清晨有柔和陽光的森林",
    shot: "中景，角色與一點環境都看得見",
    style: "溫暖水彩繪本",
    extras: new Set(),
    topic: ""
  };

  const panel = document.getElementById("task-panel");
  const previousButton = document.getElementById("previous-step");
  const nextButton = document.getElementById("next-step");
  const progressCount = document.getElementById("progress-count");
  const previewCharacter = document.getElementById("preview-character");
  const previewScene = document.getElementById("preview-scene");
  const previewShot = document.getElementById("preview-shot");
  const previewStyle = document.getElementById("preview-style");
  const previewText = document.getElementById("preview-text");

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (character) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    })[character]);
  }

  function avoidedText() {
    const extras = Array.from(state.extras);
    return ["不要文字", "不要浮水印", "不要多餘手腳", ...extras.map((item) => `不要${item}`)].join("、");
  }

  function buildPrompt() {
    const topic = state.topic ? `主題是「${state.topic}」。` : "";
    return `請生成一張無字兒童繪本插圖。${topic}主角是${state.character}，${state.action}。場景是${state.scene}。使用${state.shot}，畫面風格為${state.style}，整體光線自然、主體清楚。${avoidedText()}。`;
  }

  function topicPracticeSentence() {
    if (!state.topic) return "";
    return `請畫「${state.topic}」的兒童繪本場景。採用中景，清楚呈現主角，背景簡潔，不要文字。`;
  }

  function markDone(index) {
    state.done.add(index);
    syncNavigation();
  }

  function syncNavigation() {
    document.querySelectorAll("[data-warmup-step]").forEach((button) => {
      const index = Number(button.dataset.warmupStep);
      if (index === state.current) button.setAttribute("aria-current", "step");
      else button.removeAttribute("aria-current");
      button.classList.toggle("is-done", state.done.has(index));
    });
    progressCount.textContent = `${state.current + 1} / ${steps.length}`;
    previousButton.disabled = state.current === 0;
    nextButton.textContent = state.current === steps.length - 1 ? "進入 AI 圖片工作室" : "下一關";
  }

  function renderPreview() {
    previewCharacter.textContent = state.character;
    previewScene.textContent = state.scene;
    previewShot.textContent = state.shot;
    previewStyle.textContent = state.style;
    previewText.textContent = buildPrompt();
  }

  function taskShell(index, body, feedback) {
    return `
      <div class="task-copy">
        <p>第 ${index + 1} 關</p>
        <h2>${steps[index].title}</h2>
        <span>${steps[index].subtitle}</span>
      </div>
      ${body}
      <div class="feedback" id="step-feedback" aria-live="polite">${feedback}</div>
    `;
  }

  function renderGuessStep() {
    const choices = [
      ["寫實飛鼠", "像野外攝影"],
      ["可愛飛鼠", "大眼睛卡通角色"],
      ["森林故事", "飛鼠出現在完整場景"],
      ["太空飛鼠", "AI 自己補出奇幻情境"]
    ];
    const body = `
      <div class="challenge"><strong>只告訴 AI：</strong>「幫我畫一隻飛鼠。」你猜下面哪一種結果會出現？</div>
      <div class="choice-grid">
        ${choices.map(([title, note]) => `
          <button class="choice-button${state.selectedGuess === title ? " is-selected" : ""}" type="button" data-guess="${title}">
            <strong>${title}</strong><small>${note}</small>
          </button>
        `).join("")}
      </div>
    `;
    const feedback = state.selectedGuess
      ? "<strong>其實四種都有可能。</strong>你只說了飛鼠，AI 只好自己補上場景、畫風、動作和鏡頭。"
      : "先選一個答案。猜錯沒關係，這就是第一個重點。";
    panel.innerHTML = taskShell(0, body, feedback);
    panel.querySelectorAll("[data-guess]").forEach((button) => {
      button.addEventListener("click", () => {
        state.selectedGuess = button.dataset.guess;
        markDone(0);
        render();
      });
    });
  }

  function renderDetailStep() {
    const body = `
      <div class="challenge"><strong>任務：</strong>從最短的句子開始，依序往下點，看看每句多了哪個線索。</div>
      <div class="prompt-stack">
        ${detailOptions.map((option, index) => `
          <button class="prompt-choice${state.detailIndex === index ? " is-selected" : ""}" type="button" data-detail="${index}">
            <b>${index + 1}</b><span><strong>${option.text}</strong><small>${option.note}</small></span>
          </button>
        `).join("")}
      </div>
    `;
    const feedback = state.detailIndex === null
      ? "不用背格式。先注意每一句比上一句多了什麼。"
      : `<strong>${detailOptions[state.detailIndex].note}。</strong>資訊越清楚，AI 需要猜的地方越少。`;
    panel.innerHTML = taskShell(1, body, feedback);
    panel.querySelectorAll("[data-detail]").forEach((button) => {
      button.addEventListener("click", () => {
        const option = detailOptions[Number(button.dataset.detail)];
        state.detailIndex = Number(button.dataset.detail);
        state.character = option.character;
        state.action = option.action;
        markDone(1);
        render();
      });
    });
  }

  function renderSceneStep() {
    const scenes = [
      ["清晨森林", "清晨有柔和陽光的森林"],
      ["雨後公園", "剛下過雨的城市公園"],
      ["樹洞教室", "有木桌與故事卡的樹洞教室"],
      ["太空船窗邊", "能看見地球的太空船窗邊"]
    ];
    const body = `
      <div class="challenge"><strong>固定不變：</strong>${escapeHtml(state.character)}，${escapeHtml(state.action)}。</div>
      <div class="choice-grid">
        ${scenes.map(([label, value]) => `
          <button class="choice-button${state.scene === value ? " is-selected" : ""}" type="button" data-scene="${escapeHtml(value)}">
            <strong>${label}</strong><small>${value}</small>
          </button>
        `).join("")}
      </div>
    `;
    panel.innerHTML = taskShell(2, body, "只換場景，故事的感覺就會跟著改變。選一個你想看的地方。");
    panel.querySelectorAll("[data-scene]").forEach((button) => {
      button.addEventListener("click", () => {
        state.scene = button.dataset.scene;
        markDone(2);
        render();
      });
    });
  }

  function renderShotStep() {
    const shots = [
      ["靠很近", "臉部特寫，表情是畫面重點"],
      ["剛剛好", "中景，角色與一點環境都看得見"],
      ["退很遠", "遠景，讓環境成為畫面重點"]
    ];
    const body = `
      <div class="challenge"><strong>先問自己：</strong>我要讓觀眾看多近？</div>
      <div class="choice-grid compact">
        ${shots.map(([label, value]) => `
          <button class="choice-button${state.shot === value ? " is-selected" : ""}" type="button" data-shot="${escapeHtml(value)}">
            <strong>${label}</strong><small>${value}</small>
          </button>
        `).join("")}
      </div>
    `;
    panel.innerHTML = taskShell(3, body, "不必先背攝影術語。選完距離，再記住它叫特寫、中景或遠景。");
    panel.querySelectorAll("[data-shot]").forEach((button) => {
      button.addEventListener("click", () => {
        state.shot = button.dataset.shot;
        markDone(3);
        render();
      });
    });
  }

  function renderStyleStep() {
    const styles = [
      ["柔和水彩", "溫暖水彩繪本"],
      ["彩色鉛筆", "細膩彩色鉛筆繪本"],
      ["剪紙拼貼", "層次清楚的剪紙拼貼"],
      ["黏土公仔", "手作黏土公仔場景"],
      ["復古海報", "平面色塊復古海報"],
      ["3D 動畫", "柔和燈光的 3D 動畫風格"]
    ];
    const body = `
      <div class="challenge">前面選好的角色、動作和場景先不變，這一關只換畫風。</div>
      <div class="choice-grid compact">
        ${styles.map(([label, value]) => `
          <button class="choice-button${state.style === value ? " is-selected" : ""}" type="button" data-style="${escapeHtml(value)}">
            <strong>${label}</strong><small>${value}</small>
          </button>
        `).join("")}
      </div>
    `;
    panel.innerHTML = taskShell(4, body, "暖身先選常用畫風。更多風格可以等進入正式工作室再挑。");
    panel.querySelectorAll("[data-style]").forEach((button) => {
      button.addEventListener("click", () => {
        state.style = button.dataset.style;
        markDone(4);
        render();
      });
    });
  }

  function renderExtraStep() {
    const elements = [
      ["背包", "extra"],
      ["兔子", "extra"],
      ["奇怪招牌", "extra"],
      ["森林", "keep"],
      ["故事書", "keep"],
      ["飛鼠", "keep"]
    ];
    const body = `
      <div class="challenge"><strong>原本只要：</strong>一隻飛鼠在森林裡看故事書。請點出沒有要求的東西。</div>
      <div class="element-grid">
        ${elements.map(([label, type]) => `
          <button class="element-button${state.extras.has(label) ? " is-selected" : ""}" type="button" data-element="${label}" data-kind="${type}">${label}</button>
        `).join("")}
      </div>
    `;
    const selected = Array.from(state.extras);
    const feedback = selected.length
      ? `<strong>圖片描述會加上：</strong>${selected.map((item) => `不要${item}`).join("、")}。`
      : "點選多餘的項目，系統會自動把它加入「不要出現」清單。";
    panel.innerHTML = taskShell(5, body, feedback);
    panel.querySelectorAll("[data-element]").forEach((button) => {
      button.addEventListener("click", () => {
        const label = button.dataset.element;
        if (button.dataset.kind === "keep") {
          const feedbackElement = document.getElementById("step-feedback");
          feedbackElement.innerHTML = `<strong>${label}要保留。</strong>它本來就在圖片描述裡。`;
          button.classList.add("is-keep");
          return;
        }
        if (state.extras.has(label)) state.extras.delete(label);
        else state.extras.add(label);
        markDone(5);
        render();
      });
    });
  }

  function renderRescueStep() {
    const body = `
      <div class="challenge"><strong>太模糊的句子：</strong>「幫我畫一個漂亮的地方。」</div>
      <form class="topic-form" id="topic-form" novalidate>
        <label for="topic-input">你想畫什麼？</label>
        <input id="topic-input" name="topic" value="${escapeHtml(state.topic)}" placeholder="例如：雨天、龜兔賽跑" autocomplete="off">
        <small>先寫兩個字也可以，不必一次把所有細節想完。</small>
        <p class="inline-error" id="topic-error" aria-live="polite"></p>
        <button class="control-button primary" type="submit">組成圖片描述</button>
      </form>
      ${state.topic ? `<div class="final-prompt"><p>${escapeHtml(topicPracticeSentence())}</p></div>` : ""}
    `;
    panel.innerHTML = taskShell(6, body, state.topic
      ? "很好。你只補了主題，句子就已經比「漂亮的地方」清楚很多。"
      : "這關只要填一個主題，系統會先幫你補成一段簡短的圖片描述。"
    );
    document.getElementById("topic-form").addEventListener("submit", (event) => {
      event.preventDefault();
      const input = document.getElementById("topic-input");
      const value = input.value.trim();
      if (Array.from(value).length < 2) {
        document.getElementById("topic-error").textContent = "先寫兩個字就可以，例如「雨天」。";
        return;
      }
      state.topic = value;
      markDone(6);
      render();
    });
  }

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function renderFinalStep() {
    const prompt = buildPrompt();
    const body = `
      <div class="challenge"><strong>完成：</strong>前面選好的角色、場景、鏡頭、畫風和不想出現的東西，已整理成一段圖片描述。</div>
      <div class="final-prompt"><p id="final-prompt-text">${escapeHtml(prompt)}</p></div>
      <div class="final-actions">
        <button class="control-button primary" id="copy-final-prompt" type="button">複製圖片描述</button>
        <a class="control-button secondary" href="../#prompts">查看完整提示詞庫</a>
      </div>
    `;
    panel.innerHTML = taskShell(7, body, "先複製這一版。生成圖片後，如果有不符合預期的地方，一次只改一、兩項。");
    document.getElementById("copy-final-prompt").addEventListener("click", async (event) => {
      const button = event.currentTarget;
      try {
        await copyText(prompt);
        button.textContent = "已複製";
        markDone(7);
      } catch {
        document.getElementById("step-feedback").textContent = "瀏覽器無法自動複製，請手動選取上方文字。";
      }
    });
  }

  function render() {
    const renderers = [
      renderGuessStep,
      renderDetailStep,
      renderSceneStep,
      renderShotStep,
      renderStyleStep,
      renderExtraStep,
      renderRescueStep,
      renderFinalStep
    ];
    renderers[state.current]();
    syncNavigation();
    renderPreview();
  }

  document.querySelectorAll("[data-warmup-step]").forEach((button) => {
    button.addEventListener("click", () => {
      state.current = Number(button.dataset.warmupStep);
      render();
    });
  });

  previousButton.addEventListener("click", () => {
    if (state.current === 0) return;
    state.current -= 1;
    render();
  });

  nextButton.addEventListener("click", () => {
    if (state.current === steps.length - 1) {
      window.location.href = "../practice/";
      return;
    }
    state.current += 1;
    render();
  });

  render();
})();
