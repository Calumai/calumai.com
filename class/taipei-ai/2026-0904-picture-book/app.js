(function () {
  "use strict";

  const promptSource = "materials/docs/prompt-library.md";
  const promptGroupLabels = {
    notebook: "整理來源",
    teacher: "簡報與圖表",
    chat: "故事與規劃"
  };
  const promptDescriptions = {
    "N-CLASS": "20 分鐘把來源、故事事件、不能更動的內容與待確認項目整理成一份可核對的資料表。當堂只用這一組。",
    N00: "先替整本 NotebookLM 筆記本設定來源與引用規則。",
    N01: "盤點每份來源能證明什麼，以及授權或審訂狀態。",
    N02: "核對原作中的事件、人物、原因與結果。",
    N03: "列出文化、語言、授權，以及不能套用到整個族群的內容。",
    N04: "把核對過的事件分成故事段落，再安排成練習室使用的 4～6 頁小繪本。",
    N05: "建立不補想像的角色與場景事實表。",
    N06: "在不改變原意的前提下提出分齡文字建議。",
    N07: "先做一份故事樣書，檢查故事順序、每頁重點與閱讀方向。",
    N08: "重新上傳草稿後，逐項對照來源做初步核對。",
    T01: "貼到工作室的簡報自訂欄，製作老師上台講解用的 8～10 張投影片。",
    T02: "貼到工作室的簡報自訂欄，製作學生可獨立閱讀的複習版本。",
    T03: "用適合指定年齡的圖像比喻解釋抽象概念，並說明哪些部分不能照著類推。",
    T04: "把來源可回答的常見迷思整理成一頁一問的複習簡報。",
    T05: "以時序、原因與影響製作歷史或文化主題簡報。",
    T06: "用同一組面向比較概念、文本或觀點，避免沒有依據的結論。",
    T07: "貼到工作室的資訊圖表自訂欄，製作一頁課前預習圖。",
    T08: "把正式流程與安全規則做成能照著操作的步驟資訊圖表。",
    T09: "以單一清楚結構呈現分類、順序、因果或部分與整體。",
    T10: "把去除個人身分資料後的 3～5 個關鍵數字做成一頁重點圖。",
    T11: "把課綱、教材與教師筆記整理成可核對的 40 分鐘備課卡。",
    T12: "同一核心概念提供鷹架、標準與延伸三種閱讀支援。",
    T13: "產生學生學習單與分開的教師答案版，答案都能回到來源。",
    T14: "用去識別的全班結果找迷思、補救活動與離堂檢核。",
    T15: "把課表、教案與班規整理成不含學生個資的代課交接單。",
    T16: "建立保留正確拼寫與文化邊界的核心詞彙表。",
    T17: "準備三層討論題：先找證據、再連結關係，最後提出有依據的判斷。",
    T18: "貼到工作室的 Audio Overview（語音摘要）自訂欄，產生教師備課預聽。",
    T19: "貼到工作室的測驗／字卡自訂欄，建立可回查來源的練習。",
    T20: "分享筆記本前，檢查來源、AI 產出內容、個資、授權與文化風險。",
    C00: "先訪談需求，沒有資料就不替作者假設。",
    C01: "把確認過的故事資料分成幾個段落，再由作者確認 4～6 頁安排。",
    C02: "把核准故事與分頁方案填入內容 YAML。",
    C03: "建立角色、場景、畫風與輸出規格 YAML。",
    C04: "把不能改寫、不能套用到整個族群，以及需要真人確認的內容寫成 YAML。",
    C05: "只為一個繪本頁或漫畫頁建立可逐項檢查的單頁生圖設定。",
    C06: "把單頁生圖設定與固定規格組成無字繪本／漫畫頁提示詞。",
    C07: "交給新對話或同儕做不替作品找理由的獨立驗收。",
    C08: "每次只修一個最明顯的問題；第三次仍未通過，就交由老師處理。",
    C09: "保存每頁版本、未通過項目、這次修改的內容與真人審訂狀態。"
  };

  const presentationStylePrompts = {
    "notebook-text": `請保持目前簡報的主題、事實、數字、引文與頁面順序不變，只調整視覺風格。

視覺設定：
- 整體感受：〔例如：明亮、清楚、適合教室投影〕
- 配色：〔主色〕、〔輔色〕、〔強調色〕
- 字體感受：〔穩重／活潑／溫柔〕
- 圖像方向：〔照片／插畫／幾何圖形〕
- 版面：每頁一個重點，大字、少字、留白充足

不得新增來源未提供的內容。族語請逐字保留，完成後由老師逐字核對；傳統服飾、圖紋與器物需由熟悉該族文化者確認。`,
    "notebook-reference": `我已上傳一張有權使用的參考圖。請只參考圖中可直接觀察的配色、材質、線條、留白與版面節奏，不要複製標誌、人物、文字、圖紋或其他受保護內容。

請保持目前簡報的主題、事實、數字、引文與頁面順序不變，只調整視覺風格。若你無法讀取參考圖，請直接告訴我，不要自行猜測。

族語請逐字保留，完成後由老師逐字核對；傳統服飾、圖紋與器物需由熟悉該族文化者確認。`
  };

  const posterStyles = [
    {
      id: "soft-mist",
      name: "柔霧低彩度",
      mood: "安靜、柔和、留白充足",
      palette: ["霧藍", "暖灰", "米白", "少量深藍"],
      typography: "清楚的人文無襯線字，標題與內文層級分明",
      illustration: "柔邊色塊與淡薄紙張質感",
      layout: "寬鬆網格，重點集中，四周保留呼吸空間",
      avoid: "高飽和撞色、厚重陰影、背景過度裝飾"
    },
    {
      id: "isometric",
      name: "等角立體",
      mood: "清楚、有秩序、帶輕巧立體感",
      palette: ["天藍", "珊瑚橘", "淺灰", "深靛藍"],
      typography: "粗細對比清楚的現代無襯線字",
      illustration: "等角視角的小型物件與空間模組，光線方向一致",
      layout: "以 30 度軸線安排圖像，文字區保持水平",
      avoid: "立體文字、過多透視方向、遮住資訊的巨大物件"
    },
    {
      id: "neon-tech",
      name: "霓虹科技",
      mood: "俐落、明亮、具數位節奏",
      palette: ["深海軍藍", "電光青", "桃紅", "冷白"],
      typography: "簡潔幾何字體，重要數字使用高對比粗體",
      illustration: "細線網格、柔和光暈與少量介面感圖形",
      layout: "深色底搭配明確資訊卡，閱讀順序由左上至右下",
      avoid: "大面積刺眼光暈、低對比小字、仿製真實軟體介面"
    },
    {
      id: "crayon",
      name: "蠟筆手繪",
      mood: "親切、活潑、適合兒童課堂",
      palette: ["向日葵黃", "湖水藍", "磚紅", "紙張白"],
      typography: "圓潤易讀字體，正文維持排版字而非手寫效果",
      illustration: "可見蠟筆筆觸、輕微疊色與紙面顆粒",
      layout: "像課堂作品牆，標題明顯，資訊卡排列整齊",
      avoid: "把重要文字畫成難讀手寫字、過多塗抹、髒污紙面"
    },
    {
      id: "paper-collage",
      name: "紙張拼貼",
      mood: "有手作感、層次清楚、溫暖",
      palette: ["奶油白", "森林綠", "陶土紅", "天空藍"],
      typography: "穩定易讀的無襯線字，搭配小型剪紙標籤",
      illustration: "剪紙色塊、細微纖維、柔和投影與清楚輪廓",
      layout: "以紙片分區承載文字，層次不超過三層",
      avoid: "未確認的文化圖紋、過厚陰影、邊緣遮住文字"
    },
    {
      id: "chalkboard",
      name: "粉筆黑板",
      mood: "像老師現場講解，直接、有重點",
      palette: ["深墨綠", "粉筆白", "淡黃", "淺藍"],
      typography: "標題可帶粉筆感，正文使用清晰排版字",
      illustration: "簡單粉筆線稿、箭頭與框線，保留擦拭紋理",
      layout: "以大標題、三個重點區和一個結論區組成",
      avoid: "整頁密集手寫、低對比灰字、過多公式與箭頭"
    },
    {
      id: "decorative-geometry",
      name: "裝飾幾何",
      mood: "現代、醒目、節奏明確",
      palette: ["鈷藍", "番茄紅", "暖橙", "淺米色"],
      typography: "大標題配緊湊正文，字級差異清楚",
      illustration: "圓形、弧線、方塊與斜角等一般幾何元素",
      layout: "使用明確網格與局部跨欄，主訊息優先",
      avoid: "把未確認的傳統圖紋當裝飾、過量形狀、文字旋轉"
    },
    {
      id: "gentle-picture-book",
      name: "溫柔繪本",
      mood: "溫暖、敘事感強、適合親子與低年級",
      palette: ["天空藍", "嫩葉綠", "杏桃色", "暖白"],
      typography: "圓潤而清楚的字體，標題像繪本章名",
      illustration: "柔和水彩、簡化形體、自然光與細緻紙紋",
      layout: "主圖與文字區分明，每區只放一個訊息",
      avoid: "過度寫實人物、複雜背景、生成文字與浮水印"
    }
  ];

  const yamlFiles = [
    { label: "模板 00｜來源包", path: "materials/yaml/templates/00-source-pack.template.yaml" },
    { label: "模板 01｜故事內容", path: "materials/yaml/templates/01-content.template.yaml" },
    { label: "模板 02｜視覺系統", path: "materials/yaml/templates/02-visual-system.template.yaml" },
    { label: "模板 03｜權利／文化限制", path: "materials/yaml/templates/03-culture-guardrails.template.yaml" },
    { label: "模板 04｜單頁生圖設定", path: "materials/yaml/templates/04-page-drawing-job.template.yaml" },
    { label: "模板 05｜驗收規則", path: "materials/yaml/templates/05-criterion.template.yaml" },
    { label: "模板 06｜製作紀錄", path: "materials/yaml/templates/06-production-log.template.yaml" },
    { label: "範例 00｜紅雨傘來源包", path: "materials/yaml/example-red-umbrella/00-source-pack.example.yaml" },
    { label: "範例 01｜紅雨傘故事內容", path: "materials/yaml/example-red-umbrella/01-content.example.yaml" },
    { label: "範例 02｜紅雨傘視覺系統", path: "materials/yaml/example-red-umbrella/02-visual-system.example.yaml" },
    { label: "範例 03｜紅雨傘限制", path: "materials/yaml/example-red-umbrella/03-culture-guardrails.example.yaml" },
    { label: "範例 04A｜封面生圖設定", path: "materials/yaml/example-red-umbrella/04a-cover-drawing-job.example.yaml" },
    { label: "範例 04B｜第 1 頁生圖設定", path: "materials/yaml/example-red-umbrella/04b-page-01-drawing-job.example.yaml" },
    { label: "範例 04C｜第 5 頁修正版設定", path: "materials/yaml/example-red-umbrella/04c-page-05-drawing-job.example.yaml" },
    { label: "範例 05｜紅雨傘驗收規則", path: "materials/yaml/example-red-umbrella/05-criterion.example.yaml" },
    { label: "範例 06｜紅雨傘製作紀錄", path: "materials/yaml/example-red-umbrella/06-production-log.example.yaml" }
  ];

  const state = {
    prompts: [],
    promptGroup: "teacher",
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
    const headingPattern = /^##\s+(N-CLASS|N\d{2}|T\d{2}|C\d{2})｜([^\r\n]+)$/gm;
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
        group: match[1].startsWith("T") ? "teacher" : match[1].startsWith("N") ? "notebook" : "chat",
        summary: promptDescriptions[match[1]] || firstParagraph || "複製後，把〔 〕中的示例換成你的資料。",
        content: codeMatch ? codeMatch[1].trim() : "這一節沒有可直接複製的提示詞，請開啟完整提示詞檔查看說明。"
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
      status: document.getElementById("prompt-status"),
      teacherSelect: document.getElementById("teacher-example-select"),
      teacherPicker: document.querySelector(".teacher-example-picker"),
      index: document.getElementById("prompt-index")
    };
  }

  function showPrompt(prompt) {
    const elements = promptElements();
    state.activePrompt = prompt;
    elements.code.textContent = promptGroupLabels[prompt.group] || "提示詞助手";
    elements.title.textContent = prompt.title;
    elements.summary.textContent = prompt.summary;
    elements.content.textContent = prompt.content;
    elements.copy.disabled = false;
    elements.status.textContent = "";
    if (elements.teacherSelect) {
      elements.teacherSelect.value = prompt.group === "teacher" ? prompt.code : "";
    }
    renderPromptList();
  }

  function setPromptGroup(group, preferredCode) {
    const elements = promptElements();
    state.promptGroup = group;
    document.querySelectorAll("[data-prompt-group]").forEach((item) => {
      const selected = item.dataset.promptGroup === group;
      item.classList.toggle("is-active", selected);
      item.setAttribute("aria-selected", selected ? "true" : "false");
    });
    elements.search.value = "";
    if (elements.teacherPicker) elements.teacherPicker.hidden = group !== "teacher";
    if (elements.index) elements.index.open = group !== "teacher";
    const preferred = preferredCode
      ? state.prompts.find((prompt) => prompt.code === preferredCode && prompt.group === group)
      : null;
    const first = preferred || state.prompts.find((prompt) => prompt.group === group);
    if (first) showPrompt(first);
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
      const codes = state.prompts.map((prompt) => prompt.code);
      const requiredCodes = ["N-CLASS", "N00", "N08", "T01", "T10", "T11", "T20", "C00", "C09"];
      if (new Set(codes).size !== codes.length) throw new Error("提示詞代碼重複");
      if (requiredCodes.some((code) => !codes.includes(code))) throw new Error("提示詞庫缺少必要任務");
      setPromptGroup("teacher", "T01");
    } catch (error) {
      elements.code.textContent = "載入失敗";
      elements.title.textContent = "提示詞庫暫時無法顯示";
      elements.summary.textContent = "請直接開啟完整提示詞檔，或稍後重新整理頁面。";
      elements.content.textContent = "提示詞目前無法載入。";
      elements.status.textContent = "下方仍可開啟完整提示詞檔。";
    }

    document.querySelectorAll("[data-prompt-group]").forEach((tab) => {
      tab.addEventListener("click", () => {
        setPromptGroup(tab.dataset.promptGroup);
      });
    });

    if (elements.teacherSelect) {
      elements.teacherSelect.addEventListener("change", () => {
        if (elements.teacherSelect.value) setPromptGroup("teacher", elements.teacherSelect.value);
      });
    }

    elements.search.addEventListener("input", renderPromptList);
    elements.copy.addEventListener("click", async () => {
      if (!state.activePrompt) return;
      try {
        await copyText(state.activePrompt.content);
        elements.status.textContent = "已複製這組提示詞。記得替換〔 〕中的內容。";
      } catch (error) {
        elements.status.textContent = "瀏覽器無法自動複製，請點進提示詞內容區後手動全選。";
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
      content.textContent = "這份 YAML 目前無法載入。";
      status.textContent = "你仍可使用上方的下載連結開啟檔案。";
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

  function buildPosterStyleYaml(style) {
    const quote = (value) => JSON.stringify(value);
    const paletteLines = style.palette.map((color) => `    - ${quote(color)}`);

    return [
      "version: 1",
      "purpose: \"海報視覺換風格\"",
      "content_lock:",
      "  keep_title_exact: true",
      "  keep_body_text_exact: true",
      "  keep_numbers_exact: true",
      "  keep_required_marks: true",
      "  change_only:",
      "    - \"layout\"",
      "    - \"palette\"",
      "    - \"typography\"",
      "    - \"illustration_style\"",
      "    - \"texture\"",
      "visual_style:",
      `  name: ${quote(style.name)}`,
      `  mood: ${quote(style.mood)}`,
      "  palette:",
      ...paletteLines,
      `  typography: ${quote(style.typography)}`,
      `  illustration: ${quote(style.illustration)}`,
      `  layout: ${quote(style.layout)}`,
      `  avoid: ${quote(style.avoid)}`,
      "review:",
      "  reference_image: \"只使用有權使用的參考圖\"",
      "  indigenous_language: \"族語需由老師逐字核對\"",
      "  cultural_elements: \"傳統服飾、圖紋與器物需由熟悉該族文化者確認\""
    ].join("\n");
  }

  function initStyleSwitcher() {
    const promptIds = {
      "notebook-text": "notebook-text-style-prompt",
      "notebook-reference": "notebook-reference-style-prompt"
    };

    Object.entries(presentationStylePrompts).forEach(([key, prompt]) => {
      const content = document.getElementById(promptIds[key]);
      const button = document.querySelector(`[data-copy-style-prompt="${key}"]`);
      const status = document.querySelector(`[data-style-status="${key}"]`);
      if (!content || !button || !status) return;

      content.textContent = prompt;
      button.addEventListener("click", async () => {
        button.disabled = true;
        status.textContent = "正在複製…";
        try {
          await copyText(prompt);
          status.textContent = "已複製。貼到 NotebookLM 的簡報自訂欄，再替換〔 〕中的內容。";
        } catch (error) {
          status.textContent = "瀏覽器無法自動複製，請點進提示詞內容區後手動全選。";
        } finally {
          button.disabled = false;
        }
      });
    });

    const select = document.getElementById("poster-style-select");
    const content = document.getElementById("poster-style-content");
    const copyButton = document.getElementById("copy-poster-style");
    const status = document.getElementById("poster-style-status");
    if (!select || !content || !copyButton || !status) return;

    posterStyles.forEach((style, index) => {
      const option = document.createElement("option");
      option.value = String(index);
      option.textContent = style.name;
      select.appendChild(option);
    });

    const showStyle = () => {
      const style = posterStyles[Number(select.value)];
      content.textContent = buildPosterStyleYaml(style);
      status.textContent = `目前選擇「${style.name}」。內容文字會維持不變。`;
    };

    select.addEventListener("change", showStyle);
    copyButton.addEventListener("click", async () => {
      const style = posterStyles[Number(select.value)];
      copyButton.disabled = true;
      status.textContent = "正在複製…";
      try {
        await copyText(buildPosterStyleYaml(style));
        status.textContent = `已複製「${style.name}」YAML。`;
      } catch (error) {
        status.textContent = "瀏覽器無法自動複製，請點進 YAML 內容區後手動全選。";
      } finally {
        copyButton.disabled = false;
      }
    });

    showStyle();
  }

  function openToolFromHash() {
    const target = document.querySelector(window.location.hash);
    if (target instanceof HTMLDetailsElement) target.open = true;
  }

  function initToolDrawers() {
    document.querySelectorAll("[data-open-tool]").forEach((link) => {
      link.addEventListener("click", () => {
        const drawer = document.getElementById(link.dataset.openTool);
        if (drawer instanceof HTMLDetailsElement) drawer.open = true;

        const promptCode = link.dataset.promptCode;
        if (promptCode && state.prompts.length) setPromptGroup("teacher", promptCode);
      });
    });

    window.addEventListener("hashchange", openToolFromHash);
    if (window.location.hash) openToolFromHash();
  }

  initToolDrawers();
  initPrompts();
  initStyleSwitcher();
  initYaml();
})();
