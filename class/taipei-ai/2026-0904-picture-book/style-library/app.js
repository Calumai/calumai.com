(function startStyleLibrary() {
  "use strict";

  const completeStyles = [
    { category: "完整畫風", title: "溫暖手繪水彩", prompt: "warm hand-painted watercolor picture-book illustration, soft natural light, subtle paper texture", description: "適合故事繪本、情緒場景與柔和人物互動。" },
    { category: "完整畫風", title: "明亮扁平插畫", prompt: "bright flat illustration, clean color blocks, friendly children's editorial style", description: "適合簡報、學習單與資訊清楚的教學圖片。" },
    { category: "完整畫風", title: "柔和蠟筆童趣", prompt: "soft crayon illustration, simple hand-drawn lines, warm playful colors", description: "適合低年級教材、親子活動與童趣故事。" },
    { category: "完整畫風", title: "圓潤可愛卡通", prompt: "cute rounded cartoon illustration, expressive characters, bright balanced colors", description: "適合角色貼圖、班級活動與輕鬆主題。" },
    { category: "完整畫風", title: "北歐幾何童書", prompt: "Nordic geometric children's book illustration, simple composition, muted colors", description: "適合乾淨、現代且留白充足的教材畫面。" },
    { category: "完整畫風", title: "粉彩鉛筆童書", prompt: "pastel colored-pencil children's book illustration, delicate strokes, gentle negative space", description: "適合細膩角色、生活故事與安靜閱讀情境。" },
    { category: "完整畫風", title: "分層紙雕世界", prompt: "layered paper-cut illustration, tactile depth, soft cast shadows, clear foreground and background", description: "適合自然主題、故事場景與立體展示感。" },
    { category: "完整畫風", title: "鮮明剪紙動畫", prompt: "bold paper-cut animation style, folk-story atmosphere, crisp colorful shapes", description: "適合節慶故事與造型鮮明的情節畫面。" },
    { category: "完整畫風", title: "刺繡布料手作", prompt: "embroidered line illustration, visible thread and fabric texture, handmade warmth", description: "適合工藝主題與需要溫度的教學視覺。" },
    { category: "完整畫風", title: "清線冒險漫畫", prompt: "clear-line adventure comic illustration, dynamic poses, crisp outlines, readable action", description: "適合漫畫分鏡、動作場面與角色冒險。" },
    { category: "完整畫風", title: "知識型簡報插畫", prompt: "educational presentation illustration, flat icons, clear information zones, restrained palette", description: "適合課堂簡報、步驟圖與概念說明。" },
    { category: "完整畫風", title: "兒童科普圖鑑", prompt: "children's science field-guide illustration, observational view, accurate visible details", description: "適合動植物、器物與觀察型教材。" },
    { category: "完整畫風", title: "復古像素遊戲", prompt: "low-resolution pixel art, retro game mood, crisp grid-based color blocks", description: "適合闖關素材、遊戲介面與懷舊主題。" },
    { category: "完整畫風", title: "壓克力塗鴉", prompt: "fluorescent acrylic graffiti illustration, energetic brushwork, bold high-contrast colors", description: "適合活動海報、青春主題與強烈視覺焦點。" }
  ];

  const styleModifiers = [
    ["攝影", "數位單眼質感", "DSLR photography style"],
    ["攝影", "電影劇照", "cinematic still photography"],
    ["攝影", "微距細節", "macro lens photography"],
    ["攝影", "柔和光線", "soft diffused light"],
    ["角度效果", "臉部特寫", "face close-up"],
    ["角度效果", "全身畫面", "full body shot"],
    ["角度效果", "鳥瞰視角", "bird's-eye view"],
    ["角度效果", "低角度仰拍", "low-angle view"],
    ["角度效果", "背景散景", "shallow depth of field, soft bokeh"],
    ["繪畫媒材", "鉛筆畫", "pencil drawing"],
    ["繪畫媒材", "炭筆畫", "charcoal drawing"],
    ["繪畫媒材", "水彩畫", "watercolor painting"],
    ["繪畫媒材", "油畫", "oil painting"],
    ["繪畫媒材", "水墨畫", "ink wash painting"],
    ["繪畫媒材", "乾淨外框", "clean outline drawing"],
    ["材料質感", "紙雕藝術", "layered paper art"],
    ["材料質感", "剪紙藝術", "paper-cut art"],
    ["材料質感", "摺紙藝術", "origami art"],
    ["材料質感", "彩繪玻璃", "stained-glass texture"],
    ["材料質感", "馬賽克拼貼", "mosaic collage"],
    ["材料質感", "兒童黏土", "soft modeling-clay art"],
    ["材料質感", "積木模型", "interlocking toy-brick model"],
    ["材料質感", "羊毛氈娃娃", "felt doll craft"],
    ["動畫漫畫", "2D 卡通", "2D cartoon illustration"],
    ["動畫漫畫", "3D 卡通", "3D cartoon rendering"],
    ["動畫漫畫", "2D 動畫", "2D animation style"],
    ["動畫漫畫", "美式漫畫", "American comic-book illustration"],
    ["動畫漫畫", "日式漫畫", "manga illustration"],
    ["藝術流派", "文藝復興", "Renaissance painting style"],
    ["藝術流派", "巴洛克", "Baroque art style"],
    ["藝術流派", "印象派", "Impressionist painting style"],
    ["藝術流派", "超現實主義", "Surrealist art style"],
    ["藝術流派", "立體主義", "Cubist art style"],
    ["藝術流派", "極簡主義", "minimalist art style"],
    ["藝術流派", "海報藝術", "poster art style"],
    ["藝術流派", "街頭藝術", "street-art illustration"],
    ["藝術流派", "浮世繪", "ukiyo-e print style"],
    ["特色風格", "像素點陣畫", "pixel art"],
    ["特色風格", "資訊圖表", "infographic illustration"],
    ["特色風格", "低多邊形", "low-poly illustration"],
    ["特色風格", "物件整齊排列", "knolling composition"],
    ["特色風格", "示意圖", "diagrammatic drawing"],
    ["特色風格", "吉祥物標誌", "mascot logo illustration"]
  ];

  const descriptions = {
    "攝影": "調整真實感、鏡頭質感與光線氛圍。",
    "角度效果": "控制觀看距離、鏡位與畫面焦點。",
    "繪畫媒材": "指定筆觸、顏料與紙面表現。",
    "材料質感": "讓畫面看起來像實體手作材料。",
    "動畫漫畫": "控制角色造型、線條與動作節奏。",
    "藝術流派": "加入明確的構成、色彩與藝術語氣。",
    "特色風格": "適合教材、圖解、遊戲與特殊版面。"
  };

  const patterns = {
    "完整畫風": "paper",
    "攝影": "photo",
    "角度效果": "minimal",
    "繪畫媒材": "ink",
    "材料質感": "glass",
    "動畫漫畫": "comic",
    "藝術流派": "paper",
    "特色風格": "pixel"
  };

  const completePatterns = [
    "ink", "minimal", "paper", "comic", "minimal", "ink", "paper",
    "comic", "glass", "comic", "minimal", "ink", "pixel", "glass"
  ];
  const previewPositions = ["tl", "tr", "bl", "br"];

  const previewGroups = [
    [1, 4, "presets-01-04.webp"],
    [5, 8, "presets-05-08.webp"],
    [9, 12, "presets-09-12.webp"],
    [13, 14, "presets-13-14-plus.webp"],
    [15, 18, "modifiers-15-18.webp"],
    [19, 22, "modifiers-19-22.webp"],
    [23, 26, "modifiers-23-26.webp"],
    [27, 30, "modifiers-27-30.webp"],
    [31, 34, "modifiers-31-34.webp"],
    [35, 38, "modifiers-35-38.webp"],
    [39, 42, "modifiers-39-42.webp"],
    [43, 46, "modifiers-43-46.webp"],
    [47, 50, "modifiers-47-50.webp"],
    [51, 54, "modifiers-51-54.webp"],
    [55, 57, "modifiers-55-57.webp"]
  ];

  function previewFor(index) {
    const number = index + 1;
    const group = previewGroups.find(([start, end]) => number >= start && number <= end);
    if (!group) return {};
    const [start, , previewAsset] = group;
    return {
      previewAsset,
      previewClass: `preview-asset-${previewAsset.replace(".webp", "")}`,
      previewPosition: previewPositions[number - start]
    };
  }

  const catalog = completeStyles.concat(styleModifiers.map(([category, title, prompt]) => ({
    category,
    title,
    prompt,
    description: descriptions[category]
  }))).map((style, index) => {
    const preview = previewFor(index);
    return {
      ...style,
      ...preview,
      id: `style-${index + 1}`,
      paletteIndex: index % 8,
      pattern: style.category === "完整畫風" ? completePatterns[index] : patterns[style.category],
      isPreset: style.category === "完整畫風"
    };
  });

  const byId = (id) => document.getElementById(id);
  const grid = byId("style-grid");
  const search = byId("style-search");
  const categorySelect = byId("style-category");
  const categoryStrip = byId("category-strip");
  const resultCount = byId("result-count");
  const emptyState = byId("empty-state");
  const selectionTags = byId("selection-tags");
  const selectionCount = byId("selection-count");
  const selectionEmpty = byId("selection-empty");
  const combinedPrompt = byId("combined-prompt");
  const copyCombined = byId("copy-combined");
  const clearSelection = byId("clear-selection");
  const copyStatus = byId("copy-status");
  const selected = new Map();
  let activeCategory = "全部";

  function normalized(value) {
    return String(value || "").normalize("NFKC").toLocaleLowerCase("zh-Hant").trim();
  }

  async function copyText(value) {
    if (navigator.clipboard && globalThis.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return;
    }
    const helper = document.createElement("textarea");
    helper.value = value;
    helper.setAttribute("readonly", "");
    helper.className = "visually-hidden";
    document.body.appendChild(helper);
    helper.select();
    const copied = document.execCommand("copy");
    helper.remove();
    if (!copied) throw new Error("COPY_NOT_ALLOWED");
  }

  function announce(message) {
    copyStatus.textContent = message;
  }

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function filteredCatalog() {
    const query = normalized(search.value);
    return catalog.filter((style) => {
      const matchesCategory = activeCategory === "全部" || style.category === activeCategory;
      const haystack = normalized(`${style.title} ${style.prompt} ${style.description} ${style.category}`);
      return matchesCategory && (!query || haystack.includes(query));
    });
  }

  function updateCategoryControls() {
    categorySelect.value = activeCategory;
    categoryStrip.querySelectorAll("button").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.category === activeCategory));
    });
  }

  function setCategory(category) {
    activeCategory = category;
    updateCategoryControls();
    renderCatalog();
  }

  function updateSelection() {
    selectionTags.replaceChildren();
    const values = Array.from(selected.values());
    selectionCount.textContent = values.length ? `已選 ${values.length} 個` : "尚未選擇";
    selectionEmpty.hidden = values.length > 0;
    combinedPrompt.hidden = values.length === 0;
    combinedPrompt.value = values.map((style) => style.prompt).join(", ");
    copyCombined.disabled = values.length === 0;
    clearSelection.disabled = values.length === 0;

    values.forEach((style) => {
      const tag = makeElement("button", "selection-tag", `${style.title}  移除`);
      tag.type = "button";
      tag.addEventListener("click", () => {
        selected.delete(style.id);
        announce(`已移除「${style.title}」。`);
        updateSelection();
        updateCardStates();
      });
      selectionTags.appendChild(tag);
    });
  }

  function toggleSelection(style) {
    if (selected.has(style.id)) {
      selected.delete(style.id);
      announce(`已移除「${style.title}」。`);
    } else if (selected.size >= 3) {
      announce("先保留三個風格就好。請移除一個再加入新的風格。");
      return;
    } else {
      selected.set(style.id, style);
      announce(`已加入「${style.title}」。`);
    }
    updateSelection();
    updateCardStates();
  }

  function updateCardStates() {
    grid.querySelectorAll("[data-style-id]").forEach((card) => {
      const isSelected = selected.has(card.dataset.styleId);
      card.classList.toggle("is-selected", isSelected);
      const button = card.querySelector(".card-button.add");
      button.textContent = isSelected ? "已加入" : "加入組合";
      button.setAttribute("aria-pressed", String(isSelected));
    });
  }

  function createStyleCard(style) {
    const card = makeElement("article", "style-card");
    card.dataset.styleId = style.id;
    card.dataset.pattern = style.pattern || "minimal";
    card.classList.add(style.isPreset ? "is-preset" : "is-modifier");
    card.classList.add(`palette-${style.paletteIndex}`);
    if (selected.has(style.id)) card.classList.add("is-selected");

    const preview = makeElement("div", "style-preview");
    if (style.previewAsset) {
      preview.classList.add("has-image", style.previewClass, `preview-${style.previewPosition}`);
      preview.setAttribute("role", "img");
      preview.setAttribute("aria-label", `${style.title}示範圖`);
    } else {
      preview.setAttribute("aria-hidden", "true");
    }

    const body = makeElement("div", "style-card-body");
    body.appendChild(makeElement("p", "style-category", style.category));
    body.appendChild(makeElement("h2", "", style.title));
    body.appendChild(makeElement("p", "style-description", style.description));
    body.appendChild(makeElement("code", "style-prompt", style.prompt));

    const actions = makeElement("div", "card-actions");
    const addButton = makeElement("button", "card-button add", selected.has(style.id) ? "已加入" : "加入組合");
    addButton.type = "button";
    addButton.setAttribute("aria-pressed", String(selected.has(style.id)));
    addButton.addEventListener("click", () => toggleSelection(style));

    const copyButton = makeElement("button", "card-button", "直接複製");
    copyButton.type = "button";
    copyButton.addEventListener("click", async () => {
      try {
        await copyText(style.prompt);
        announce(`已複製「${style.title}」的英文提示詞。`);
      } catch {
        announce("瀏覽器沒有允許自動複製，請手動選取英文提示詞。");
      }
    });

    actions.append(addButton, copyButton);
    body.appendChild(actions);
    card.append(preview, body);
    return card;
  }

  function renderCatalog() {
    const styles = filteredCatalog();
    grid.replaceChildren();
    styles.forEach((style) => grid.appendChild(createStyleCard(style)));
    resultCount.textContent = `顯示 ${styles.length} 種風格，共 ${catalog.length} 種`;
    emptyState.hidden = styles.length > 0;
    grid.hidden = styles.length === 0;
  }

  const categories = ["全部", ...new Set(catalog.map((style) => style.category))];
  categories.slice(1).forEach((category) => categorySelect.add(new Option(category, category)));
  categories.forEach((category) => {
    const button = makeElement("button", "category-button", category === "全部" ? "全部風格" : category);
    button.type = "button";
    button.dataset.category = category;
    button.setAttribute("aria-pressed", String(category === activeCategory));
    button.addEventListener("click", () => setCategory(category));
    categoryStrip.appendChild(button);
  });

  search.addEventListener("input", renderCatalog);
  categorySelect.addEventListener("change", () => setCategory(categorySelect.value));
  byId("reset-search").addEventListener("click", () => {
    search.value = "";
    setCategory("全部");
    search.focus();
  });
  copyCombined.addEventListener("click", async () => {
    try {
      await copyText(combinedPrompt.value);
      announce("組合提示詞已複製，可以貼到圖片描述中。");
    } catch {
      announce("瀏覽器沒有允許自動複製，請手動選取組合提示詞。");
    }
  });
  clearSelection.addEventListener("click", () => {
    selected.clear();
    announce("已清除所有選擇。");
    updateSelection();
    updateCardStates();
  });

  updateSelection();
  renderCatalog();
})();
