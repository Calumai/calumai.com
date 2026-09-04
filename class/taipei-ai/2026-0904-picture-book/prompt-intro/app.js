(() => {
  "use strict";

  const stageTabs = Array.from(document.querySelectorAll("[data-stage]"));
  const stagePanels = Array.from(document.querySelectorAll("[data-panel]"));
  const stageCount = document.querySelector("#stage-count");
  const stageHelp = document.querySelector("#stage-help");
  const previousStage = document.querySelector("#previous-stage");
  const nextStage = document.querySelector("#next-stage");
  const helpText = [
    "先切換兩種寫法，看四個元件多了哪些。",
    "每一列點一個選項，右邊會即時組成提示詞。",
    "換三種教師工作，看看清楚的提示詞怎麼寫。",
    "結果不合用時，先找出少交代的那一塊。",
    "三題都可以重答，重點是看懂原因。",
    "複製範本後，就能接著練圖片提示詞。"
  ];
  let activeStage = 0;

  function showStage(index, shouldFocus = false) {
    const nextIndex = Math.max(0, Math.min(stagePanels.length - 1, index));
    activeStage = nextIndex;

    stageTabs.forEach((tab, tabIndex) => {
      const selected = tabIndex === nextIndex;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });

    stagePanels.forEach((panel, panelIndex) => {
      const selected = panelIndex === nextIndex;
      panel.hidden = !selected;
      panel.classList.toggle("is-active", selected);
    });

    stageCount.textContent = `${nextIndex + 1} / ${stagePanels.length}`;
    stageHelp.textContent = helpText[nextIndex];
    previousStage.disabled = nextIndex === 0;
    nextStage.textContent = nextIndex === stagePanels.length - 1 ? "前往八關暖身" : "下一關";

    if (shouldFocus) stageTabs[nextIndex].focus();
  }

  stageTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => showStage(index));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      if (event.key === "Home") return showStage(0, true);
      if (event.key === "End") return showStage(stageTabs.length - 1, true);
      const direction = event.key === "ArrowRight" ? 1 : -1;
      showStage((index + direction + stageTabs.length) % stageTabs.length, true);
    });
  });

  previousStage.addEventListener("click", () => showStage(activeStage - 1));
  nextStage.addEventListener("click", () => {
    if (activeStage === stagePanels.length - 1) {
      window.location.href = "../warmup/";
      return;
    }
    showStage(activeStage + 1);
  });

  const compareData = {
    bad: {
      state: "現在看：隨手寫",
      count: "只有任務",
      prompt: "幫我做一張介紹水循環的投影片。",
      result: "AI 得自己猜學生年齡、重點數量、文字多寡與呈現方式，結果很容易不合用。",
      checks: ["task"],
      className: "is-bad"
    },
    good: {
      state: "現在看：交代清楚",
      count: "四個元件都有",
      prompt: "你是一位國小自然科老師。請做一張介紹水循環的投影片，給第一次學這個主題的五年級學生看。使用標題、三個重點與一個生活例子，整頁不超過 120 字。",
      result: "AI 已經知道回答身分、工作內容、學生程度與成品格式，第一版比較容易直接拿來調整。",
      checks: ["role", "task", "context", "format"],
      className: "is-good"
    }
  };
  const compareButtons = Array.from(document.querySelectorAll("[data-compare]"));
  const compareCard = document.querySelector("#compare-card");
  const compareState = document.querySelector("#compare-state");
  const compareCount = document.querySelector("#compare-count");
  const comparePrompt = document.querySelector("#compare-prompt");
  const compareResult = document.querySelector("#compare-result");
  const compareChecks = Array.from(document.querySelectorAll("[data-check]"));

  function updateComparison(key) {
    const data = compareData[key];
    compareButtons.forEach((button) => button.setAttribute("aria-pressed", String(button.dataset.compare === key)));
    compareCard.classList.remove("is-bad", "is-good");
    compareCard.classList.add(data.className);
    compareState.textContent = data.state;
    compareCount.textContent = data.count;
    comparePrompt.textContent = data.prompt;
    compareResult.textContent = data.result;
    compareChecks.forEach((item) => item.classList.toggle("is-on", data.checks.includes(item.dataset.check)));
  }

  compareButtons.forEach((button) => button.addEventListener("click", () => updateComparison(button.dataset.compare)));

  const builderState = new Map();
  const builderGroups = Array.from(document.querySelectorAll("[data-builder-group]"));
  const builderOutput = document.querySelector("#builder-output");
  const builderEmpty = document.querySelector("#builder-empty");
  const builderCount = document.querySelector("#builder-count");
  const copyBuilder = document.querySelector("#copy-builder");
  const resetBuilder = document.querySelector("#reset-builder");
  const builderStatus = document.querySelector("#builder-status");

  function renderBuilder() {
    const lines = builderGroups
      .map((group) => builderState.get(group.dataset.builderGroup))
      .filter(Boolean);
    builderOutput.textContent = lines.join("\n");
    builderEmpty.hidden = lines.length > 0;
    builderOutput.hidden = lines.length === 0;
    builderCount.textContent = `已放入 ${lines.length} 個元件`;
    copyBuilder.disabled = lines.length === 0;
    resetBuilder.disabled = lines.length === 0;
    builderStatus.textContent = lines.length === 4 ? "四個元件都到齊了，可以複製後再調整。" : "";
  }

  builderGroups.forEach((group) => {
    const buttons = Array.from(group.querySelectorAll("button[data-value]"));
    buttons.forEach((button) => {
      button.addEventListener("click", () => {
        buttons.forEach((choice) => choice.setAttribute("aria-pressed", String(choice === button)));
        builderState.set(group.dataset.builderGroup, button.dataset.value);
        renderBuilder();
      });
    });
  });

  resetBuilder.addEventListener("click", () => {
    builderState.clear();
    document.querySelectorAll("[data-builder-group] button").forEach((button) => button.setAttribute("aria-pressed", "false"));
    renderBuilder();
    builderStatus.textContent = "已清空，可以重新選擇。";
  });

  async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.appendChild(helper);
    helper.select();
    const copied = document.execCommand("copy");
    helper.remove();
    if (!copied) throw new Error("COPY_FAILED");
  }

  async function runCopy(button, status, text) {
    const originalLabel = button.textContent;
    button.disabled = true;
    try {
      await copyText(text);
      button.textContent = "已複製";
      status.textContent = "已複製，可以貼到 AI 對話裡。";
    } catch (error) {
      status.textContent = "瀏覽器沒有允許自動複製，請直接選取文字複製。";
    } finally {
      window.setTimeout(() => {
        button.textContent = originalLabel;
        button.disabled = false;
      }, 1600);
    }
  }

  copyBuilder.addEventListener("click", () => runCopy(copyBuilder, builderStatus, builderOutput.textContent));

  const exampleTabs = Array.from(document.querySelectorAll(".example-tabs [role='tab']"));
  const examplePanels = Array.from(document.querySelectorAll(".example-panel"));

  function showExample(index, shouldFocus = false) {
    exampleTabs.forEach((tab, tabIndex) => {
      const selected = tabIndex === index;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    examplePanels.forEach((panel, panelIndex) => { panel.hidden = panelIndex !== index; });
    if (shouldFocus) exampleTabs[index].focus();
  }

  exampleTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => showExample(index));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      showExample((index + direction + exampleTabs.length) % exampleTabs.length, true);
    });
  });

  const quizTabs = Array.from(document.querySelectorAll("[data-quiz-tab]"));
  const quizCards = Array.from(document.querySelectorAll("[data-quiz]"));
  const quizSummary = document.querySelector("#quiz-summary");
  const quizAnswers = new Map();
  const feedback = {
    q1: {
      correct: "答對了。AI 不知道你的學生、目標與教材，這些資料要由老師提供。",
      wrong: "再想一下：問題不是 AI 不夠認真，而是它還不知道這堂課的對象與目標。"
    },
    q2: {
      correct: "答對了。「太難」很主觀，要補上誰要看，以及什麼程度才算適合。",
      wrong: "再想一下：AI 看得懂這句話，但不知道你心中的「不難」是什麼標準。"
    },
    q3: {
      correct: "答對了。指出不合用的地方，再補一個明確方向，比重送同一句有效。",
      wrong: "再試一次。第一版是草稿，具體說出哪裡不對，才有機會得到更好的下一版。"
    }
  };

  function showQuiz(index, shouldFocus = false) {
    quizTabs.forEach((tab, tabIndex) => {
      const selected = tabIndex === index;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
    quizCards.forEach((card, cardIndex) => { card.hidden = cardIndex !== index; });
    if (shouldFocus) quizTabs[index].focus();
  }

  quizTabs.forEach((tab, index) => {
    tab.addEventListener("click", () => showQuiz(index));
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const direction = event.key === "ArrowRight" ? 1 : -1;
      showQuiz((index + direction + quizTabs.length) % quizTabs.length, true);
    });
  });

  quizCards.forEach((card) => {
    const quizId = card.dataset.quiz;
    const correctAnswer = card.dataset.answer;
    const choices = Array.from(card.querySelectorAll("[data-choice]"));
    const feedbackBox = card.querySelector(".quiz-feedback");
    choices.forEach((choice) => {
      choice.addEventListener("click", () => {
        const selectedAnswer = choice.dataset.choice;
        const correct = selectedAnswer === correctAnswer;
        quizAnswers.set(quizId, { answer: selectedAnswer, correct });
        choices.forEach((button) => {
          const selected = button === choice;
          button.setAttribute("aria-pressed", String(selected));
          button.classList.remove("is-correct", "is-wrong");
          if (selected) button.classList.add(correct ? "is-correct" : "is-wrong");
        });
        feedbackBox.textContent = feedback[quizId][correct ? "correct" : "wrong"];

        if (quizAnswers.size === quizCards.length) {
          const score = Array.from(quizAnswers.values()).filter((answer) => answer.correct).length;
          quizSummary.textContent = score === quizCards.length
            ? "3 題都答對了。你已經抓到提示詞的重點。"
            : `目前答對 ${score} 題。可以回到答錯的題目再選一次。`;
        } else {
          quizSummary.textContent = `已完成 ${quizAnswers.size} / ${quizCards.length} 題。`;
        }
      });
    });
  });

  const copyTemplate = document.querySelector("#copy-template");
  const templateText = document.querySelector("#template-text");
  const templateStatus = document.querySelector("#template-status");
  copyTemplate.addEventListener("click", () => runCopy(copyTemplate, templateStatus, templateText.textContent.trim()));

  showStage(0);
  updateComparison("bad");
  renderBuilder();
})();
