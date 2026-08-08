(() => {
  "use strict";

  const episodeGrid = document.querySelector("[data-episode-grid]");
  if (!episodeGrid) return;

  const countNodes = document.querySelectorAll("[data-episode-count]");
  const progressNode = document.querySelector("[data-course-progress]");
  const searchInput = document.querySelector("[data-episode-search]");
  const latestCard = document.querySelector("[data-latest-card]");
  const firstLessonLink = document.querySelector("[data-first-lesson]");
  const dialog = document.querySelector("[data-video-dialog]");
  const dialogTitle = dialog?.querySelector("[data-dialog-title]");
  const dialogFrame = dialog?.querySelector("iframe");
  const dialogClose = dialog?.querySelector("[data-dialog-close]");

  let episodes = [];
  const fallbackCover = "../assets/calumai-logo-mark.png";
  const tracks = [
    { id: "intro", label: "導論", description: "先建立 AI 備課的基本觀念與安全感。" },
    { id: "chatgpt", label: "ChatGPT", description: "練習把備課、活動、學習單交給 ChatGPT 協助。" },
    { id: "gemini", label: "Gemini", description: "用 Gemini 做教材整理、活動發想與 Google 生態系備課。" },
    { id: "notebooklm", label: "NotebookLM / Gemini Book", description: "把講義、文本與資料整理成可查詢的備課筆記。" },
    { id: "other", label: "其他", description: "尚未歸到固定路線的 AI100 內容。" }
  ];

  const escapeHtml = (value = "") => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  const getTrack = (episode = {}) => {
    const raw = String(episode.track || "").trim().toLowerCase();
    const found = tracks.find((track) => track.id === raw);
    if (found) return found;

    const text = `${episode.title || ""} ${episode.summary || ""}`.toLowerCase();
    if (text.includes("notebook") || text.includes("gemini book")) return tracks.find((track) => track.id === "notebooklm");
    if (text.includes("gemini")) return tracks.find((track) => track.id === "gemini");
    if (text.includes("chatgpt") || text.includes("chat gpt")) return tracks.find((track) => track.id === "chatgpt");
    return tracks.find((track) => track.id === "intro");
  };

  const getToolTag = (episodeOrTitle = "") => {
    if (typeof episodeOrTitle === "object" && episodeOrTitle) {
      return episodeOrTitle.trackLabel || getTrack(episodeOrTitle).label;
    }

    const text = String(episodeOrTitle).toLowerCase();
    if (text.includes("notebook")) return "NotebookLM";
    if (text.includes("gemini")) return "Gemini";
    if (text.includes("chatgpt")) return "ChatGPT";
    return "導論";
  };

  const hasVideo = (episode) => Boolean(episode?.embedUrl) && episode?.contentType !== "handout";
  const cleanSummary = (summary = "") => summary.replace(/\s+/g, " ").trim();

  const handoutUrl = (episode) => {
    const handoutName = (episode.handoutFile || "").replace(/\.md$/i, ".html");
    return handoutName ? `./handouts/${encodeURIComponent(handoutName)}` : "./";
  };

  const coverUrl = (episode) => {
    const file = String(episode.coverFile || "").trim();
    return file ? `./covers/${encodeURIComponent(file)}` : fallbackCover;
  };

  const fallbackImage = (image) => {
    if (!image || image.dataset.fallbackReady === "true") return;
    image.dataset.fallbackReady = "true";
    image.addEventListener("error", () => {
      if (image.src.endsWith("/assets/calumai-logo-mark.png")) return;
      image.src = fallbackCover;
      image.classList.add("is-fallback-cover");
    });
  };

  const renderCard = (episode, index) => {
    const isLatest = index === episodes.length - 1;
    const tag = getToolTag(episode);
    const videoLesson = hasVideo(episode);
    const contentKind = episode.contentLabel || (videoLesson ? "影片課程" : "圖文講義");
    const searchText = `${episode.id} ${episode.title} ${episode.summary} ${tag} ${contentKind}`.toLowerCase();
    const cover = `
          <img src="${escapeHtml(coverUrl(episode))}" alt="${escapeHtml(episode.title)} 封面" loading="lazy">
          <span class="episode-play${videoLesson ? "" : " episode-read"}" aria-hidden="true"><i data-lucide="${videoLesson ? "play" : "book-open"}"></i></span>`;
    const coverLink = videoLesson
      ? `<button class="episode-cover-button" type="button" data-play-episode="${escapeHtml(episode.id)}" aria-label="播放 ${escapeHtml(episode.title)}">${cover}</button>`
      : `<a class="episode-cover-button" href="${escapeHtml(handoutUrl(episode))}" aria-label="閱讀 ${escapeHtml(episode.title)}">${cover}</a>`;
    const watchAction = videoLesson
      ? `<button class="episode-watch" type="button" data-play-episode="${escapeHtml(episode.id)}">
              <i data-lucide="play"></i>觀看影片
            </button>`
      : "";
    const captionAction = episode.srtFile
      ? `<a class="episode-link" href="./captions/${escapeHtml(episode.srtFile)}" download>
              <i data-lucide="captions"></i>字幕
            </a>`
      : "";

    return `
      <article class="episode-card" data-search-text="${escapeHtml(searchText)}">
        ${coverLink}
        <div class="episode-card-body">
          <div class="episode-meta">
            <span class="episode-number">${escapeHtml(episode.id)}${isLatest ? " · 最新" : ""}</span>
            <span class="episode-tag">${escapeHtml(tag)}</span>
          </div>
          <h3>${escapeHtml(episode.title)}</h3>
          <p class="episode-summary">${escapeHtml(cleanSummary(episode.summary))}</p>
          <div class="episode-actions">
            ${watchAction}
            <a class="episode-link" href="${escapeHtml(handoutUrl(episode))}">
              <i data-lucide="book-open"></i>閱讀講義
            </a>
            ${captionAction}
          </div>
        </div>
      </article>`;
  };

  const renderEpisodes = (items) => {
    if (!items.length) {
      episodeGrid.innerHTML = '<div class="course-empty">目前找不到符合條件的 AI-100 內容。</div>';
      return;
    }

    const sections = tracks.map((track) => {
      const trackItems = items.filter((episode) => getTrack(episode).id === track.id);
      if (!trackItems.length) return "";

      return `
        <section class="episode-track-section" id="track-${escapeHtml(track.id)}">
          <div class="episode-track-head">
            <div>
              <p class="course-eyebrow">${escapeHtml(track.label)}</p>
              <h3>${escapeHtml(track.label)} 路線</h3>
              <p>${escapeHtml(track.description)}</p>
            </div>
            <span class="episode-track-count">${trackItems.length} 篇</span>
          </div>
          <div class="episode-grid">
            ${trackItems.map((episode) => renderCard(episode, episodes.indexOf(episode))).join("")}
          </div>
        </section>`;
    }).join("");

    episodeGrid.innerHTML = sections;
    episodeGrid.querySelectorAll("img").forEach(fallbackImage);
    window.lucide?.createIcons();
  };

  const updateLatestCard = () => {
    const latest = episodes.at(-1);
    if (!latest || !latestCard) return;

    const image = latestCard.querySelector("img");
    const number = latestCard.querySelector("[data-latest-number]");
    const title = latestCard.querySelector("[data-latest-title]");
    const summary = latestCard.querySelector("[data-latest-summary]");
    const playButton = latestCard.querySelector("[data-play-episode]");

    if (image) {
      fallbackImage(image);
      image.src = coverUrl(latest);
      image.alt = `${latest.title} 封面`;
    }
    if (number) number.textContent = latest.id;
    if (title) title.textContent = latest.title;
    if (summary) summary.textContent = cleanSummary(latest.summary);
    if (playButton && hasVideo(latest)) playButton.dataset.playEpisode = latest.id;
  };

  const updateCourseStats = () => {
    countNodes.forEach((node) => {
      node.textContent = String(episodes.length);
    });

    if (progressNode) {
      const percentage = Math.max(2, Math.min(100, (episodes.length / 100) * 100));
      progressNode.style.width = `${percentage}%`;
    }

    const first = episodes[0];
    if (first && firstLessonLink) firstLessonLink.href = handoutUrl(first);
  };

  const openVideo = (episodeId) => {
    const episode = episodes.find((item) => item.id === episodeId);
    if (!episode || !hasVideo(episode) || !dialog || !dialogFrame) return;

    dialogTitle.textContent = `${episode.id}｜${episode.title}`;
    const separator = episode.embedUrl.includes("?") ? "&" : "?";
    dialogFrame.src = `${episode.embedUrl}${separator}autoplay=1&rel=0`;
    dialogFrame.title = episode.title;

    if (typeof dialog.showModal === "function") {
      dialog.showModal();
    } else {
      window.open(episode.embedUrl.replace("/embed/", "/watch?v="), "_blank", "noopener,noreferrer");
    }
  };

  const closeVideo = () => {
    if (!dialog) return;
    if (dialog.open) dialog.close();
    if (dialogFrame) dialogFrame.src = "about:blank";
  };

  episodeGrid.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-play-episode]");
    if (trigger) openVideo(trigger.dataset.playEpisode);
  });

  latestCard?.addEventListener("click", (event) => {
    const trigger = event.target.closest("[data-play-episode]");
    if (trigger) openVideo(trigger.dataset.playEpisode);
  });

  searchInput?.addEventListener("input", () => {
    const keyword = searchInput.value.trim().toLowerCase();
    const filtered = keyword
      ? episodes.filter((episode) => `${episode.id} ${episode.title} ${episode.summary} ${getToolTag(episode)} ${episode.track || ""} ${episode.contentLabel || ""}`.toLowerCase().includes(keyword))
      : episodes;
    renderEpisodes(filtered);
  });

  dialogClose?.addEventListener("click", closeVideo);
  dialog?.addEventListener("click", (event) => {
    const bounds = dialog.getBoundingClientRect();
    const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (outside) closeVideo();
  });
  dialog?.addEventListener("close", () => {
    if (dialogFrame) dialogFrame.src = "about:blank";
  });

  fetch("./episodes.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .then((data) => {
      episodes = Array.isArray(data) ? data : [];
      episodes.sort((a, b) => String(a.id).localeCompare(String(b.id), "zh-Hant", { numeric: true }));
      updateCourseStats();
      updateLatestCard();
      renderEpisodes(episodes);
    })
    .catch((error) => {
      console.error("Unable to load episodes", error);
      episodeGrid.innerHTML = '<div class="course-empty">AI-100 內容暫時載入失敗，請稍後再試。</div>';
    });
})();
