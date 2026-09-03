(function () {
  "use strict";

  const promptSource = "materials/docs/prompt-library.md";
  const promptDescriptions = {
    "N-CLASS": "20 分鐘完成來源、事件、紅線、待確認與創作空間。當堂核心只用這一組。",
    N00: "先替整本 NotebookLM 筆記本設定來源與引用規則。",
    N01: "盤點每份來源能證明什麼，以及授權或審訂狀態。",
    N02: "核對原作中的事件、人物、原因與結果。",
    N03: "整理文化、語言、授權與不可泛化的紅線。",
    N04: "從核對後事件拆故事節拍，再比較 6、7、8 頁方案。",
    N05: "建立不補想像的角色與場景事實表。",
    N06: "在不改變原意的前提下提出分齡文字建議。",
    N07: "製作只用於檢查敘事與閱讀方向的故事樣書。",
    N08: "重新上傳草稿後，逐項對照來源做初步核對。",
    C00: "先訪談需求，沒有資料就不替作者假設。",
    C01: "把核准事實包拆成節拍，再由作者選頁數。",
    C02: "把核准故事與分頁方案填入內容 YAML。",
    C03: "建立角色、場景、畫風與輸出規格 YAML。",
    C04: "建立不可改寫、不可泛化與待真人確認的紅線 YAML。",
    C05: "只為一個頁面建立可檢查的繪圖工單。",
    C06: "把工單與固定規格組成無字生圖提示詞。",
    C07: "交給新對話或同儕做不替作品找理由的獨立驗收。",
    C08: "只修失敗頁的最小問題，第三次失敗就交給人。",
    C09: "保存每頁版本、失敗項目、最小修正與真人審訂狀態。"
  };

  const yamlFiles = [
    { label: "模板 00｜來源包", path: "materials/yaml/templates/00-source-pack.template.yaml" },
    { label: "模板 01｜故事內容", path: "materials/yaml/templates/01-content.template.yaml" },
    { label: "模板 02｜視覺系統", path: "materials/yaml/templates/02-visual-system.template.yaml" },
    { label: "模板 03｜權利／文化紅線", path: "materials/yaml/templates/03-culture-guardrails.template.yaml" },
    { label: "模板 04｜單頁繪圖工單", path: "materials/yaml/templates/04-page-drawing-job.template.yaml" },
    { label: "模板 05｜驗收規則", path: "materials/yaml/templates/05-criterion.template.yaml" },
    { label: "模板 06｜製作紀錄", path: "materials/yaml/templates/06-production-log.template.yaml" },
    { label: "範例 00｜紅雨傘來源包", path: "materials/yaml/example-red-umbrella/00-source-pack.example.yaml" },
    { label: "範例 01｜紅雨傘故事內容", path: "materials/yaml/example-red-umbrella/01-content.example.yaml" },
    { label: "範例 02｜紅雨傘視覺系統", path: "materials/yaml/example-red-umbrella/02-visual-system.example.yaml" },
    { label: "範例 03｜紅雨傘紅線", path: "materials/yaml/example-red-umbrella/03-culture-guardrails.example.yaml" },
    { label: "範例 04A｜封面工單", path: "materials/yaml/example-red-umbrella/04a-cover-drawing-job.example.yaml" },
    { label: "範例 04B｜第 1 頁工單", path: "materials/yaml/example-red-umbrella/04b-page-01-drawing-job.example.yaml" },
    { label: "範例 04C｜第 5 頁修正版工單", path: "materials/yaml/example-red-umbrella/04c-page-05-drawing-job.example.yaml" },
    { label: "範例 05｜紅雨傘驗收規則", path: "materials/yaml/example-red-umbrella/05-criterion.example.yaml" },
    { label: "範例 06｜紅雨傘製作紀錄", path: "materials/yaml/example-red-umbrella/06-production-log.example.yaml" }
  ];

  const state = {
    prompts: [],
    promptGroup: "notebook",
    activePrompt: null,
    yamlText: ""
  };

  function normalizeSummary(value) {
    return value
      .replace(/\[[^\]]+\]\([^\)]+\)/g, "")
      .replace(/[`*_>#-]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function parsePromptLibrary(markdown) {
    const headingPattern = /^##\s+(N-CLASS|N\d{2}|C\d{2})｜([^\r\n]+)$/gm;
    const headings = Array.from(markdown.matchAll(headingPattern));

    return headings.map((match, index) => {
      const start = match.index + match[0].length;
      const end = index + 1 < headings.length ? headings[index + 1].index : markdown.length;
      const section = markdown.slice(start, end);
      const codeMatch = section.match(/```(?:text)?\r?\n([\s\S]*?)```/i);
      const firstParagraph = section
        .split("```")[0]
        .split(/\r?\n/)
        .map(normalizeSummary)
        .find(Boolean);

      return {
        code: match[1],
        title: match[2].trim(),
        group: match[1].startsWith("N") ? "notebook" : "chat",
        summary: promptDescriptions[match[1]] || firstParagraph || "依照任務複製後，再替換方括號中的內容。",
        content: `【用途】${promptDescriptions[match[1]] || firstParagraph || "依照任務複製後，再替換方括號中的內容。"}\n\n${codeMatch ? codeMatch[1].trim() : "這一節沒有可複製的程式碼區塊，請下載完整提示詞原稿查看說明。"}`
      };
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
    const copied = document.execCommand("copy");
    textarea.remove();
    if (!copied) throw new Error("copy_failed");
  }

  function promptElements() {
    return {
      list: document.getElementById("prompt-list"),
      search: document.getElementById("prompt-search"),
      code: document.getElementById("prompt-code"),
      title: document.getElementById("prompt-title"),
      summary: document.getElementById("prompt-summary"),
      content: document.getElementById("prompt-content"),
      copy: document.getElementById("copy-prompt"),
      status: document.getElementById("prompt-status")
    };
  }

  function showPrompt(prompt) {
    const elements = promptElements();
    state.activePrompt = prompt;
    elements.code.textContent = prompt.code;
    elements.title.textContent = prompt.title;
    elements.summary.textContent = prompt.summary;
    elements.content.textContent = prompt.content;
    elements.copy.disabled = false;
    elements.status.textContent = "";
    renderPromptList();
  }

  function renderPromptList() {
    const elements = promptElements();
    const query = elements.search.value.trim().toLocaleLowerCase("zh-Hant");
    const filtered = state.prompts.filter((prompt) => {
      if (prompt.group !== state.promptGroup) return false;
      if (!query) return true;
      return `${prompt.code} ${prompt.title} ${prompt.summary} ${prompt.content}`.toLocaleLowerCase("zh-Hant").includes(query);
    });

    elements.list.replaceChildren();
    if (!filtered.length) {
      const message = document.createElement("p");
      message.className = "prompt-empty";
      message.textContent = "這個分類找不到符合的提示詞。";
      elements.list.appendChild(message);
      return;
    }

    filtered.forEach((prompt) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `prompt-item${state.activePrompt && state.activePrompt.code === prompt.code ? " is-active" : ""}`;
      button.setAttribute("aria-pressed", state.activePrompt && state.activePrompt.code === prompt.code ? "true" : "false");

      const code = document.createElement("b");
      code.textContent = prompt.code;
      const title = document.createElement("span");
      title.textContent = prompt.title;
      button.append(code, title);
      button.addEventListener("click", () => showPrompt(prompt));
      elements.list.appendChild(button);
    });
  }

  async function initPrompts() {
    const elements = promptElements();

    try {
      const response = await fetch(promptSource, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.prompts = parsePromptLibrary(await response.text());
      if (state.prompts.length !== 20) throw new Error(`預期 20 組，實際 ${state.prompts.length} 組`);
      showPrompt(state.prompts.find((prompt) => prompt.code === "N-CLASS") || state.prompts[0]);
    } catch (error) {
      elements.code.textContent = "載入失敗";
      elements.title.textContent = "提示詞庫暫時無法顯示";
      elements.summary.textContent = "請下載完整 Markdown 原稿，或稍後重新整理頁面。";
      elements.content.textContent = `來源：${promptSource}\n錯誤：${error.message}`;
      elements.status.textContent = "仍可使用下方教材下載區。";
    }

    document.querySelectorAll("[data-prompt-group]").forEach((tab) => {
      tab.addEventListener("click", () => {
        state.promptGroup = tab.dataset.promptGroup;
        document.querySelectorAll("[data-prompt-group]").forEach((item) => {
          const selected = item === tab;
          item.classList.toggle("is-active", selected);
          item.setAttribute("aria-selected", selected ? "true" : "false");
        });
        const first = state.prompts.find((prompt) => prompt.group === state.promptGroup);
        if (first) showPrompt(first);
      });
    });

    elements.search.addEventListener("input", renderPromptList);
    elements.copy.addEventListener("click", async () => {
      if (!state.activePrompt) return;
      try {
        await copyText(state.activePrompt.content);
        elements.status.textContent = `已複製 ${state.activePrompt.code}。記得替換〔 〕中的內容。`;
      } catch (error) {
        elements.status.textContent = "瀏覽器無法自動複製，請點進程式碼區後手動全選。";
      }
    });
  }

  async function loadYaml(file) {
    const content = document.getElementById("yaml-content");
    const status = document.getElementById("yaml-status");
    const copyButton = document.getElementById("copy-yaml");
    const downloadLink = document.getElementById("download-yaml");

    content.textContent = "載入中…";
    status.textContent = "";
    copyButton.disabled = true;
    downloadLink.href = file.path;

    try {
      const response = await fetch(file.path, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      state.yamlText = await response.text();
      content.textContent = state.yamlText;
      copyButton.disabled = false;
    } catch (error) {
      state.yamlText = "";
      content.textContent = `檔案載入失敗：${error.message}`;
      status.textContent = "你仍可使用右上角下載連結直接開啟檔案。";
    }
  }

  function initYaml() {
    const select = document.getElementById("yaml-select");
    const copyButton = document.getElementById("copy-yaml");
    const status = document.getElementById("yaml-status");

    yamlFiles.forEach((file, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = file.label;
      select.appendChild(option);
    });

    select.addEventListener("change", () => loadYaml(yamlFiles[Number(select.value)]));
    copyButton.addEventListener("click", async () => {
      if (!state.yamlText) return;
      try {
        await copyText(state.yamlText);
        status.textContent = `已複製「${yamlFiles[Number(select.value)].label}」。`;
      } catch (error) {
        status.textContent = "瀏覽器無法自動複製，請點進 YAML 區後手動全選。";
      }
    });

    loadYaml(yamlFiles[0]);
  }

  function initGateChecklist() {
    const inputs = Array.from(document.querySelectorAll("[data-gate]"));
    const status = document.getElementById("gate-status");
    const storageKey = "calumai-taipei-0904-gates-v1";
    let saved = {};

    try {
      saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    } catch (error) {
      saved = {};
    }

    function updateStatus() {
      const completed = inputs.filter((input) => input.checked).length;
      status.textContent = `我的課堂檢查進度：${completed} / ${inputs.length}。這是本機進度，不等於具名授權或正式公開放行。`;
    }

    inputs.forEach((input) => {
      input.checked = Boolean(saved[input.dataset.gate]);
      input.addEventListener("change", () => {
        saved[input.dataset.gate] = input.checked;
        try {
          localStorage.setItem(storageKey, JSON.stringify(saved));
        } catch (error) {
          // Storage may be blocked; the current page still keeps the checked state.
        }
        updateStatus();
      });
    });

    updateStatus();
  }

  function initReadingProgress() {
    const bar = document.getElementById("reading-progress-bar");
    let scheduled = false;

    function update() {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const percent = scrollable > 0 ? Math.min(100, Math.max(0, window.scrollY / scrollable * 100)) : 0;
      bar.style.width = `${percent}%`;
      scheduled = false;
    }

    window.addEventListener("scroll", () => {
      if (scheduled) return;
      scheduled = true;
      window.requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  initPrompts();
  initYaml();
  initGateChecklist();
  initReadingProgress();
})();
