(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const API_PATH = "/api/vibe-flow/boards";
  const CLIENT_ID_KEY = "vibe-coding-flow-client-id-v1";
  const API_TIMEOUT_MS = 12000;
  const NODE_META = {
    start: { typeLabel: "開始", width: 210, height: 108 },
    process: { typeLabel: "步驟", width: 220, height: 116 },
    decision: { typeLabel: "判斷", width: 240, height: 150 },
    result: { typeLabel: "成果", width: 210, height: 108 },
    note: { typeLabel: "備註", width: 212, height: 122 },
  };

  const elements = {};
  let boards = [];
  let nextCursor = null;
  let loading = false;
  let volatileClientId = null;

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    bindEvents();
    if (window.location.protocol === "file:") {
      showListError("離線檔案無法讀取公開作品，請使用 calumai.com 上線版。");
      return;
    }
    loadBoards(false).then(openBoardFromUrl);
  }

  function cacheElements() {
    [
      "visibleCount",
      "searchInput",
      "refreshButton",
      "retryButton",
      "loadingState",
      "errorState",
      "errorMessage",
      "emptyState",
      "emptyTitle",
      "emptyMessage",
      "galleryGrid",
      "loadMoreButton",
      "boardDialog",
      "dialogAuthor",
      "dialogTopic",
      "dialogMeta",
      "closeDialogButton",
      "detailLoading",
      "detailError",
      "detailSvg",
    ].forEach(function (id) {
      elements[id] = document.getElementById(id);
    });
  }

  function bindEvents() {
    elements.searchInput.addEventListener("input", renderCards);
    elements.refreshButton.addEventListener("click", function () {
      loadBoards(false);
    });
    elements.retryButton.addEventListener("click", function () {
      loadBoards(false);
    });
    elements.loadMoreButton.addEventListener("click", function () {
      loadBoards(true);
    });
    elements.closeDialogButton.addEventListener("click", closeBoardDialog);
    elements.boardDialog.addEventListener("cancel", function (event) {
      event.preventDefault();
      closeBoardDialog();
    });
  }

  async function loadBoards(append) {
    if (loading) {
      return;
    }
    loading = true;
    elements.refreshButton.disabled = true;
    elements.loadMoreButton.disabled = true;
    if (!append) {
      elements.loadingState.hidden = false;
      elements.errorState.hidden = true;
      elements.emptyState.hidden = true;
      elements.galleryGrid.replaceChildren();
      nextCursor = null;
    }

    try {
      const query = append && nextCursor ? "?cursor=" + encodeURIComponent(nextCursor) : "";
      const result = await requestJson(API_PATH + query);
      const incoming = Array.isArray(result.boards) ? result.boards.map(normalizeSummary).filter(Boolean) : [];
      boards = append ? mergeBoards(boards, incoming) : incoming;
      nextCursor = result.next_cursor ? String(result.next_cursor) : null;
      elements.loadingState.hidden = true;
      elements.errorState.hidden = true;
      renderCards();
    } catch (error) {
      if (!append) {
        boards = [];
        showListError(error.message || "請確認網路後再試一次。");
      } else {
        elements.loadMoreButton.textContent = "載入失敗，按這裡重試";
      }
    } finally {
      loading = false;
      elements.refreshButton.disabled = false;
      elements.loadMoreButton.disabled = false;
    }
  }

  function normalizeSummary(value) {
    if (!value || typeof value !== "object" || !value.id) {
      return null;
    }
    return {
      id: String(value.id).slice(0, 120),
      author_name: String(value.author_name || "匿名同學").slice(0, 24),
      topic: String(value.topic || "尚未命名的流程").slice(0, 80),
      node_count: clampCount(value.node_count),
      edge_count: clampCount(value.edge_count),
      created_at: String(value.created_at || ""),
      updated_at: String(value.updated_at || value.created_at || ""),
    };
  }

  function mergeBoards(current, incoming) {
    const map = new Map();
    current.concat(incoming).forEach(function (board) {
      map.set(board.id, board);
    });
    return Array.from(map.values());
  }

  function renderCards() {
    const query = elements.searchInput.value.trim().toLocaleLowerCase("zh-Hant");
    const filtered = boards.filter(function (board) {
      return (
        !query ||
        board.topic.toLocaleLowerCase("zh-Hant").includes(query) ||
        board.author_name.toLocaleLowerCase("zh-Hant").includes(query)
      );
    });

    elements.visibleCount.textContent = String(filtered.length);
    const fragment = document.createDocumentFragment();
    filtered.forEach(function (board) {
      fragment.appendChild(createCard(board));
    });
    elements.galleryGrid.replaceChildren(fragment);

    const isEmpty = filtered.length === 0;
    elements.emptyState.hidden = !isEmpty;
    if (isEmpty && query && boards.length > 0) {
      elements.emptyTitle.textContent = "找不到符合的作品";
      elements.emptyMessage.textContent = "換一個主題或暱稱試試看。";
    } else {
      elements.emptyTitle.textContent = "還沒有公開作品";
      elements.emptyMessage.textContent = "成為第一個把流程分享到這裡的人吧。";
    }
    elements.loadMoreButton.hidden = isEmpty || !nextCursor;
    elements.loadMoreButton.textContent = "載入更多作品";
  }

  function createCard(board) {
    const card = document.createElement("button");
    card.className = "board-card";
    card.type = "button";
    card.dataset.boardId = board.id;
    card.setAttribute("aria-label", "查看「" + board.topic + "」，作者暱稱 " + board.author_name);

    const preview = document.createElement("span");
    preview.className = "card-preview";
    preview.setAttribute("aria-hidden", "true");
    const line = document.createElement("span");
    line.className = "card-line";
    for (let index = 0; index < 3; index += 1) {
      const node = document.createElement("span");
      node.className = "card-node";
      preview.appendChild(node);
    }
    preview.appendChild(line);

    const copy = document.createElement("span");
    copy.className = "card-copy";
    const topic = document.createElement("h3");
    topic.textContent = board.topic;
    const author = document.createElement("span");
    author.className = "card-author";
    author.textContent = "暱稱：" + board.author_name;
    const meta = document.createElement("span");
    meta.className = "card-meta";
    meta.textContent =
      board.node_count + " 個節點 · " + board.edge_count + " 條連線 · " + formatDate(board.updated_at);
    copy.append(topic, author, meta);
    card.append(preview, copy);
    card.addEventListener("click", function () {
      openBoard(board.id);
    });
    return card;
  }

  async function openBoard(boardId) {
    elements.dialogAuthor.textContent = "公開作品";
    elements.dialogTopic.textContent = "讀取作品中";
    elements.dialogMeta.textContent = "";
    elements.detailLoading.hidden = false;
    elements.detailError.hidden = true;
    elements.detailSvg.setAttribute("hidden", "");
    elements.detailSvg.replaceChildren();
    if (!elements.boardDialog.open) {
      elements.boardDialog.showModal();
    }
    updateBoardQuery(boardId);

    try {
      const result = await requestJson(API_PATH + "/" + encodeURIComponent(boardId));
      if (!result.board || typeof result.board !== "object") {
        throw new Error("伺服器沒有回傳完整作品。");
      }
      const board = normalizeDetail(result.board);
      elements.dialogAuthor.textContent = "暱稱：" + board.author_name;
      elements.dialogTopic.textContent = board.topic;
      elements.dialogMeta.textContent =
        board.nodes.length + " 個節點 · " + board.edges.length + " 條連線 · 更新於 " + formatDate(board.updated_at);
      elements.detailSvg.setAttribute("aria-label", board.topic + "，作者暱稱 " + board.author_name);
      renderDiagram(elements.detailSvg, board);
      elements.detailLoading.hidden = true;
      elements.detailSvg.removeAttribute("hidden");
    } catch (error) {
      elements.detailLoading.hidden = true;
      elements.detailError.textContent = error.message || "完整流程暫時無法載入。";
      elements.detailError.hidden = false;
    }
  }

  function normalizeDetail(value) {
    const nodes = Array.isArray(value.nodes)
      ? value.nodes.slice(0, 100).map(normalizeNode).filter(Boolean)
      : [];
    const nodeIds = new Set(nodes.map(function (node) { return node.id; }));
    const edges = Array.isArray(value.edges)
      ? value.edges.slice(0, 240).map(normalizeEdge).filter(function (edge) {
          return edge && nodeIds.has(edge.from) && nodeIds.has(edge.to) && edge.from !== edge.to;
        })
      : [];
    return {
      id: String(value.id || ""),
      author_name: String(value.author_name || "匿名同學").slice(0, 24),
      topic: String(value.topic || "尚未命名的流程").slice(0, 80),
      nodes: nodes,
      edges: edges,
      updated_at: String(value.updated_at || value.created_at || ""),
    };
  }

  function normalizeNode(value) {
    if (!value || !value.id || !Number.isFinite(Number(value.x)) || !Number.isFinite(Number(value.y))) {
      return null;
    }
    const type = Object.prototype.hasOwnProperty.call(NODE_META, value.type) ? value.type : "process";
    return {
      id: String(value.id).slice(0, 120),
      type: type,
      label: String(value.label || "未命名節點").slice(0, 50),
      detail: String(value.detail || "").slice(0, 120),
      x: clamp(Number(value.x), -100000, 100000),
      y: clamp(Number(value.y), -100000, 100000),
    };
  }

  function normalizeEdge(value) {
    if (!value || !value.id || !value.from || !value.to) {
      return null;
    }
    return {
      id: String(value.id).slice(0, 120),
      from: String(value.from).slice(0, 120),
      to: String(value.to).slice(0, 120),
      label: String(value.label || "").slice(0, 24),
    };
  }

  function closeBoardDialog() {
    elements.boardDialog.close();
    const url = new URL(window.location.href);
    url.searchParams.delete("board");
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

  function openBoardFromUrl() {
    const boardId = new URLSearchParams(window.location.search).get("board");
    if (boardId && boardId.length <= 120) {
      openBoard(boardId);
    }
  }

  function updateBoardQuery(boardId) {
    const url = new URL(window.location.href);
    url.searchParams.set("board", boardId);
    window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  }

  function showListError(message) {
    elements.loadingState.hidden = true;
    elements.errorMessage.textContent = message;
    elements.errorState.hidden = false;
    elements.emptyState.hidden = true;
    elements.loadMoreButton.hidden = true;
    elements.visibleCount.textContent = "0";
  }

  async function requestJson(path) {
    const controller = new AbortController();
    const timeout = window.setTimeout(function () {
      controller.abort();
    }, API_TIMEOUT_MS);
    try {
      const response = await fetch(path, {
        headers: { "X-Vibe-Client": getClientId() },
        signal: controller.signal,
      });
      let body = null;
      try {
        body = await response.json();
      } catch (error) {
        body = null;
      }
      if (!response.ok || !body || body.ok === false) {
        const message =
          body && body.error && body.error.message
            ? String(body.error.message)
            : "作品牆暫時無法回應（HTTP " + response.status + "）。";
        throw new Error(message);
      }
      return body;
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("讀取逾時，請確認網路後重試。");
      }
      if (error instanceof TypeError) {
        throw new Error("無法連上作品牆，請確認網路後重試。");
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function getClientId() {
    if (volatileClientId) {
      return volatileClientId;
    }
    try {
      const existing = window.localStorage.getItem(CLIENT_ID_KEY);
      if (existing && /^[0-9a-f-]{36}$/iu.test(existing)) {
        volatileClientId = existing;
        return volatileClientId;
      }
      volatileClientId = createUuid();
      window.localStorage.setItem(CLIENT_ID_KEY, volatileClientId);
      return volatileClientId;
    } catch (error) {
      volatileClientId = createUuid();
      return volatileClientId;
    }
  }

  function createUuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    if (!window.crypto || typeof window.crypto.getRandomValues !== "function") {
      throw new Error("這個瀏覽器不支援安全連線，請改用最新版瀏覽器。");
    }
    const bytes = new Uint8Array(16);
    window.crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, function (value) {
      return value.toString(16).padStart(2, "0");
    }).join("");
    return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join("-");
  }

  function renderDiagram(svg, board) {
    svg.replaceChildren();
    const bounds = graphBounds(board.nodes);
    const padding = 74;
    const box = {
      x: bounds.minX - padding,
      y: bounds.minY - padding,
      width: Math.max(400, bounds.width + padding * 2),
      height: Math.max(280, bounds.height + padding * 2),
    };
    svg.setAttribute("viewBox", [box.x, box.y, box.width, box.height].join(" "));
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
    const defs = svgElement("defs");
    const marker = svgElement("marker", {
      id: "galleryArrow",
      viewBox: "0 0 10 10",
      refX: "8.6",
      refY: "5",
      markerWidth: "7",
      markerHeight: "7",
      orient: "auto-start-reverse",
    });
    marker.appendChild(svgElement("path", { d: "M 0 0 L 10 5 L 0 10 z", fill: "#59635d" }));
    defs.appendChild(marker);
    svg.appendChild(defs);
    svg.appendChild(svgElement("rect", { x: box.x, y: box.y, width: box.width, height: box.height, fill: "#fbfbf8" }));

    const nodeMap = new Map(board.nodes.map(function (node) { return [node.id, node]; }));
    const edgeLayer = svgElement("g");
    board.edges.forEach(function (edge) {
      const geometry = edgeGeometry(edge, nodeMap);
      if (!geometry) {
        return;
      }
      const group = svgElement("g", { class: "flow-edge" });
      group.appendChild(svgElement("path", {
        class: "edge-line",
        d: geometry.path,
        "marker-end": "url(#galleryArrow)",
      }));
      if (edge.label) {
        const width = Math.max(34, textUnits(edge.label) * 7.2 + 18);
        group.appendChild(svgElement("rect", {
          class: "edge-label-bg",
          x: geometry.mid.x - width / 2,
          y: geometry.mid.y - 13,
          width: width,
          height: 26,
          rx: 8,
        }));
        const text = svgElement("text", {
          class: "edge-label-text",
          x: geometry.mid.x,
          y: geometry.mid.y + 4,
        });
        text.textContent = edge.label;
        group.appendChild(text);
      }
      edgeLayer.appendChild(group);
    });
    svg.appendChild(edgeLayer);

    const nodeLayer = svgElement("g");
    board.nodes.forEach(function (node) {
      nodeLayer.appendChild(renderNode(node));
    });
    svg.appendChild(nodeLayer);
  }

  function renderNode(node) {
    const meta = NODE_META[node.type];
    const group = svgElement("g", {
      class: "flow-node",
      transform: "translate(" + node.x + " " + node.y + ")",
      "data-node-type": node.type,
    });
    group.appendChild(nodeShape(node, "node-shadow"));
    group.appendChild(nodeShape(node, "node-shape"));
    if (node.type === "note") {
      group.appendChild(svgElement("path", {
        d: "M 82 61 L 82 38 L 106 38",
        fill: "none",
        stroke: "#4b554f",
        "stroke-width": 2,
      }));
    }
    const layout = nodeTextLayout(node);
    const typeText = svgElement("text", { class: "node-type-text", x: 0, y: layout.typeY });
    typeText.textContent = meta.typeLabel;
    group.appendChild(typeText);
    group.appendChild(multilineText(layout.labelLines, "node-label-text", layout.labelStartY, layout.labelLineHeight));
    if (layout.detailLines.length) {
      group.appendChild(multilineText(layout.detailLines, "node-detail-text", layout.detailStartY, layout.detailLineHeight));
    }
    return group;
  }

  function nodeShape(node, className) {
    const meta = NODE_META[node.type];
    const halfWidth = meta.width / 2;
    const halfHeight = meta.height / 2;
    if (node.type === "decision") {
      return svgElement("polygon", {
        class: className,
        points: "0," + -halfHeight + " " + halfWidth + ",0 0," + halfHeight + " " + -halfWidth + ",0",
      });
    }
    if (node.type === "note") {
      return svgElement("polygon", {
        class: className,
        points:
          -halfWidth + "," + -halfHeight + " " +
          (halfWidth - 24) + "," + -halfHeight + " " +
          halfWidth + "," + (-halfHeight + 24) + " " +
          halfWidth + "," + halfHeight + " " +
          -halfWidth + "," + halfHeight,
      });
    }
    const radius = node.type === "start" || node.type === "result" ? halfHeight : 14;
    return svgElement("rect", {
      class: className,
      x: -halfWidth,
      y: -halfHeight,
      width: meta.width,
      height: meta.height,
      rx: radius,
      ry: radius,
    });
  }

  function nodeTextLayout(node) {
    const meta = NODE_META[node.type];
    const compact = node.type === "start" || node.type === "result";
    const decision = node.type === "decision";
    const labelLines = wrapText(node.label, decision ? 13 : compact ? 15 : 16, 2);
    const detailLines = node.detail
      ? wrapText(node.detail, decision ? 15 : compact ? 18 : 19, compact || decision ? 1 : 2)
      : [];
    const labelLineHeight = compact ? 18 : 20;
    const labelStartY = detailLines.length
      ? -9 - (labelLines.length - 1) * (labelLineHeight / 2)
      : 5 - (labelLines.length - 1) * (labelLineHeight / 2);
    return {
      typeY: -meta.height / 2 + (compact ? 20 : 22),
      labelLines: labelLines,
      detailLines: detailLines,
      labelStartY: labelStartY,
      labelLineHeight: labelLineHeight,
      detailStartY: labelStartY + (labelLines.length - 1) * labelLineHeight + 22,
      detailLineHeight: 15,
    };
  }

  function multilineText(lines, className, startY, lineHeight) {
    const text = svgElement("text", { class: className, x: 0, y: startY });
    lines.forEach(function (line, index) {
      const tspan = svgElement("tspan", { x: 0, y: startY + index * lineHeight });
      tspan.textContent = line;
      text.appendChild(tspan);
    });
    return text;
  }

  function edgeGeometry(edge, nodeMap) {
    const from = nodeMap.get(edge.from);
    const to = nodeMap.get(edge.to);
    if (!from || !to) {
      return null;
    }
    const start = anchorToward(from, to);
    const end = anchorToward(to, from);
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    let c1;
    let c2;
    if (Math.abs(dx) >= Math.abs(dy)) {
      const direction = dx >= 0 ? 1 : -1;
      const bend = Math.max(70, Math.abs(dx) * 0.44);
      c1 = { x: start.x + direction * bend, y: start.y };
      c2 = { x: end.x - direction * bend, y: end.y };
    } else {
      const direction = dy >= 0 ? 1 : -1;
      const bend = Math.max(70, Math.abs(dy) * 0.44);
      c1 = { x: start.x, y: start.y + direction * bend };
      c2 = { x: end.x, y: end.y - direction * bend };
    }
    return {
      path: "M " + round(start.x) + " " + round(start.y) + " C " + round(c1.x) + " " + round(c1.y) + ", " + round(c2.x) + " " + round(c2.y) + ", " + round(end.x) + " " + round(end.y),
      mid: cubicPoint(start, c1, c2, end, 0.5),
    };
  }

  function anchorToward(node, target) {
    const meta = NODE_META[node.type];
    const halfWidth = meta.width / 2;
    const halfHeight = meta.height / 2;
    const dx = target.x - node.x;
    const dy = target.y - node.y;
    if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) {
      return { x: node.x + halfWidth, y: node.y };
    }
    const scale = node.type === "decision"
      ? 1 / (Math.abs(dx) / halfWidth + Math.abs(dy) / halfHeight)
      : Math.min(
          Math.abs(dx) < 0.001 ? Infinity : halfWidth / Math.abs(dx),
          Math.abs(dy) < 0.001 ? Infinity : halfHeight / Math.abs(dy)
        );
    return { x: node.x + dx * scale, y: node.y + dy * scale };
  }

  function graphBounds(nodes) {
    if (!nodes.length) {
      return { minX: 0, minY: 0, width: 1000, height: 620 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    nodes.forEach(function (node) {
      const meta = NODE_META[node.type];
      minX = Math.min(minX, node.x - meta.width / 2);
      maxX = Math.max(maxX, node.x + meta.width / 2);
      minY = Math.min(minY, node.y - meta.height / 2);
      maxY = Math.max(maxY, node.y + meta.height / 2);
    });
    return { minX: minX, minY: minY, width: maxX - minX, height: maxY - minY };
  }

  function wrapText(value, maxUnits, maxLines) {
    const characters = Array.from(String(value || ""));
    const lines = [];
    let line = "";
    let units = 0;
    characters.forEach(function (character) {
      const nextUnits = characterUnits(character);
      if (line && units + nextUnits > maxUnits && lines.length < maxLines - 1) {
        lines.push(line.trim());
        line = character;
        units = nextUnits;
      } else {
        line += character;
        units += nextUnits;
      }
    });
    if (line || !lines.length) {
      lines.push(line.trim());
    }
    if (lines.length === maxLines && textUnits(lines[maxLines - 1]) > maxUnits + 1) {
      let last = lines[maxLines - 1];
      while (last.length > 1 && textUnits(last + "…") > maxUnits) {
        last = Array.from(last).slice(0, -1).join("");
      }
      lines[maxLines - 1] = last + "…";
    }
    return lines.slice(0, maxLines);
  }

  function characterUnits(character) {
    if (/\s/u.test(character)) return 0.35;
    if (/^[\u0000-\u00ff]$/u.test(character)) return 0.56;
    return 1;
  }

  function textUnits(value) {
    return Array.from(String(value || "")).reduce(function (sum, character) {
      return sum + characterUnits(character);
    }, 0);
  }

  function cubicPoint(a, b, c, d, progress) {
    const remain = 1 - progress;
    return {
      x: remain * remain * remain * a.x + 3 * remain * remain * progress * b.x + 3 * remain * progress * progress * c.x + progress * progress * progress * d.x,
      y: remain * remain * remain * a.y + 3 * remain * remain * progress * b.y + 3 * remain * progress * progress * c.y + progress * progress * progress * d.y,
    };
  }

  function svgElement(name, attributes) {
    const element = document.createElementNS(SVG_NS, name);
    Object.entries(attributes || {}).forEach(function (entry) {
      element.setAttribute(entry[0], String(entry[1]));
    });
    return element;
  }

  function formatDate(value) {
    const date = new Date(value);
    if (!value || Number.isNaN(date.getTime())) {
      return "剛剛更新";
    }
    return new Intl.DateTimeFormat("zh-TW", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function clampCount(value) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.max(0, Math.min(999, Math.floor(number))) : 0;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function round(value) {
    return Math.round(value * 100) / 100;
  }
})();
