(function () {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const STORAGE_KEY = "vibe-coding-flow-whiteboard-v1";
  const SHARE_IDENTITY_KEY = "vibe-coding-flow-share-identity-v1";
  const CLIENT_ID_KEY = "vibe-coding-flow-client-id-v1";
  const BOARD_API_PATH = "/api/vibe-flow/boards";
  const API_TIMEOUT_MS = 12000;
  const FILE_VERSION = 1;
  const MAX_HISTORY = 60;
  const MIN_ZOOM = 0.25;
  const MAX_ZOOM = 2.4;
  const EXAMPLE_TOPIC = "用 Vibe Coding 做一個族語單詞測驗網站";

  const NODE_META = {
    start: {
      typeLabel: "開始",
      defaultLabel: "流程開始",
      defaultDetail: "先說清楚要解決的問題",
      width: 210,
      height: 108,
    },
    process: {
      typeLabel: "步驟",
      defaultLabel: "新的步驟",
      defaultDetail: "這一步要發生什麼事？",
      width: 220,
      height: 116,
    },
    decision: {
      typeLabel: "判斷",
      defaultLabel: "結果符合期待嗎？",
      defaultDetail: "從這裡分成兩條路",
      width: 240,
      height: 150,
    },
    result: {
      typeLabel: "成果",
      defaultLabel: "完成並分享",
      defaultDetail: "讓同學實際操作看看",
      width: 210,
      height: 108,
    },
    note: {
      typeLabel: "備註",
      defaultLabel: "補充提醒",
      defaultDetail: "記下限制、素材或注意事項",
      width: 212,
      height: 122,
    },
  };

  const TYPE_KEYS = Object.keys(NODE_META);
  const TOPIC_IDEAS = [
    "做一個族語單詞測驗網站",
    "做一個學生點名與分組工具",
    "做一個文化地圖導覽頁",
    "做一個情境對話練習器",
    "做一個課堂搶答計分板",
    "做一個每日學習打卡頁",
    "做一個圖片分類小遊戲",
    "做一個作業繳交提醒工具",
  ];

  const state = {
    topic: "",
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    selection: { kind: null, id: null },
    mode: "select",
    connectSource: null,
  };

  let undoStack = [];
  let redoStack = [];
  let interaction = null;
  let editingNodeId = null;
  let editingEdgeId = null;
  let topicEditSnapshot = null;
  let saveTimer = null;
  let toastTimer = null;
  let renderQueued = false;
  let storageAvailable = true;
  let restoredFromStorage = false;
  let previewWasManuallyToggled = false;
  let lastTap = null;
  let shareIdentity = null;
  let pendingShareIdentity = null;
  let volatileClientId = null;
  const activePointers = new Map();

  const elements = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    bindEvents();
    restoredFromStorage = restoreLocalBoard();
    shareIdentity = restoreShareIdentity();
    setMode("select");
    renderAll();

    if (window.innerWidth <= 1240) {
      setPreviewOpen(false);
    }
    if (window.innerWidth <= 780) {
      elements.layoutDirection.value = "vertical";
    }

    requestAnimationFrame(function () {
      if (state.nodes.length > 0) {
        fitToBoard(false);
      } else {
        resetViewport();
      }

      if (!restoredFromStorage) {
        openDialog(elements.welcomeDialog);
        elements.welcomeTopicInput.focus();
      }
    });
  }

  function cacheElements() {
    const ids = [
      "topicInput",
      "classHomeLink",
      "galleryLink",
      "undoButton",
      "redoButton",
      "previewToggleButton",
      "presentButton",
      "shareButton",
      "exportPngButton",
      "exportSvgButton",
      "exportJsonButton",
      "importJsonButton",
      "layoutDirection",
      "autoLayoutButton",
      "fitButton",
      "loadExampleButton",
      "nodeCount",
      "edgeCount",
      "clearButton",
      "zoomOutButton",
      "zoomInButton",
      "zoomOutput",
      "modeHint",
      "boardSvg",
      "viewportLayer",
      "edgeLayer",
      "nodeLayer",
      "emptyState",
      "emptyAddButton",
      "saveStatus",
      "selectionStatus",
      "previewPanel",
      "previewTopic",
      "previewSvg",
      "previewEmptyState",
      "closePreviewButton",
      "previewPresentButton",
      "previewExportButton",
      "welcomeDialog",
      "welcomeForm",
      "welcomeTopicInput",
      "ideaButton",
      "startBlankButton",
      "startExampleButton",
      "nodeDialog",
      "nodeForm",
      "nodeTypeInput",
      "nodeLabelInput",
      "nodeDetailInput",
      "edgeDialog",
      "edgeForm",
      "edgeLabelInput",
      "shareDialog",
      "shareForm",
      "shareTopic",
      "shareNodeCount",
      "shareEdgeCount",
      "authorNameInput",
      "shareStatus",
      "shareSuccessActions",
      "viewSharedBoardLink",
      "submitShareButton",
      "removeSharedBoardButton",
      "presentationDialog",
      "presentationTitle",
      "presentationSvg",
      "fullscreenButton",
      "closePresentationButton",
      "jsonFileInput",
      "toast",
    ];

    ids.forEach(function (id) {
      elements[id] = document.getElementById(id);
    });

    elements.modeButtons = Array.from(document.querySelectorAll("[data-mode]"));
    elements.addNodeButtons = Array.from(document.querySelectorAll("[data-add-node]"));
    elements.dialogCloseButtons = Array.from(document.querySelectorAll("[data-close-dialog]"));
    elements.moreMenu = document.querySelector(".more-menu");
    if (/^\/class\/vibe-flow\/?/u.test(window.location.pathname)) {
      elements.classHomeLink.hidden = false;
    }
  }

  function bindEvents() {
    elements.addNodeButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        addNode(button.dataset.addNode, true);
      });
    });

    elements.emptyAddButton.addEventListener("click", function () {
      addNode("process", true);
    });

    elements.modeButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        setMode(button.dataset.mode);
      });
    });

    elements.undoButton.addEventListener("click", undo);
    elements.redoButton.addEventListener("click", redo);
    elements.fitButton.addEventListener("click", function () {
      fitToBoard(true);
    });
    elements.autoLayoutButton.addEventListener("click", autoLayout);
    elements.loadExampleButton.addEventListener("click", function () {
      loadExample(false);
    });
    elements.clearButton.addEventListener("click", clearBoard);
    elements.zoomOutButton.addEventListener("click", function () {
      zoomBy(0.84);
    });
    elements.zoomInButton.addEventListener("click", function () {
      zoomBy(1.18);
    });

    elements.previewToggleButton.addEventListener("click", function () {
      previewWasManuallyToggled = true;
      setPreviewOpen(!elements.previewPanel.classList.contains("is-open"));
    });
    elements.closePreviewButton.addEventListener("click", function () {
      previewWasManuallyToggled = true;
      setPreviewOpen(false);
    });

    elements.presentButton.addEventListener("click", openPresentation);
    elements.shareButton.addEventListener("click", openShareDialog);
    elements.previewPresentButton.addEventListener("click", openPresentation);
    elements.closePresentationButton.addEventListener("click", closePresentation);
    elements.fullscreenButton.addEventListener("click", enterFullscreen);

    elements.exportPngButton.addEventListener("click", exportPng);
    elements.previewExportButton.addEventListener("click", exportPng);
    elements.exportSvgButton.addEventListener("click", exportSvg);
    elements.exportJsonButton.addEventListener("click", exportJson);
    elements.importJsonButton.addEventListener("click", function () {
      closeMoreMenu();
      elements.jsonFileInput.click();
    });
    elements.jsonFileInput.addEventListener("change", importJsonFile);

    elements.topicInput.addEventListener("focus", beginTopicEdit);
    elements.topicInput.addEventListener("input", updateTopicFromHeader);
    elements.topicInput.addEventListener("blur", finishTopicEdit);
    elements.topicInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        elements.topicInput.blur();
      }
    });

    elements.welcomeForm.addEventListener("submit", handleWelcomeSubmit);
    elements.welcomeTopicInput.addEventListener("input", clearWelcomeTopicError);
    elements.ideaButton.addEventListener("click", suggestTopic);
    elements.nodeForm.addEventListener("submit", saveNodeEdit);
    elements.edgeForm.addEventListener("submit", saveEdgeEdit);
    elements.shareForm.addEventListener("submit", submitShare);
    elements.removeSharedBoardButton.addEventListener("click", removeSharedBoard);

    elements.dialogCloseButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        closeDialog(elements[button.dataset.closeDialog]);
      });
    });

    elements.boardSvg.addEventListener("pointerdown", handlePointerDown);
    elements.boardSvg.addEventListener("pointermove", handlePointerMove);
    elements.boardSvg.addEventListener("pointerup", handlePointerUp);
    elements.boardSvg.addEventListener("pointercancel", handlePointerUp);
    elements.boardSvg.addEventListener("dblclick", handleBoardDoubleClick);
    elements.boardSvg.addEventListener("focusin", handleBoardFocus);
    elements.boardSvg.addEventListener("wheel", handleWheel, { passive: false });

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    document.addEventListener("click", handleDocumentClick);
    window.addEventListener("resize", handleResize);

    elements.presentationDialog.addEventListener("cancel", function (event) {
      event.preventDefault();
      closePresentation();
    });
  }

  function handleDocumentClick(event) {
    if (
      elements.moreMenu.open &&
      !elements.moreMenu.contains(event.target)
    ) {
      closeMoreMenu();
    }
  }

  function handleResize() {
    if (!previewWasManuallyToggled && window.innerWidth <= 1240) {
      setPreviewOpen(false);
    }
    applyViewportTransform();
  }

  function handleBoardFocus(event) {
    const nodeElement = closestDataElement(event.target, "nodeId");
    const edgeElement = closestDataElement(event.target, "edgeId");
    if (nodeElement) {
      state.selection = { kind: "node", id: nodeElement.dataset.nodeId };
    } else if (edgeElement) {
      state.selection = { kind: "edge", id: edgeElement.dataset.edgeId };
    } else {
      return;
    }
    refreshSelectionVisuals();
  }

  function beginTopicEdit() {
    topicEditSnapshot = getBoardSnapshot();
  }

  function updateTopicFromHeader() {
    state.topic = elements.topicInput.value.slice(0, 80);
    scheduleRender();
    scheduleSave();
  }

  function finishTopicEdit() {
    if (!topicEditSnapshot) {
      return;
    }

    if (topicEditSnapshot.topic !== state.topic) {
      pushUndoSnapshot(topicEditSnapshot);
      redoStack = [];
      updateHistoryButtons();
      scheduleSave();
    }
    topicEditSnapshot = null;
  }

  function handleWelcomeSubmit(event) {
    event.preventDefault();
    const action = event.submitter ? event.submitter.value : "blank";
    const topic = elements.welcomeTopicInput.value.trim().slice(0, 80);

    if (!topic && action === "blank") {
      elements.welcomeTopicInput.setCustomValidity("請先寫下一個主題。");
      elements.welcomeTopicInput.reportValidity();
      return;
    }

    elements.welcomeTopicInput.setCustomValidity("");
    closeDialog(elements.welcomeDialog);

    if (action === "example") {
      applyExample(topic || EXAMPLE_TOPIC, false);
    } else {
      state.topic = topic;
      elements.topicInput.value = topic;
      afterBoardChange();
      resetViewport();
      elements.boardSvg.focus();
    }
  }

  function clearWelcomeTopicError() {
    elements.welcomeTopicInput.setCustomValidity("");
  }

  function suggestTopic() {
    const current = elements.welcomeTopicInput.value.trim();
    let next = current;
    let guard = 0;
    while (next === current && guard < 12) {
      next = TOPIC_IDEAS[Math.floor(Math.random() * TOPIC_IDEAS.length)];
      guard += 1;
    }
    elements.welcomeTopicInput.value = next;
    clearWelcomeTopicError();
    elements.welcomeTopicInput.focus();
    elements.welcomeTopicInput.select();
  }

  function setMode(mode) {
    if (!["select", "pan", "connect"].includes(mode)) {
      return;
    }

    state.mode = mode;
    document.body.dataset.mode = mode;

    if (mode !== "connect") {
      state.connectSource = null;
    }

    elements.modeButtons.forEach(function (button) {
      const active = button.dataset.mode === mode;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });

    updateModeHint();
    refreshSelectionVisuals();
  }

  function updateModeHint() {
    elements.modeHint.classList.toggle("is-connecting", state.mode === "connect");

    if (state.mode === "connect" && state.connectSource) {
      const source = getNode(state.connectSource);
      elements.modeHint.textContent = source
        ? "已選「" + source.label + "」，再點一下目標節點完成連線。"
        : "請先點一個起點節點。";
      return;
    }

    const hints = {
      select: "拖曳節點調整位置，雙擊節點修改內容。",
      pan: "拖曳空白處移動畫布，也可以用雙指縮放。",
      connect: "依序點起點與終點。完成後可雙擊線條加上標籤。",
    };
    elements.modeHint.textContent = hints[state.mode];
  }

  function setPreviewOpen(open) {
    elements.previewPanel.classList.toggle("is-open", open);
    elements.previewToggleButton.setAttribute("aria-expanded", String(open));
  }

  function closeMoreMenu() {
    elements.moreMenu.removeAttribute("open");
  }

  function getBoardSnapshot() {
    return cloneData({
      topic: state.topic,
      nodes: state.nodes,
      edges: state.edges,
    });
  }

  function cloneData(value) {
    if (typeof structuredClone === "function") {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  function applySnapshot(snapshot) {
    state.topic = snapshot.topic || "";
    state.nodes = cloneData(snapshot.nodes || []);
    state.edges = cloneData(snapshot.edges || []);
    state.selection = { kind: null, id: null };
    state.connectSource = null;
    elements.topicInput.value = state.topic;
    afterBoardChange();
  }

  function commitMutation(mutator) {
    const before = getBoardSnapshot();
    mutator();
    pushUndoSnapshot(before);
    redoStack = [];
    afterBoardChange();
  }

  function pushUndoSnapshot(snapshot) {
    undoStack.push(cloneData(snapshot));
    if (undoStack.length > MAX_HISTORY) {
      undoStack.shift();
    }
    updateHistoryButtons();
  }

  function undo() {
    if (undoStack.length === 0) {
      return;
    }
    redoStack.push(getBoardSnapshot());
    applySnapshot(undoStack.pop());
    updateHistoryButtons();
    showToast("已復原上一個動作。");
  }

  function redo() {
    if (redoStack.length === 0) {
      return;
    }
    undoStack.push(getBoardSnapshot());
    applySnapshot(redoStack.pop());
    updateHistoryButtons();
    showToast("已重做上一個動作。");
  }

  function updateHistoryButtons() {
    elements.undoButton.disabled = undoStack.length === 0;
    elements.redoButton.disabled = redoStack.length === 0;
  }

  function afterBoardChange() {
    elements.topicInput.value = state.topic;
    scheduleRender();
    scheduleSave();
    updateHistoryButtons();
  }

  function addNode(type, openEditor) {
    if (!TYPE_KEYS.includes(type)) {
      return;
    }

    const meta = NODE_META[type];
    const center = getVisibleWorldCenter();
    const openPosition = findOpenNodePosition(center, type);
    const node = {
      id: createId("node"),
      type: type,
      label: meta.defaultLabel,
      detail: meta.defaultDetail,
      x: snap(openPosition.x),
      y: snap(openPosition.y),
    };

    commitMutation(function () {
      state.nodes.push(node);
      state.selection = { kind: "node", id: node.id };
    });

    if (openEditor) {
      setTimeout(function () {
        openNodeEditor(node.id, true);
      }, 0);
    }
  }

  function findOpenNodePosition(center, type) {
    const targetMeta = NODE_META[type] || NODE_META.process;
    const candidates = [
      [0, 0],
      [290, 0],
      [-290, 0],
      [0, 205],
      [0, -205],
      [290, 205],
      [-290, 205],
      [290, -205],
      [-290, -205],
      [580, 0],
      [-580, 0],
      [0, 410],
      [0, -410],
    ];

    for (const candidate of candidates) {
      const point = { x: center.x + candidate[0], y: center.y + candidate[1] };
      const clear = state.nodes.every(function (existing) {
        const existingMeta = NODE_META[existing.type] || NODE_META.process;
        const horizontalGap = (targetMeta.width + existingMeta.width) / 2 + 32;
        const verticalGap = (targetMeta.height + existingMeta.height) / 2 + 32;
        return (
          Math.abs(point.x - existing.x) >= horizontalGap ||
          Math.abs(point.y - existing.y) >= verticalGap
        );
      });
      if (clear) {
        return point;
      }
    }

    return {
      x: center.x + (state.nodes.length + 1) * 72,
      y: center.y + (state.nodes.length + 1) * 54,
    };
  }

  function deleteSelection() {
    const selection = state.selection;
    if (!selection.kind || !selection.id) {
      return;
    }

    if (selection.kind === "node") {
      const node = getNode(selection.id);
      if (!node) {
        return;
      }
      commitMutation(function () {
        state.nodes = state.nodes.filter(function (item) {
          return item.id !== selection.id;
        });
        state.edges = state.edges.filter(function (edge) {
          return edge.from !== selection.id && edge.to !== selection.id;
        });
        state.selection = { kind: null, id: null };
      });
      showToast("已刪除節點「" + node.label + "」。");
      return;
    }

    if (selection.kind === "edge") {
      commitMutation(function () {
        state.edges = state.edges.filter(function (edge) {
          return edge.id !== selection.id;
        });
        state.selection = { kind: null, id: null };
      });
      showToast("已刪除連線。");
    }
  }

  function clearBoard() {
    if (state.nodes.length === 0 && state.edges.length === 0) {
      showToast("白板目前是空的。");
      return;
    }

    const confirmed = window.confirm("確定要清空所有節點與連線嗎？清空後仍可按復原。");
    if (!confirmed) {
      return;
    }

    commitMutation(function () {
      state.nodes = [];
      state.edges = [];
      state.selection = { kind: null, id: null };
      state.connectSource = null;
    });
    resetViewport();
    showToast("白板已清空，可按復原找回內容。");
  }

  function loadExample(fromWelcome) {
    if (!fromWelcome && state.nodes.length > 0) {
      const confirmed = window.confirm("載入範例會取代目前流程。確定要繼續嗎？若要備份，請先按取消並下載 JSON。");
      if (!confirmed) {
        return;
      }
    }
    applyExample(EXAMPLE_TOPIC, !fromWelcome);
  }

  function applyExample(topic, rememberCurrent) {
    const example = createExampleBoard(topic);
    const before = getBoardSnapshot();
    state.topic = example.topic;
    state.nodes = example.nodes;
    state.edges = example.edges;
    state.selection = { kind: null, id: null };
    state.connectSource = null;
    elements.topicInput.value = state.topic;

    if (rememberCurrent) {
      pushUndoSnapshot(before);
      redoStack = [];
    }

    afterBoardChange();
    requestAnimationFrame(function () {
      fitToBoard(false);
    });
    showToast("已載入族語單詞測驗網站範例，可直接改成自己的內容。");
  }

  function createExampleBoard(topic) {
    const ids = [0, 1, 2, 3, 4, 5].map(function () {
      return createId("node");
    });

    return {
      topic: topic,
      nodes: [
        {
          id: ids[0],
          type: "start",
          label: "準備族語單詞題庫",
          detail: "選一個語別，先準備 10 個要練習的單詞",
          x: 0,
          y: 0,
        },
        {
          id: ids[1],
          type: "process",
          label: "整理題目與正確答案",
          detail: "每題包含族語、華語意思、選項與答案",
          x: 320,
          y: 0,
        },
        {
          id: ids[2],
          type: "process",
          label: "請 AI 製作測驗頁面",
          detail: "說清楚答題回饋、計分與重新挑戰功能",
          x: 640,
          y: 0,
        },
        {
          id: ids[3],
          type: "decision",
          label: "題目與計分都正確嗎？",
          detail: "從第一題做到完成頁，逐題核對答案與總分",
          x: 970,
          y: 0,
        },
        {
          id: ids[4],
          type: "process",
          label: "說明錯誤並請 AI 修正",
          detail: "貼上錯誤現象，一次只修一個問題",
          x: 970,
          y: 250,
        },
        {
          id: ids[5],
          type: "result",
          label: "發布族語單詞測驗網站",
          detail: "請同學作答，收集太難或看不懂的題目",
          x: 1300,
          y: 0,
        },
      ],
      edges: [
        { id: createId("edge"), from: ids[0], to: ids[1], label: "" },
        { id: createId("edge"), from: ids[1], to: ids[2], label: "" },
        { id: createId("edge"), from: ids[2], to: ids[3], label: "" },
        { id: createId("edge"), from: ids[3], to: ids[5], label: "是" },
        { id: createId("edge"), from: ids[3], to: ids[4], label: "否" },
        { id: createId("edge"), from: ids[4], to: ids[2], label: "再試一次" },
      ],
    };
  }

  function handlePointerDown(event) {
    if (event.button !== 0 && event.pointerType !== "touch") {
      return;
    }

    activePointers.set(event.pointerId, {
      clientX: event.clientX,
      clientY: event.clientY,
    });

    try {
      elements.boardSvg.setPointerCapture(event.pointerId);
    } catch (error) {
      // Pointer capture can fail if the browser ends the pointer early.
    }

    if (activePointers.size === 2) {
      startPinchInteraction();
      event.preventDefault();
      return;
    }

    const nodeElement = closestDataElement(event.target, "nodeId");
    const edgeElement = closestDataElement(event.target, "edgeId");
    const point = clientToSvgPoint(event.clientX, event.clientY);

    if (nodeElement) {
      const nodeId = nodeElement.dataset.nodeId;
      if (state.mode === "connect") {
        handleConnectNode(nodeId);
        event.preventDefault();
        return;
      }

      if (state.mode === "pan" || document.body.classList.contains("is-space-panning")) {
        startPanInteraction(event.pointerId, point);
        event.preventDefault();
        return;
      }

      if (isRepeatedTap("node", nodeId)) {
        openNodeEditor(nodeId, false);
        event.preventDefault();
        return;
      }

      const node = getNode(nodeId);
      if (!node) {
        return;
      }

      const world = svgToWorld(point);
      state.selection = { kind: "node", id: nodeId };
      interaction = {
        kind: "drag-node",
        pointerId: event.pointerId,
        nodeId: nodeId,
        offsetX: node.x - world.x,
        offsetY: node.y - world.y,
        startX: node.x,
        startY: node.y,
        before: getBoardSnapshot(),
      };
      refreshSelectionVisuals();
      event.preventDefault();
      return;
    }

    if (edgeElement && state.mode === "select") {
      if (isRepeatedTap("edge", edgeElement.dataset.edgeId)) {
        openEdgeEditor(edgeElement.dataset.edgeId);
        event.preventDefault();
        return;
      }
      state.selection = { kind: "edge", id: edgeElement.dataset.edgeId };
      refreshSelectionVisuals();
      event.preventDefault();
      return;
    }

    if (state.mode === "pan" || document.body.classList.contains("is-space-panning")) {
      startPanInteraction(event.pointerId, point);
      event.preventDefault();
      return;
    }

    state.selection = { kind: null, id: null };
    refreshSelectionVisuals();
  }

  function handlePointerMove(event) {
    if (activePointers.has(event.pointerId)) {
      activePointers.set(event.pointerId, {
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }

    if (interaction && interaction.kind === "pinch" && activePointers.size >= 2) {
      updatePinchInteraction();
      event.preventDefault();
      return;
    }

    if (!interaction || interaction.pointerId !== event.pointerId) {
      return;
    }

    const point = clientToSvgPoint(event.clientX, event.clientY);

    if (interaction.kind === "pan") {
      state.viewport.x = interaction.startViewport.x + point.x - interaction.startPoint.x;
      state.viewport.y = interaction.startViewport.y + point.y - interaction.startPoint.y;
      document.body.classList.add("is-panning");
      applyViewportTransform();
      event.preventDefault();
      return;
    }

    if (interaction.kind === "drag-node") {
      const node = getNode(interaction.nodeId);
      if (!node) {
        return;
      }
      const world = svgToWorld(point);
      const rawX = world.x + interaction.offsetX;
      const rawY = world.y + interaction.offsetY;
      if (Math.abs(rawX - interaction.startX) > 4 || Math.abs(rawY - interaction.startY) > 4) {
        lastTap = null;
      }
      node.x = event.altKey ? rawX : snap(rawX);
      node.y = event.altKey ? rawY : snap(rawY);
      scheduleRender();
      event.preventDefault();
    }
  }

  function handlePointerUp(event) {
    activePointers.delete(event.pointerId);

    if (!interaction) {
      return;
    }

    if (interaction.kind === "pinch") {
      if (activePointers.size < 2) {
        interaction = null;
      }
      document.body.classList.remove("is-panning");
      return;
    }

    if (interaction.pointerId !== event.pointerId) {
      return;
    }

    let nodeMoved = false;
    if (interaction.kind === "drag-node") {
      const node = getNode(interaction.nodeId);
      if (
        node &&
        (Math.abs(node.x - interaction.startX) > 0.5 || Math.abs(node.y - interaction.startY) > 0.5)
      ) {
        nodeMoved = true;
        pushUndoSnapshot(interaction.before);
        redoStack = [];
        scheduleSave();
      }
    }

    interaction = null;
    document.body.classList.remove("is-panning");
    if (nodeMoved) {
      scheduleRender();
    } else {
      refreshSelectionVisuals();
    }
  }

  function startPanInteraction(pointerId, point) {
    interaction = {
      kind: "pan",
      pointerId: pointerId,
      startPoint: point,
      startViewport: cloneData(state.viewport),
    };
  }

  function startPinchInteraction() {
    const pointerValues = Array.from(activePointers.values()).slice(0, 2);
    const first = clientToSvgPoint(pointerValues[0].clientX, pointerValues[0].clientY);
    const second = clientToSvgPoint(pointerValues[1].clientX, pointerValues[1].clientY);
    const center = midpoint(first, second);

    interaction = {
      kind: "pinch",
      startDistance: Math.max(20, distance(first, second)),
      startZoom: state.viewport.zoom,
      worldCenter: svgToWorld(center),
    };
    document.body.classList.add("is-panning");
  }

  function updatePinchInteraction() {
    const pointerValues = Array.from(activePointers.values()).slice(0, 2);
    const first = clientToSvgPoint(pointerValues[0].clientX, pointerValues[0].clientY);
    const second = clientToSvgPoint(pointerValues[1].clientX, pointerValues[1].clientY);
    const center = midpoint(first, second);
    const nextZoom = clamp(
      interaction.startZoom * (distance(first, second) / interaction.startDistance),
      MIN_ZOOM,
      MAX_ZOOM
    );

    state.viewport.zoom = nextZoom;
    state.viewport.x = center.x - interaction.worldCenter.x * nextZoom;
    state.viewport.y = center.y - interaction.worldCenter.y * nextZoom;
    applyViewportTransform();
  }

  function handleConnectNode(nodeId) {
    if (!state.connectSource) {
      state.connectSource = nodeId;
      state.selection = { kind: "node", id: nodeId };
      updateModeHint();
      refreshSelectionVisuals();
      return;
    }

    if (state.connectSource === nodeId) {
      showToast("起點與終點不能是同一個節點。", true);
      return;
    }

    const duplicate = state.edges.some(function (edge) {
      return edge.from === state.connectSource && edge.to === nodeId;
    });
    if (duplicate) {
      showToast("這兩個節點已經有相同方向的連線。", true);
      return;
    }

    const newEdge = {
      id: createId("edge"),
      from: state.connectSource,
      to: nodeId,
      label: "",
    };

    commitMutation(function () {
      state.edges.push(newEdge);
      state.selection = { kind: "edge", id: newEdge.id };
      state.connectSource = null;
    });
    setMode("select");
    showToast("連線完成。雙擊線條可加上分支文字。");
  }

  function handleBoardDoubleClick(event) {
    const nodeElement = closestDataElement(event.target, "nodeId");
    if (nodeElement) {
      openNodeEditor(nodeElement.dataset.nodeId, false);
      event.preventDefault();
      return;
    }

    const edgeElement = closestDataElement(event.target, "edgeId");
    if (edgeElement) {
      openEdgeEditor(edgeElement.dataset.edgeId);
      event.preventDefault();
    }
  }

  function isRepeatedTap(kind, id) {
    const now = performance.now();
    const repeated =
      lastTap && lastTap.kind === kind && lastTap.id === id && now - lastTap.time <= 460;
    lastTap = repeated ? null : { kind: kind, id: id, time: now };
    return repeated;
  }

  function handleWheel(event) {
    event.preventDefault();
    const point = clientToSvgPoint(event.clientX, event.clientY);
    const factor = Math.exp(-event.deltaY * 0.0015);
    setZoomAt(state.viewport.zoom * factor, point);
  }

  function handleKeyDown(event) {
    if (isTypingTarget(event.target)) {
      return;
    }

    const modifier = event.ctrlKey || event.metaKey;

    if (modifier && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) {
        redo();
      } else {
        undo();
      }
      return;
    }

    if (modifier && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
      return;
    }

    if (modifier && event.key === "0") {
      event.preventDefault();
      fitToBoard(true);
      return;
    }

    if (event.key === "Delete" || event.key === "Backspace") {
      if (state.selection.kind) {
        event.preventDefault();
        deleteSelection();
      }
      return;
    }

    if (event.key === "Enter") {
      if (state.selection.kind === "node") {
        event.preventDefault();
        openNodeEditor(state.selection.id, false);
      } else if (state.selection.kind === "edge") {
        event.preventDefault();
        openEdgeEditor(state.selection.id);
      }
      return;
    }

    if (event.key === "Escape") {
      state.connectSource = null;
      state.selection = { kind: null, id: null };
      setMode("select");
      return;
    }

    if (event.key === " " && !event.repeat) {
      event.preventDefault();
      document.body.classList.add("is-space-panning");
      return;
    }

    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomBy(1.18);
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      zoomBy(0.84);
    }
  }

  function handleKeyUp(event) {
    if (event.key === " ") {
      document.body.classList.remove("is-space-panning");
    }
  }

  function openNodeEditor(nodeId, selectText) {
    const node = getNode(nodeId);
    if (!node) {
      return;
    }
    editingNodeId = nodeId;
    state.selection = { kind: "node", id: nodeId };
    elements.nodeTypeInput.value = node.type;
    elements.nodeLabelInput.value = node.label;
    elements.nodeDetailInput.value = node.detail || "";
    openDialog(elements.nodeDialog);
    refreshSelectionVisuals();
    setTimeout(function () {
      elements.nodeLabelInput.focus();
      if (selectText) {
        elements.nodeLabelInput.select();
      }
    }, 0);
  }

  function saveNodeEdit(event) {
    event.preventDefault();
    const node = getNode(editingNodeId);
    if (!node) {
      closeDialog(elements.nodeDialog);
      return;
    }

    const label = elements.nodeLabelInput.value.trim().slice(0, 50);
    if (!label) {
      elements.nodeLabelInput.setCustomValidity("請輸入節點文字。");
      elements.nodeLabelInput.reportValidity();
      return;
    }
    elements.nodeLabelInput.setCustomValidity("");

    const nextType = TYPE_KEYS.includes(elements.nodeTypeInput.value)
      ? elements.nodeTypeInput.value
      : node.type;
    const nextDetail = elements.nodeDetailInput.value.trim().slice(0, 120);

    if (node.label !== label || node.detail !== nextDetail || node.type !== nextType) {
      commitMutation(function () {
        node.label = label;
        node.detail = nextDetail;
        node.type = nextType;
      });
    }

    closeDialog(elements.nodeDialog);
    editingNodeId = null;
    elements.boardSvg.focus();
  }

  function openEdgeEditor(edgeId) {
    const edge = getEdge(edgeId);
    if (!edge) {
      return;
    }
    editingEdgeId = edgeId;
    state.selection = { kind: "edge", id: edgeId };
    elements.edgeLabelInput.value = edge.label || "";
    openDialog(elements.edgeDialog);
    refreshSelectionVisuals();
    setTimeout(function () {
      elements.edgeLabelInput.focus();
      elements.edgeLabelInput.select();
    }, 0);
  }

  function saveEdgeEdit(event) {
    event.preventDefault();
    const edge = getEdge(editingEdgeId);
    if (!edge) {
      closeDialog(elements.edgeDialog);
      return;
    }
    const label = elements.edgeLabelInput.value.trim().slice(0, 24);
    if (edge.label !== label) {
      commitMutation(function () {
        edge.label = label;
      });
    }
    closeDialog(elements.edgeDialog);
    editingEdgeId = null;
    elements.boardSvg.focus();
  }

  function openDialog(dialog) {
    if (!dialog || dialog.open) {
      return;
    }
    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      dialog.setAttribute("open", "");
    }
  }

  function closeDialog(dialog) {
    if (!dialog || !dialog.open) {
      return;
    }
    if (typeof dialog.close === "function") {
      dialog.close();
    } else {
      dialog.removeAttribute("open");
    }
  }

  function scheduleRender() {
    if (renderQueued) {
      return;
    }
    renderQueued = true;
    requestAnimationFrame(function () {
      renderQueued = false;
      renderAll();
    });
  }

  function renderAll() {
    renderBoard();
    renderPreview();
    updateMetrics();
    updateSelectionStatus();
    updateHistoryButtons();

    if (elements.presentationDialog.open) {
      renderStaticDiagram(elements.presentationSvg, "presentationArrow");
      elements.presentationTitle.textContent = displayTopic();
    }
  }

  function renderBoard() {
    applyViewportTransform();

    const edgeFragment = document.createDocumentFragment();
    state.edges.forEach(function (edge) {
      const group = createEdgeGroup(edge, true, "arrowHead");
      if (group) {
        edgeFragment.appendChild(group);
      }
    });
    elements.edgeLayer.replaceChildren(edgeFragment);

    const nodeFragment = document.createDocumentFragment();
    state.nodes.forEach(function (node) {
      nodeFragment.appendChild(createNodeGroup(node, true));
    });
    elements.nodeLayer.replaceChildren(nodeFragment);

    elements.emptyState.hidden = state.nodes.length > 0;
  }

  function renderPreview() {
    elements.previewTopic.textContent = displayTopic();
    elements.previewEmptyState.hidden = state.nodes.length > 0;
    renderStaticDiagram(elements.previewSvg, "previewArrow");
  }

  function renderStaticDiagram(svg, markerId) {
    svg.replaceChildren();

    if (state.nodes.length === 0) {
      svg.setAttribute("viewBox", "0 0 1000 620");
      return;
    }

    const bounds = getGraphBounds();
    const padding = 74;
    const viewBox = {
      x: bounds.minX - padding,
      y: bounds.minY - padding,
      width: Math.max(400, bounds.width + padding * 2),
      height: Math.max(280, bounds.height + padding * 2),
    };

    svg.setAttribute(
      "viewBox",
      [viewBox.x, viewBox.y, viewBox.width, viewBox.height].join(" ")
    );
    svg.setAttribute("preserveAspectRatio", "xMidYMid meet");

    const defs = createSvgElement("defs");
    const marker = createSvgElement("marker", {
      id: markerId,
      viewBox: "0 0 10 10",
      refX: "8.6",
      refY: "5",
      markerWidth: "7",
      markerHeight: "7",
      orient: "auto-start-reverse",
    });
    marker.appendChild(
      createSvgElement("path", {
        d: "M 0 0 L 10 5 L 0 10 z",
        fill: "#59635d",
      })
    );
    defs.appendChild(marker);
    svg.appendChild(defs);

    svg.appendChild(
      createSvgElement("rect", {
        x: viewBox.x,
        y: viewBox.y,
        width: viewBox.width,
        height: viewBox.height,
        fill: "#fbfbf8",
      })
    );

    const edgeGroup = createSvgElement("g");
    state.edges.forEach(function (edge) {
      const group = createEdgeGroup(edge, false, markerId);
      if (group) {
        edgeGroup.appendChild(group);
      }
    });
    svg.appendChild(edgeGroup);

    const nodeGroup = createSvgElement("g");
    state.nodes.forEach(function (node) {
      nodeGroup.appendChild(createNodeGroup(node, false));
    });
    svg.appendChild(nodeGroup);
  }

  function createNodeGroup(node, interactive) {
    const meta = NODE_META[node.type] || NODE_META.process;
    const group = createSvgElement("g", {
      class: "flow-node" + (interactive && interaction && interaction.nodeId === node.id ? " is-dragging" : ""),
      transform: "translate(" + node.x + " " + node.y + ")",
    });
    group.dataset.nodeId = node.id;
    group.dataset.nodeType = node.type;

    if (interactive) {
      group.setAttribute("role", "button");
      group.setAttribute("tabindex", "0");
      group.setAttribute(
        "aria-label",
        meta.typeLabel + "節點：" + node.label + (node.detail ? "，" + node.detail : "")
      );
      group.classList.toggle(
        "is-selected",
        state.selection.kind === "node" && state.selection.id === node.id
      );
      group.classList.toggle("is-connect-source", state.connectSource === node.id);
    } else {
      group.style.pointerEvents = "none";
    }

    group.appendChild(createNodeShape(node, "node-shadow"));
    group.appendChild(createNodeShape(node, "node-shape"));

    if (node.type === "note") {
      group.appendChild(
        createSvgElement("path", {
          d: "M 82 61 L 82 38 L 106 38",
          fill: "none",
          stroke: "#4b554f",
          "stroke-width": "2",
          "pointer-events": "none",
        })
      );
    }

    const textLayout = getNodeTextLayout(node);
    const typeText = createSvgElement("text", {
      class: "node-type-text",
      x: "0",
      y: textLayout.typeY,
    });
    typeText.textContent = meta.typeLabel;
    group.appendChild(typeText);

    group.appendChild(
      createMultilineText(
        textLayout.labelLines,
        "node-label-text",
        textLayout.labelStartY,
        textLayout.labelLineHeight
      )
    );

    if (textLayout.detailLines.length > 0) {
      group.appendChild(
        createMultilineText(
          textLayout.detailLines,
          "node-detail-text",
          textLayout.detailStartY,
          textLayout.detailLineHeight
        )
      );
    }

    if (interactive) {
      getNodePorts(node).forEach(function (port) {
        group.appendChild(
          createSvgElement("circle", {
            class: "connection-port",
            cx: port.x,
            cy: port.y,
            r: "5.5",
          })
        );
      });
    }

    return group;
  }

  function createNodeShape(node, className) {
    const meta = NODE_META[node.type] || NODE_META.process;
    const halfWidth = meta.width / 2;
    const halfHeight = meta.height / 2;

    if (node.type === "decision") {
      return createSvgElement("polygon", {
        class: className,
        points: [
          "0," + -halfHeight,
          halfWidth + ",0",
          "0," + halfHeight,
          -halfWidth + ",0",
        ].join(" "),
      });
    }

    if (node.type === "note") {
      return createSvgElement("polygon", {
        class: className,
        points: [
          -halfWidth + "," + -halfHeight,
          (halfWidth - 24) + "," + -halfHeight,
          halfWidth + "," + (-halfHeight + 24),
          halfWidth + "," + halfHeight,
          -halfWidth + "," + halfHeight,
        ].join(" "),
      });
    }

    const radius = node.type === "start" || node.type === "result" ? halfHeight : 14;
    return createSvgElement("rect", {
      class: className,
      x: -halfWidth,
      y: -halfHeight,
      width: meta.width,
      height: meta.height,
      rx: radius,
      ry: radius,
    });
  }

  function createEdgeGroup(edge, interactive, markerId) {
    const geometry = getEdgeGeometry(edge);
    if (!geometry) {
      return null;
    }

    const group = createSvgElement("g", { class: "flow-edge" });
    group.dataset.edgeId = edge.id;

    if (interactive) {
      group.setAttribute("role", "button");
      group.setAttribute("tabindex", "0");
      group.setAttribute("aria-label", edgeAriaLabel(edge));
      group.classList.toggle(
        "is-selected",
        state.selection.kind === "edge" && state.selection.id === edge.id
      );
      group.appendChild(
        createSvgElement("path", {
          class: "edge-hit",
          d: geometry.path,
        })
      );
    } else {
      group.style.pointerEvents = "none";
    }

    group.appendChild(
      createSvgElement("path", {
        class: "edge-line",
        d: geometry.path,
        "marker-end": "url(#" + markerId + ")",
      })
    );

    if (edge.label) {
      const labelWidth = Math.max(34, textUnits(edge.label) * 7.2 + 18);
      group.appendChild(
        createSvgElement("rect", {
          class: "edge-label-bg",
          x: geometry.mid.x - labelWidth / 2,
          y: geometry.mid.y - 13,
          width: labelWidth,
          height: 26,
          rx: "8",
          ry: "8",
        })
      );
      const labelText = createSvgElement("text", {
        class: "edge-label-text",
        x: geometry.mid.x,
        y: geometry.mid.y + 4,
      });
      labelText.textContent = edge.label;
      group.appendChild(labelText);
    }

    return group;
  }

  function createMultilineText(lines, className, startY, lineHeight) {
    const text = createSvgElement("text", {
      class: className,
      x: "0",
      y: startY,
    });
    lines.forEach(function (line, index) {
      const tspan = createSvgElement("tspan", {
        x: "0",
        y: startY + index * lineHeight,
      });
      tspan.textContent = line;
      text.appendChild(tspan);
    });
    return text;
  }

  function getNodeTextLayout(node) {
    const meta = NODE_META[node.type] || NODE_META.process;
    const compact = node.type === "start" || node.type === "result";
    const decision = node.type === "decision";
    const maxLabelUnits = decision ? 13 : compact ? 15 : 16;
    const maxDetailUnits = decision ? 15 : compact ? 18 : 19;
    const labelLines = wrapText(node.label || "未命名節點", maxLabelUnits, 2);
    const detailLines = node.detail
      ? wrapText(node.detail, maxDetailUnits, compact || decision ? 1 : 2)
      : [];
    const labelLineHeight = compact ? 18 : 20;
    const detailLineHeight = 15;
    let labelStartY;

    if (detailLines.length > 0) {
      labelStartY = -9 - (labelLines.length - 1) * (labelLineHeight / 2);
    } else {
      labelStartY = 5 - (labelLines.length - 1) * (labelLineHeight / 2);
    }

    return {
      typeY: -meta.height / 2 + (compact ? 20 : 22),
      labelLines: labelLines,
      detailLines: detailLines,
      labelStartY: labelStartY,
      labelLineHeight: labelLineHeight,
      detailStartY: labelStartY + (labelLines.length - 1) * labelLineHeight + 22,
      detailLineHeight: detailLineHeight,
    };
  }

  function getEdgeGeometry(edge) {
    const from = getNode(edge.from);
    const to = getNode(edge.to);
    if (!from || !to) {
      return null;
    }

    const start = anchorToward(from, to);
    const end = anchorToward(to, from);
    const deltaX = end.x - start.x;
    const deltaY = end.y - start.y;
    let control1;
    let control2;

    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
      const direction = deltaX >= 0 ? 1 : -1;
      const bend = Math.max(70, Math.abs(deltaX) * 0.44);
      control1 = { x: start.x + direction * bend, y: start.y };
      control2 = { x: end.x - direction * bend, y: end.y };
    } else {
      const direction = deltaY >= 0 ? 1 : -1;
      const bend = Math.max(70, Math.abs(deltaY) * 0.44);
      control1 = { x: start.x, y: start.y + direction * bend };
      control2 = { x: end.x, y: end.y - direction * bend };
    }

    return {
      path:
        "M " +
        round(start.x) +
        " " +
        round(start.y) +
        " C " +
        round(control1.x) +
        " " +
        round(control1.y) +
        ", " +
        round(control2.x) +
        " " +
        round(control2.y) +
        ", " +
        round(end.x) +
        " " +
        round(end.y),
      start: start,
      end: end,
      control1: control1,
      control2: control2,
      mid: cubicPoint(start, control1, control2, end, 0.5),
    };
  }

  function anchorToward(node, target) {
    const meta = NODE_META[node.type] || NODE_META.process;
    const halfWidth = meta.width / 2;
    const halfHeight = meta.height / 2;
    const deltaX = target.x - node.x;
    const deltaY = target.y - node.y;

    if (Math.abs(deltaX) < 0.001 && Math.abs(deltaY) < 0.001) {
      return { x: node.x + halfWidth, y: node.y };
    }

    let scale;
    if (node.type === "decision") {
      scale = 1 / (Math.abs(deltaX) / halfWidth + Math.abs(deltaY) / halfHeight);
    } else {
      const xScale = Math.abs(deltaX) < 0.001 ? Infinity : halfWidth / Math.abs(deltaX);
      const yScale = Math.abs(deltaY) < 0.001 ? Infinity : halfHeight / Math.abs(deltaY);
      scale = Math.min(xScale, yScale);
    }

    return {
      x: node.x + deltaX * scale,
      y: node.y + deltaY * scale,
    };
  }

  function getNodePorts(node) {
    const meta = NODE_META[node.type] || NODE_META.process;
    return [
      { x: 0, y: -meta.height / 2 },
      { x: meta.width / 2, y: 0 },
      { x: 0, y: meta.height / 2 },
      { x: -meta.width / 2, y: 0 },
    ];
  }

  function autoLayout() {
    if (state.nodes.length < 2) {
      showToast("至少需要兩個節點才能自動整理。");
      return;
    }

    const direction = elements.layoutDirection.value === "vertical" ? "vertical" : "horizontal";
    const levels = buildNodeLevels();
    const grouped = new Map();

    state.nodes.forEach(function (node) {
      const level = levels.get(node.id) || 0;
      if (!grouped.has(level)) {
        grouped.set(level, []);
      }
      grouped.get(level).push(node);
    });

    commitMutation(function () {
      Array.from(grouped.keys())
        .sort(function (a, b) {
          return a - b;
        })
        .forEach(function (level) {
          const nodes = grouped.get(level);
          nodes.forEach(function (node, index) {
            const cross = (index - (nodes.length - 1) / 2) * 210;
            if (direction === "horizontal") {
              node.x = level * 330;
              node.y = cross;
            } else {
              node.x = cross * 1.35;
              node.y = level * 220;
            }
          });
        });
    });

    requestAnimationFrame(function () {
      fitToBoard(false);
    });
    showToast(direction === "horizontal" ? "已由左到右整理流程。" : "已由上到下整理流程。");
  }

  function buildNodeLevels() {
    const incomingCount = new Map();
    const outgoing = new Map();

    state.nodes.forEach(function (node) {
      incomingCount.set(node.id, 0);
      outgoing.set(node.id, []);
    });

    state.edges.forEach(function (edge) {
      if (incomingCount.has(edge.to) && outgoing.has(edge.from)) {
        incomingCount.set(edge.to, incomingCount.get(edge.to) + 1);
        outgoing.get(edge.from).push(edge.to);
      }
    });

    let roots = state.nodes
      .filter(function (node) {
        return incomingCount.get(node.id) === 0;
      })
      .map(function (node) {
        return node.id;
      });

    if (roots.length === 0 && state.nodes.length > 0) {
      roots = [state.nodes[0].id];
    }

    const levels = new Map();
    const queue = roots.map(function (id) {
      return { id: id, level: 0 };
    });

    while (queue.length > 0) {
      const current = queue.shift();
      if (levels.has(current.id)) {
        continue;
      }
      levels.set(current.id, current.level);
      (outgoing.get(current.id) || []).forEach(function (targetId) {
        if (!levels.has(targetId)) {
          queue.push({ id: targetId, level: current.level + 1 });
        }
      });
    }

    let fallbackLevel = levels.size > 0 ? Math.max.apply(null, Array.from(levels.values())) + 1 : 0;
    state.nodes.forEach(function (node) {
      if (!levels.has(node.id)) {
        levels.set(node.id, fallbackLevel);
        fallbackLevel += 1;
      }
    });
    return levels;
  }

  function fitToBoard(announce) {
    const rect = elements.boardSvg.getBoundingClientRect();
    if (rect.width < 20 || rect.height < 20) {
      return;
    }

    if (state.nodes.length === 0) {
      resetViewport();
      return;
    }

    const bounds = getGraphBounds();
    const availableWidth = Math.max(120, rect.width - 130);
    const availableHeight = Math.max(120, rect.height - 170);
    const zoom = clamp(
      Math.min(availableWidth / Math.max(1, bounds.width), availableHeight / Math.max(1, bounds.height)),
      MIN_ZOOM,
      1.35
    );

    state.viewport.zoom = zoom;
    state.viewport.x = rect.width / 2 - (bounds.minX + bounds.width / 2) * zoom;
    state.viewport.y = rect.height / 2 - (bounds.minY + bounds.height / 2) * zoom + 26;
    applyViewportTransform();

    if (announce) {
      showToast("已讓完整流程適合目前畫面。");
    }
  }

  function resetViewport() {
    const rect = elements.boardSvg.getBoundingClientRect();
    state.viewport = {
      x: rect.width > 0 ? rect.width / 2 : 400,
      y: rect.height > 0 ? rect.height / 2 : 300,
      zoom: 1,
    };
    applyViewportTransform();
  }

  function getGraphBounds() {
    if (state.nodes.length === 0) {
      return { minX: 0, minY: 0, maxX: 1, maxY: 1, width: 1, height: 1 };
    }

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    state.nodes.forEach(function (node) {
      const meta = NODE_META[node.type] || NODE_META.process;
      minX = Math.min(minX, node.x - meta.width / 2);
      minY = Math.min(minY, node.y - meta.height / 2);
      maxX = Math.max(maxX, node.x + meta.width / 2);
      maxY = Math.max(maxY, node.y + meta.height / 2);
    });

    return {
      minX: minX,
      minY: minY,
      maxX: maxX,
      maxY: maxY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
    };
  }

  function zoomBy(factor) {
    const rect = elements.boardSvg.getBoundingClientRect();
    setZoomAt(state.viewport.zoom * factor, {
      x: rect.width / 2,
      y: rect.height / 2,
    });
  }

  function setZoomAt(nextZoom, point) {
    const clampedZoom = clamp(nextZoom, MIN_ZOOM, MAX_ZOOM);
    const worldPoint = svgToWorld(point);
    state.viewport.zoom = clampedZoom;
    state.viewport.x = point.x - worldPoint.x * clampedZoom;
    state.viewport.y = point.y - worldPoint.y * clampedZoom;
    applyViewportTransform();
  }

  function applyViewportTransform() {
    elements.viewportLayer.setAttribute(
      "transform",
      "translate(" +
        round(state.viewport.x) +
        " " +
        round(state.viewport.y) +
        ") scale(" +
        round(state.viewport.zoom, 4) +
        ")"
    );
    elements.zoomOutput.value = Math.round(state.viewport.zoom * 100) + "%";
    elements.zoomOutput.textContent = elements.zoomOutput.value;
  }

  function updateMetrics() {
    elements.nodeCount.textContent = String(state.nodes.length);
    elements.edgeCount.textContent = String(state.edges.length);
  }

  function updateSelectionStatus() {
    if (state.selection.kind === "node") {
      const node = getNode(state.selection.id);
      elements.selectionStatus.textContent = node
        ? "已選取節點：" + node.label
        : "尚未選取節點";
      return;
    }

    if (state.selection.kind === "edge") {
      const edge = getEdge(state.selection.id);
      if (edge) {
        const from = getNode(edge.from);
        const to = getNode(edge.to);
        elements.selectionStatus.textContent =
          "已選取連線：" +
          (from ? from.label : "起點") +
          " → " +
          (to ? to.label : "終點");
        return;
      }
    }

    elements.selectionStatus.textContent = "尚未選取節點";
  }

  function refreshSelectionVisuals() {
    elements.nodeLayer.querySelectorAll("[data-node-id]").forEach(function (group) {
      group.classList.toggle(
        "is-selected",
        state.selection.kind === "node" && state.selection.id === group.dataset.nodeId
      );
      group.classList.toggle("is-connect-source", state.connectSource === group.dataset.nodeId);
    });

    elements.edgeLayer.querySelectorAll("[data-edge-id]").forEach(function (group) {
      group.classList.toggle(
        "is-selected",
        state.selection.kind === "edge" && state.selection.id === group.dataset.edgeId
      );
    });
    updateSelectionStatus();
  }

  function getVisibleWorldCenter() {
    const rect = elements.boardSvg.getBoundingClientRect();
    return svgToWorld({ x: rect.width / 2, y: rect.height / 2 });
  }

  function clientToSvgPoint(clientX, clientY) {
    const svg = elements.boardSvg;
    const matrix = svg.getScreenCTM();
    if (matrix && typeof matrix.inverse === "function") {
      const point = svg.createSVGPoint();
      point.x = clientX;
      point.y = clientY;
      const local = point.matrixTransform(matrix.inverse());
      return { x: local.x, y: local.y };
    }

    const rect = svg.getBoundingClientRect();
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  function svgToWorld(point) {
    return {
      x: (point.x - state.viewport.x) / state.viewport.zoom,
      y: (point.y - state.viewport.y) / state.viewport.zoom,
    };
  }

  function getNode(nodeId) {
    return state.nodes.find(function (node) {
      return node.id === nodeId;
    });
  }

  function getEdge(edgeId) {
    return state.edges.find(function (edge) {
      return edge.id === edgeId;
    });
  }

  function edgeAriaLabel(edge) {
    const from = getNode(edge.from);
    const to = getNode(edge.to);
    return (
      "從「" +
      (from ? from.label : "未知節點") +
      "」連到「" +
      (to ? to.label : "未知節點") +
      "」" +
      (edge.label ? "，標籤是「" + edge.label + "」" : "")
    );
  }

  function closestDataElement(target, key) {
    if (!(target instanceof Element)) {
      return null;
    }
    const selector = key === "nodeId" ? "[data-node-id]" : "[data-edge-id]";
    return target.closest(selector);
  }

  function createSvgElement(name, attributes) {
    const element = document.createElementNS(SVG_NS, name);
    if (attributes) {
      Object.keys(attributes).forEach(function (key) {
        element.setAttribute(key, String(attributes[key]));
      });
    }
    return element;
  }

  function wrapText(value, maxUnits, maxLines) {
    const characters = Array.from(String(value || "").replace(/\s+/g, " ").trim());
    if (characters.length === 0) {
      return [];
    }

    const lines = [];
    let current = "";
    let units = 0;

    characters.forEach(function (character) {
      const characterUnits = charUnits(character);
      if (current && units + characterUnits > maxUnits) {
        lines.push(current.trim());
        current = character;
        units = characterUnits;
      } else {
        current += character;
        units += characterUnits;
      }
    });

    if (current.trim()) {
      lines.push(current.trim());
    }

    if (lines.length > maxLines) {
      const visible = lines.slice(0, maxLines);
      let last = visible[maxLines - 1];
      while (textUnits(last + "…") > maxUnits && last.length > 1) {
        last = Array.from(last).slice(0, -1).join("");
      }
      visible[maxLines - 1] = last.replace(/[，、：；,.!?。！？\s]+$/u, "") + "…";
      return visible;
    }

    return lines;
  }

  function charUnits(character) {
    if (/\s/u.test(character)) {
      return 0.35;
    }
    if (/^[\u0000-\u00ff]$/u.test(character)) {
      return 0.56;
    }
    return 1;
  }

  function textUnits(value) {
    return Array.from(String(value || "")).reduce(function (total, character) {
      return total + charUnits(character);
    }, 0);
  }

  function displayTopic() {
    return state.topic.trim() || "尚未命名的流程";
  }

  function isTypingTarget(target) {
    return (
      target instanceof HTMLInputElement ||
      target instanceof HTMLTextAreaElement ||
      target instanceof HTMLSelectElement ||
      (target instanceof HTMLElement && target.isContentEditable)
    );
  }

  function createId(prefix) {
    const randomPart =
      window.crypto && typeof window.crypto.randomUUID === "function"
        ? window.crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).slice(2);
    return prefix + "-" + randomPart;
  }

  function snap(value) {
    return Math.round(value / 12) * 12;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function round(value, precision) {
    const factor = Math.pow(10, precision || 2);
    return Math.round(value * factor) / factor;
  }

  function midpoint(first, second) {
    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  }

  function distance(first, second) {
    return Math.hypot(second.x - first.x, second.y - first.y);
  }

  function cubicPoint(start, control1, control2, end, progress) {
    const remaining = 1 - progress;
    return {
      x:
        remaining * remaining * remaining * start.x +
        3 * remaining * remaining * progress * control1.x +
        3 * remaining * progress * progress * control2.x +
        progress * progress * progress * end.x,
      y:
        remaining * remaining * remaining * start.y +
        3 * remaining * remaining * progress * control1.y +
        3 * remaining * progress * progress * control2.y +
        progress * progress * progress * end.y,
    };
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    elements.saveStatus.textContent = "儲存中...";
    saveTimer = window.setTimeout(saveLocalBoard, 420);
  }

  function saveLocalBoard() {
    const payload = {
      version: FILE_VERSION,
      topic: state.topic,
      nodes: state.nodes,
      edges: state.edges,
      savedAt: new Date().toISOString(),
    };

    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      storageAvailable = true;
      const time = new Intl.DateTimeFormat("zh-TW", {
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date());
      elements.saveStatus.textContent = "已自動儲存 " + time;
    } catch (error) {
      storageAvailable = false;
      elements.saveStatus.textContent = "無法自動儲存，請下載 JSON 備份";
    }
  }

  function restoreLocalBoard() {
    let raw;
    try {
      raw = window.localStorage.getItem(STORAGE_KEY);
    } catch (error) {
      storageAvailable = false;
      elements.saveStatus.textContent = "無法自動儲存，請下載 JSON 備份";
      return false;
    }

    if (!raw) {
      return false;
    }

    try {
      const parsed = JSON.parse(raw);
      const result = validateBoardPayload(parsed);
      if (!result.valid) {
        elements.saveStatus.textContent = "舊暫存無法讀取，已開啟新白板";
        return false;
      }
      state.topic = result.board.topic;
      state.nodes = result.board.nodes;
      state.edges = result.board.edges;
      elements.topicInput.value = state.topic;
      elements.saveStatus.textContent = "已還原上次的白板";
      return Boolean(state.topic || state.nodes.length || state.edges.length);
    } catch (error) {
      elements.saveStatus.textContent = "舊暫存無法讀取，已開啟新白板";
      return false;
    }
  }

  function validateBoardPayload(payload) {
    const source = payload && payload.board ? payload.board : payload;
    if (!source || typeof source !== "object") {
      return { valid: false, error: "檔案內容不是流程白板格式。" };
    }

    if (!Array.isArray(source.nodes) || !Array.isArray(source.edges)) {
      return { valid: false, error: "檔案缺少節點或連線資料。" };
    }

    if (source.nodes.length > 100 || source.edges.length > 240) {
      return { valid: false, error: "這份檔案超過 100 個節點或 240 條連線。" };
    }

    const nodeIds = new Set();
    const nodes = [];

    for (const rawNode of source.nodes) {
      if (!rawNode || typeof rawNode !== "object") {
        return { valid: false, error: "節點資料格式不正確。" };
      }

      const id = String(rawNode.id || "").slice(0, 120);
      const type = TYPE_KEYS.includes(rawNode.type) ? rawNode.type : "process";
      const x = Number(rawNode.x);
      const y = Number(rawNode.y);
      const label = String(rawNode.label || "").trim().slice(0, 50);
      const detail = String(rawNode.detail || "").trim().slice(0, 120);

      if (!id || nodeIds.has(id) || !Number.isFinite(x) || !Number.isFinite(y) || !label) {
        return { valid: false, error: "節點缺少有效的名稱、位置或識別碼。" };
      }

      nodeIds.add(id);
      nodes.push({
        id: id,
        type: type,
        label: label,
        detail: detail,
        x: clamp(x, -100000, 100000),
        y: clamp(y, -100000, 100000),
      });
    }

    const edgeIds = new Set();
    const edges = [];

    for (const rawEdge of source.edges) {
      if (!rawEdge || typeof rawEdge !== "object") {
        return { valid: false, error: "連線資料格式不正確。" };
      }

      const id = String(rawEdge.id || "").slice(0, 120);
      const from = String(rawEdge.from || "").slice(0, 120);
      const to = String(rawEdge.to || "").slice(0, 120);
      const label = String(rawEdge.label || "").trim().slice(0, 24);

      if (
        !id ||
        edgeIds.has(id) ||
        from === to ||
        !nodeIds.has(from) ||
        !nodeIds.has(to)
      ) {
        return { valid: false, error: "連線指向不存在的節點，或識別碼重複。" };
      }

      edgeIds.add(id);
      edges.push({ id: id, from: from, to: to, label: label });
    }

    return {
      valid: true,
      board: {
        topic: String(source.topic || "").trim().slice(0, 80),
        nodes: nodes,
        edges: edges,
      },
    };
  }

  function exportJson() {
    closeMoreMenu();
    const payload = {
      format: "vibe-coding-flow-whiteboard",
      version: FILE_VERSION,
      exportedAt: new Date().toISOString(),
      topic: state.topic,
      nodes: state.nodes,
      edges: state.edges,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    downloadBlob(blob, safeFileName(displayTopic()) + "-流程白板.json");
    showToast("JSON 備份已下載。");
  }

  async function importJsonFile(event) {
    const file = event.target.files && event.target.files[0];
    event.target.value = "";
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const result = validateBoardPayload(parsed);
      if (!result.valid) {
        showToast(result.error, true);
        return;
      }

      const before = getBoardSnapshot();
      state.topic = result.board.topic;
      state.nodes = result.board.nodes;
      state.edges = result.board.edges;
      state.selection = { kind: null, id: null };
      state.connectSource = null;
      pushUndoSnapshot(before);
      redoStack = [];
      afterBoardChange();
      requestAnimationFrame(function () {
        fitToBoard(false);
      });
      showToast("已載入 JSON 備份，原白板仍可按復原找回。");
    } catch (error) {
      showToast("無法讀取這份 JSON，原白板沒有變更。", true);
    }
  }

  function exportSvg() {
    closeMoreMenu();
    if (state.nodes.length === 0) {
      showToast("請先新增至少一個節點。", true);
      return;
    }

    const data = buildExportSvg();
    const blob = new Blob([data.svg], { type: "image/svg+xml;charset=utf-8" });
    downloadBlob(blob, safeFileName(displayTopic()) + "-流程圖.svg");
    showToast("SVG 圖片已下載。");
  }

  async function exportPng() {
    closeMoreMenu();
    if (state.nodes.length === 0) {
      showToast("請先新增至少一個節點。", true);
      return;
    }

    setExportButtonsDisabled(true);
    elements.saveStatus.textContent = "正在產生 PNG...";

    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      const data = buildExportSvg();
      const svgBlob = new Blob([data.svg], { type: "image/svg+xml;charset=utf-8" });
      const image = await loadImageFromBlob(svgBlob);
      const minimumShortSide = 1080;
      const maxLongSide = 8192;
      const baseShortSide = Math.min(data.width, data.height);
      const baseLongSide = Math.max(data.width, data.height);
      const scale = Math.min(
        Math.max(2, minimumShortSide / Math.max(1, baseShortSide)),
        maxLongSide / Math.max(1, baseLongSide)
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(data.width * scale));
      canvas.height = Math.max(1, Math.round(data.height * scale));
      const context = canvas.getContext("2d");
      context.fillStyle = "#fbfbf8";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const pngBlob = await canvasToBlob(canvas, "image/png");
      downloadBlob(pngBlob, safeFileName(displayTopic()) + "-流程圖.png");
      showToast("PNG 圖片已下載，可直接投影或繳交。");
    } catch (error) {
      showToast("PNG 產生失敗，請改下載 SVG 或 JSON 備份。", true);
    } finally {
      setExportButtonsDisabled(false);
      if (storageAvailable) {
        saveLocalBoard();
      } else {
        elements.saveStatus.textContent = "無法自動儲存，請下載 JSON 備份";
      }
    }
  }

  function buildExportSvg() {
    const bounds = getGraphBounds();
    const padding = 78;
    const provisionalWidth = Math.max(520, bounds.width + padding * 2);
    const titleLines = wrapText(displayTopic(), Math.max(18, provisionalWidth / 31), 2);
    const titleHeight = 64 + titleLines.length * 42;
    const minX = bounds.minX - padding;
    const minY = bounds.minY - padding - titleHeight;
    const width = provisionalWidth;
    const height = Math.max(420, bounds.height + padding * 2 + titleHeight);
    const centerX = minX + width / 2;
    const fontFamily = "'Microsoft JhengHei','PingFang TC','Noto Sans TC',sans-serif";

    const edgeMarkup = state.edges
      .map(function (edge) {
        const geometry = getEdgeGeometry(edge);
        if (!geometry) {
          return "";
        }
        let labelMarkup = "";
        if (edge.label) {
          const labelWidth = Math.max(34, textUnits(edge.label) * 7.2 + 18);
          labelMarkup =
            '<rect x="' +
            round(geometry.mid.x - labelWidth / 2) +
            '" y="' +
            round(geometry.mid.y - 13) +
            '" width="' +
            round(labelWidth) +
            '" height="26" rx="8" fill="#fffefa" stroke="#c7cbc5"/>' +
            '<text x="' +
            round(geometry.mid.x) +
            '" y="' +
            round(geometry.mid.y + 4) +
            '" text-anchor="middle" font-family="' +
            fontFamily +
            '" font-size="12" font-weight="700" fill="#3e4742">' +
            escapeXml(edge.label) +
            "</text>";
        }
        return (
          '<g><path d="' +
          geometry.path +
          '" fill="none" stroke="#59635d" stroke-width="2.7" stroke-linecap="round" marker-end="url(#exportArrow)"/>' +
          labelMarkup +
          "</g>"
        );
      })
      .join("");

    const nodeMarkup = state.nodes.map(serializeNodeForExport).join("");
    const titleMarkup = titleLines
      .map(function (line, index) {
        return (
          '<tspan x="' +
          round(centerX) +
          '" y="' +
          round(minY + 49 + index * 42) +
          '">' +
          escapeXml(line) +
          "</tspan>"
        );
      })
      .join("");
    const subtitleY = minY + 49 + titleLines.length * 42;

    const svg =
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<svg xmlns="http://www.w3.org/2000/svg" width="' +
      round(width) +
      '" height="' +
      round(height) +
      '" viewBox="' +
      [round(minX), round(minY), round(width), round(height)].join(" ") +
      '">' +
      "<defs>" +
      '<marker id="exportArrow" viewBox="0 0 10 10" refX="8.6" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">' +
      '<path d="M 0 0 L 10 5 L 0 10 z" fill="#59635d"/>' +
      "</marker>" +
      "</defs>" +
      '<rect x="' +
      round(minX) +
      '" y="' +
      round(minY) +
      '" width="' +
      round(width) +
      '" height="' +
      round(height) +
      '" fill="#fbfbf8"/>' +
      '<text text-anchor="middle" font-family="' +
      fontFamily +
      '" font-size="34" font-weight="800" fill="#1e2421">' +
      titleMarkup +
      "</text>" +
      '<text x="' +
      round(centerX) +
      '" y="' +
      round(subtitleY) +
      '" text-anchor="middle" font-family="' +
      fontFamily +
      '" font-size="12" font-weight="700" letter-spacing="1.6" fill="#a33c1c">VIBE CODING 流程圖</text>' +
      edgeMarkup +
      nodeMarkup +
      "</svg>";

    return { svg: svg, width: width, height: height };
  }

  function serializeNodeForExport(node) {
    const meta = NODE_META[node.type] || NODE_META.process;
    const layout = getNodeTextLayout(node);
    const fontFamily = "'Microsoft JhengHei','PingFang TC','Noto Sans TC',sans-serif";
    const mainFill =
      node.type === "result"
        ? "#fde6dc"
        : node.type === "note"
          ? "#fff1bd"
          : node.type === "start"
            ? "#f1f2ed"
            : "#fffefa";
    const stroke = node.type === "result" ? "#d9572b" : "#4b554f";
    const strokeWidth = node.type === "result" ? 2.8 : 2.2;
    const shadow = serializeNodeShape(node, "#28312c", "none", 0, " translate(0 6)", ' opacity="0.10"');
    const shape = serializeNodeShape(node, mainFill, stroke, strokeWidth, "", "");
    const fold =
      node.type === "note"
        ? '<path d="M 82 61 L 82 38 L 106 38" fill="none" stroke="#4b554f" stroke-width="2"/>'
        : "";
    const labelTspans = serializeTspans(
      layout.labelLines,
      layout.labelStartY,
      layout.labelLineHeight
    );
    const detailTspans = serializeTspans(
      layout.detailLines,
      layout.detailStartY,
      layout.detailLineHeight
    );

    return (
      '<g transform="translate(' +
      round(node.x) +
      " " +
      round(node.y) +
      ')">' +
      shadow +
      shape +
      fold +
      '<text x="0" y="' +
      round(layout.typeY) +
      '" text-anchor="middle" font-family="' +
      fontFamily +
      '" font-size="10" font-weight="700" letter-spacing="1" fill="#68716c">' +
      escapeXml(meta.typeLabel) +
      "</text>" +
      '<text x="0" y="' +
      round(layout.labelStartY) +
      '" text-anchor="middle" font-family="' +
      fontFamily +
      '" font-size="17" font-weight="800" fill="#1e2421">' +
      labelTspans +
      "</text>" +
      (detailTspans
        ? '<text x="0" y="' +
          round(layout.detailStartY) +
          '" text-anchor="middle" font-family="' +
          fontFamily +
          '" font-size="11.5" font-weight="500" fill="#59645e">' +
          detailTspans +
          "</text>"
        : "") +
      "</g>"
    );
  }

  function serializeNodeShape(node, fill, stroke, strokeWidth, transform, extraAttributes) {
    const meta = NODE_META[node.type] || NODE_META.process;
    const halfWidth = meta.width / 2;
    const halfHeight = meta.height / 2;
    const transformAttribute = transform ? ' transform="' + transform.trim() + '"' : "";
    const common =
      ' fill="' +
      fill +
      '" stroke="' +
      stroke +
      '" stroke-width="' +
      strokeWidth +
      '"' +
      transformAttribute +
      (extraAttributes || "");

    if (node.type === "decision") {
      return (
        '<polygon points="0,' +
        -halfHeight +
        " " +
        halfWidth +
        ",0 0," +
        halfHeight +
        " " +
        -halfWidth +
        ',0"' +
        common +
        "/>"
      );
    }

    if (node.type === "note") {
      return (
        '<polygon points="' +
        -halfWidth +
        "," +
        -halfHeight +
        " " +
        (halfWidth - 24) +
        "," +
        -halfHeight +
        " " +
        halfWidth +
        "," +
        (-halfHeight + 24) +
        " " +
        halfWidth +
        "," +
        halfHeight +
        " " +
        -halfWidth +
        "," +
        halfHeight +
        '"' +
        common +
        "/>"
      );
    }

    const radius = node.type === "start" || node.type === "result" ? halfHeight : 14;
    return (
      '<rect x="' +
      -halfWidth +
      '" y="' +
      -halfHeight +
      '" width="' +
      meta.width +
      '" height="' +
      meta.height +
      '" rx="' +
      radius +
      '"' +
      common +
      "/>"
    );
  }

  function serializeTspans(lines, startY, lineHeight) {
    return lines
      .map(function (line, index) {
        return (
          '<tspan x="0" y="' +
          round(startY + index * lineHeight) +
          '">' +
          escapeXml(line) +
          "</tspan>"
        );
      })
      .join("");
  }

  function loadImageFromBlob(blob) {
    return new Promise(function (resolve, reject) {
      const url = URL.createObjectURL(blob);
      const image = new Image();
      image.onload = function () {
        URL.revokeObjectURL(url);
        resolve(image);
      };
      image.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error("SVG image load failed"));
      };
      image.src = url;
    });
  }

  function canvasToBlob(canvas, type) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Canvas export failed"));
        }
      }, type);
    });
  }

  function setExportButtonsDisabled(disabled) {
    [elements.exportPngButton, elements.previewExportButton].forEach(function (button) {
      button.disabled = disabled;
    });
  }

  function downloadBlob(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1200);
  }

  function safeFileName(value) {
    const cleaned = String(value || "流程圖")
      .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 60);
    return cleaned || "流程圖";
  }

  function escapeXml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function openShareDialog() {
    if (window.location.protocol === "file:") {
      showToast("離線版可以繼續編輯，公開分享請使用 calumai.com 上線版。", true);
      return;
    }
    if (state.nodes.length === 0) {
      showToast("請先新增至少一個節點再分享。", true);
      return;
    }
    if (!state.topic.trim()) {
      showToast("請先為流程填寫一個主題。", true);
      elements.topicInput.focus();
      return;
    }

    elements.shareTopic.textContent = displayTopic();
    elements.shareNodeCount.textContent = String(state.nodes.length);
    elements.shareEdgeCount.textContent = String(state.edges.length);
    elements.shareStatus.textContent = shareIdentity
      ? "再次分享會更新你先前公開的這份作品。"
      : "這是公開頁面，送出前請再確認內容沒有個人資料。";
    elements.shareStatus.className = "share-status";
    elements.shareSuccessActions.hidden = true;
    elements.removeSharedBoardButton.hidden = !shareIdentity;
    elements.removeSharedBoardButton.disabled = false;
    elements.submitShareButton.disabled = false;
    elements.submitShareButton.textContent = shareIdentity ? "更新公開作品" : "公開分享";
    openDialog(elements.shareDialog);
    window.setTimeout(function () {
      elements.authorNameInput.focus();
    }, 0);
  }

  async function submitShare(event) {
    event.preventDefault();
    const authorName = elements.authorNameInput.value.trim().slice(0, 24);
    if (!authorName) {
      elements.authorNameInput.setCustomValidity("請填寫公開暱稱。");
      elements.authorNameInput.reportValidity();
      return;
    }
    elements.authorNameInput.setCustomValidity("");
    if (state.nodes.length === 0 || !state.topic.trim()) {
      setShareStatus("流程缺少主題或節點，請關閉視窗後補齊。", "error");
      return;
    }

    elements.submitShareButton.disabled = true;
    elements.submitShareButton.textContent = "正在分享...";
    elements.shareSuccessActions.hidden = true;
    setShareStatus("正在安全傳送作品，請不要關閉頁面。", "");

    try {
      const clientId = getClientId();
      let result;
      if (shareIdentity) {
        result = await requestBoardApi(
          BOARD_API_PATH + "/" + encodeURIComponent(shareIdentity.boardId),
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              "X-Vibe-Client": clientId,
              "X-Vibe-Edit-Token": shareIdentity.editToken,
            },
            body: JSON.stringify(createSharePayload(authorName, false)),
          }
        );
      } else {
        if (!pendingShareIdentity) {
          pendingShareIdentity = createShareIdentity();
        }
        result = await requestBoardApi(BOARD_API_PATH, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Vibe-Client": clientId,
          },
          body: JSON.stringify(createSharePayload(authorName, true)),
        });
        shareIdentity = pendingShareIdentity;
        persistShareIdentity(shareIdentity);
        pendingShareIdentity = null;
      }

      const boardId =
        result && result.board && result.board.id
          ? String(result.board.id)
          : shareIdentity.boardId;
      elements.viewSharedBoardLink.href = "gallery/?board=" + encodeURIComponent(boardId);
      elements.shareSuccessActions.hidden = false;
      elements.submitShareButton.textContent = "再次更新";
      setShareStatus("分享成功。作品已出現在公開作品牆。", "success");
      showToast("作品已分享到公開作品牆。");
    } catch (error) {
      const message = error && error.message ? error.message : "分享失敗，請稍後再試。";
      setShareStatus(message, "error");
      elements.submitShareButton.textContent = shareIdentity ? "重新更新" : "重新分享";
    } finally {
      elements.submitShareButton.disabled = false;
    }
  }

  async function removeSharedBoard() {
    if (!shareIdentity) {
      return;
    }
    const confirmed = window.confirm(
      "確定要把這份作品從公開作品牆移除嗎？你的本機白板會完整保留。"
    );
    if (!confirmed) {
      return;
    }

    elements.removeSharedBoardButton.disabled = true;
    elements.submitShareButton.disabled = true;
    setShareStatus("正在從公開作品牆移除，白板內容會保留在這台裝置。", "");
    try {
      await requestBoardApi(
        BOARD_API_PATH + "/" + encodeURIComponent(shareIdentity.boardId),
        {
          method: "DELETE",
          headers: {
            "X-Vibe-Client": getClientId(),
            "X-Vibe-Edit-Token": shareIdentity.editToken,
          },
        }
      );
      shareIdentity = null;
      pendingShareIdentity = null;
      clearShareIdentity();
      elements.removeSharedBoardButton.hidden = true;
      elements.shareSuccessActions.hidden = true;
      elements.submitShareButton.textContent = "重新公開分享";
      setShareStatus("已從作品牆移除。本機白板仍然完整保留。", "success");
      showToast("作品已從公開作品牆移除，白板仍保留。");
    } catch (error) {
      setShareStatus(error.message || "移除失敗，請稍後再試。", "error");
    } finally {
      elements.removeSharedBoardButton.disabled = false;
      elements.submitShareButton.disabled = false;
    }
  }

  function createSharePayload(authorName, includeIdentity) {
    const payload = {
      author_name: authorName,
      topic: state.topic.trim().slice(0, 80),
      nodes: cloneData(state.nodes),
      edges: cloneData(state.edges),
    };
    if (includeIdentity) {
      payload.board_id = pendingShareIdentity.boardId;
      payload.edit_token = pendingShareIdentity.editToken;
    }
    return payload;
  }

  async function requestBoardApi(path, options) {
    const controller = new AbortController();
    const timeout = window.setTimeout(function () {
      controller.abort();
    }, API_TIMEOUT_MS);
    try {
      const response = await fetch(path, Object.assign({}, options, { signal: controller.signal }));
      let body = null;
      try {
        body = await response.json();
      } catch (error) {
        body = null;
      }
      if (!response.ok || !body || body.ok === false) {
        const apiMessage =
          body && body.error && typeof body.error.message === "string"
            ? body.error.message
            : "伺服器暫時無法接受作品（HTTP " + response.status + "）。";
        throw new Error(apiMessage);
      }
      return body;
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error("分享逾時，請確認網路後重新傳送。");
      }
      if (error instanceof TypeError) {
        throw new Error("無法連上作品牆，請確認網路後重新傳送。");
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function createShareIdentity() {
    return {
      boardId: "vb_" + createSecureRandomBase64Url(16),
      editToken: "ve_" + createSecureRandomBase64Url(32),
    };
  }

  function createUuid() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    if (!window.crypto || typeof window.crypto.getRandomValues !== "function") {
      throw new Error("這個瀏覽器不支援安全分享，請改用最新版瀏覽器。");
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

  function createSecureRandomBase64Url(byteLength) {
    if (!window.crypto || typeof window.crypto.getRandomValues !== "function") {
      throw new Error("這個瀏覽器不支援安全分享，請改用最新版瀏覽器。");
    }
    const bytes = new Uint8Array(byteLength);
    window.crypto.getRandomValues(bytes);
    let binary = "";
    bytes.forEach(function (value) {
      binary += String.fromCharCode(value);
    });
    return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
  }

  function restoreShareIdentity() {
    try {
      const raw = window.localStorage.getItem(SHARE_IDENTITY_KEY);
      if (!raw) {
        return null;
      }
      const parsed = JSON.parse(raw);
      if (
        !parsed ||
        typeof parsed.boardId !== "string" ||
        typeof parsed.editToken !== "string" ||
        !/^vb_[A-Za-z0-9_-]{22}$/u.test(parsed.boardId) ||
        !/^ve_[A-Za-z0-9_-]{43}$/u.test(parsed.editToken)
      ) {
        return null;
      }
      return { boardId: parsed.boardId, editToken: parsed.editToken };
    } catch (error) {
      return null;
    }
  }

  function persistShareIdentity(identity) {
    try {
      window.localStorage.setItem(
        SHARE_IDENTITY_KEY,
        JSON.stringify({ boardId: identity.boardId, editToken: identity.editToken })
      );
    } catch (error) {
      showToast("作品已分享，但這個瀏覽器無法保存更新權限。請勿清除頁面資料。", true);
    }
  }

  function clearShareIdentity() {
    try {
      window.localStorage.removeItem(SHARE_IDENTITY_KEY);
    } catch (error) {
      // The in-memory identity is still cleared for this session.
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

  function setShareStatus(message, kind) {
    elements.shareStatus.textContent = message;
    elements.shareStatus.className = "share-status";
    if (kind) {
      elements.shareStatus.classList.add("is-" + kind);
    }
  }

  function openPresentation() {
    if (state.nodes.length === 0) {
      showToast("請先新增至少一個節點。", true);
      return;
    }
    elements.presentationTitle.textContent = displayTopic();
    renderStaticDiagram(elements.presentationSvg, "presentationArrow");
    openDialog(elements.presentationDialog);
    setTimeout(function () {
      elements.closePresentationButton.focus();
    }, 0);
  }

  async function enterFullscreen() {
    if (!elements.presentationDialog.requestFullscreen) {
      showToast("這個瀏覽器不支援全螢幕，展示畫面仍可正常使用。", true);
      return;
    }
    try {
      await elements.presentationDialog.requestFullscreen();
    } catch (error) {
      showToast("瀏覽器沒有允許全螢幕，展示畫面仍可正常使用。", true);
    }
  }

  async function closePresentation() {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (error) {
        // The browser may already be leaving fullscreen.
      }
    }
    closeDialog(elements.presentationDialog);
    elements.presentButton.focus();
  }

  function showToast(message, isError) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.toggle("is-error", Boolean(isError));
    elements.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(function () {
      elements.toast.classList.remove("is-visible");
    }, 2800);
  }
})();
