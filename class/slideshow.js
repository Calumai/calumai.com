const params = new URLSearchParams(location.search);
const id = (params.get('lesson') || '01').padStart(2, '0');
const embedded = params.get('embed') === '1';
const assetVersion = id === '04' ? '?v=20260901a' : '';
const total = ({ '01': 9, '02': 12, '03': 12, '04': 44 })[id] || 8;
const lessonTitles = {
  '01': 'Gemini Notebook 遊戲化 RPG 簡報',
  '02': 'Vibe Coding 互動測驗',
  '03': 'Gemini 與 GAS 測驗成績系統',
  '04': 'Google Apps Script 網頁部署'
};
const player = document.querySelector('#player');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

document.documentElement.classList.toggle('is-embedded', embedded);
player.tabIndex = 0;
player.setAttribute('role', 'region');
player.setAttribute('aria-label', `第 ${id} 堂投影片播放器，共 ${total} 張`);

let current = 0;
let timer = null;
let touchStartX = 0;
let retryToken = 0;
let hintTimer = null;

function slideSource(index, retry = false) {
  const number = String(index + 1).padStart(2, '0');
  const source = `/class/ppt-preview/${id}/slide-${number}.png${assetVersion}`;
  if (!retry) return source;
  return `${source}${source.includes('?') ? '&' : '?'}retry=${Date.now()}-${retryToken}`;
}

const topbar = document.createElement('div');
topbar.className = 'topbar';
topbar.innerHTML = `
  <a class="back" href="/class/lesson-${id}.html#slides" target="_top">回到課程頁</a>
  <div class="deck-meta">
    <strong>${lessonTitles[id] || `第 ${id} 堂投影片`}</strong>
    <span class="counter" role="status" aria-live="polite"></span>
  </div>`;

const stage = document.createElement('section');
stage.className = 'stage';
stage.setAttribute('aria-label', '目前投影片');
stage.setAttribute('aria-describedby', 'player-hint');

const slides = Array.from({ length: total }, (_, index) => {
  const image = document.createElement('img');
  image.className = 'slide';
  image.dataset.src = slideSource(index);
  image.alt = `第 ${id} 堂第 ${index + 1} 張投影片`;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.draggable = false;
  image.setAttribute('aria-hidden', 'true');
  image.addEventListener('load', () => {
    image.dataset.ready = 'true';
    delete image.dataset.failed;
    if (index === current) showReadyState();
  });
  image.addEventListener('error', () => {
    image.dataset.failed = 'true';
    delete image.dataset.ready;
    if (index === current) showErrorState();
  });
  stage.appendChild(image);
  return image;
});

const loading = document.createElement('div');
loading.className = 'loading-state';
loading.setAttribute('role', 'status');
loading.innerHTML = '<span>投影片載入中</span><i aria-hidden="true"></i>';
stage.appendChild(loading);

const errorState = document.createElement('div');
errorState.className = 'error-state';
errorState.hidden = true;
errorState.innerHTML = '<strong>這張投影片暫時無法載入</strong><span>請檢查網路後再試一次。</span><button type="button" data-action="retry">重新載入</button>';
stage.appendChild(errorState);

const thumbnailPanel = document.createElement('div');
thumbnailPanel.className = 'thumbnail-panel';
thumbnailPanel.hidden = true;
thumbnailPanel.setAttribute('role', 'region');
thumbnailPanel.setAttribute('aria-label', '投影片縮圖總覽');

const thumbnailTrack = document.createElement('div');
thumbnailTrack.className = 'thumbnail-track';
const thumbnails = Array.from({ length: total }, (_, index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'thumbnail';
  button.dataset.slide = String(index);
  button.setAttribute('aria-label', `前往第 ${index + 1} 張投影片`);
  const image = document.createElement('img');
  image.src = slideSource(index);
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.draggable = false;
  const number = document.createElement('span');
  number.textContent = String(index + 1);
  button.append(image, number);
  thumbnailTrack.appendChild(button);
  return button;
});
thumbnailPanel.appendChild(thumbnailTrack);
stage.appendChild(thumbnailPanel);

const footer = document.createElement('div');
footer.className = 'player-footer';
footer.innerHTML = `
  <div class="controls" role="group" aria-label="投影片播放控制">
    <div class="transport">
      <button type="button" data-action="prev" aria-label="上一張"><span aria-hidden="true">←</span><span class="control-label">上一張</span></button>
      <button type="button" class="play-button" data-action="play" aria-label="開始自動播放" aria-pressed="false"><span class="play-symbol" aria-hidden="true">▶</span><span class="control-label">播放</span></button>
      <button type="button" data-action="next" aria-label="下一張"><span class="control-label">下一張</span><span aria-hidden="true">→</span></button>
    </div>
    <label class="timeline"><span class="sr-only">投影片進度</span><input type="range" min="1" max="${total}" value="1" step="1" aria-label="投影片進度"><output>1 / ${total}</output></label>
    <div class="utilities">
      <button type="button" data-action="thumbnails" aria-label="開啟投影片縮圖" aria-expanded="false"><span aria-hidden="true">▦</span><span class="control-label">縮圖</span></button>
      <button type="button" data-action="full" aria-label="進入全螢幕"><span aria-hidden="true">⛶</span><span class="control-label">全螢幕</span></button>
    </div>
  </div>
  <p class="hint" id="player-hint">左右鍵、空白鍵翻頁，Home 和 End 跳到首尾，F 切換全螢幕</p>`;

player.append(topbar, stage, footer);

const counter = topbar.querySelector('.counter');
const progress = footer.querySelector('input[type="range"]');
const progressOutput = footer.querySelector('output');
const previousButton = footer.querySelector('[data-action="prev"]');
const nextButton = footer.querySelector('[data-action="next"]');
const playButton = footer.querySelector('[data-action="play"]');
const thumbnailButton = footer.querySelector('[data-action="thumbnails"]');
const fullscreenButton = footer.querySelector('[data-action="full"]');
const hint = footer.querySelector('.hint');
const defaultHint = hint.textContent;

function showLoadingState() {
  loading.hidden = false;
  errorState.hidden = true;
}

function showReadyState() {
  loading.hidden = true;
  errorState.hidden = true;
}

function showErrorState() {
  loading.hidden = true;
  errorState.hidden = false;
}

function load(index, priority = false, retry = false) {
  if (index < 0 || index >= total) return;
  const image = slides[index];
  if (retry) {
    retryToken += 1;
    image.removeAttribute('src');
    delete image.dataset.ready;
    delete image.dataset.failed;
  }
  if (!image.getAttribute('src')) {
    if (priority) image.fetchPriority = 'high';
    image.src = retry ? slideSource(index, true) : image.dataset.src;
  }
  if (priority && image.complete) {
    if (image.naturalWidth > 0) showReadyState();
    else showErrorState();
  }
}

function show(index) {
  current = Math.max(0, Math.min(total - 1, index));
  const activeImage = slides[current];

  slides.forEach((slide, slideIndex) => {
    const active = slideIndex === current;
    slide.classList.toggle('active', active);
    slide.setAttribute('aria-hidden', String(!active));
  });
  thumbnails.forEach((thumbnail, slideIndex) => {
    const active = slideIndex === current;
    thumbnail.classList.toggle('active', active);
    if (active) thumbnail.setAttribute('aria-current', 'true');
    else thumbnail.removeAttribute('aria-current');
  });

  counter.textContent = `第 ${current + 1} / ${total} 張`;
  progress.value = String(current + 1);
  progressOutput.value = `${current + 1} / ${total}`;
  progressOutput.textContent = `${current + 1} / ${total}`;
  previousButton.disabled = current === 0;
  nextButton.disabled = current === total - 1;
  document.title = `第 ${id} 堂｜第 ${current + 1} 張｜CALUMAI`;

  if (activeImage.dataset.ready === 'true') showReadyState();
  else if (activeImage.dataset.failed === 'true') showErrorState();
  else showLoadingState();

  load(current, true);
  load(current + 1);
  load(current - 1);

  if (!thumbnailPanel.hidden) {
    thumbnails[current].scrollIntoView({
      behavior: reduceMotion.matches ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center'
    });
  }
}

function stopPlayback() {
  if (timer) window.clearInterval(timer);
  timer = null;
  playButton.setAttribute('aria-pressed', 'false');
  playButton.setAttribute('aria-label', '開始自動播放');
  playButton.querySelector('.play-symbol').textContent = '▶';
  playButton.querySelector('.control-label').textContent = '播放';
}

function startPlayback() {
  if (current === total - 1) show(0);
  timer = window.setInterval(() => {
    show(current + 1);
    if (current >= total - 1) stopPlayback();
  }, 6000);
  playButton.setAttribute('aria-pressed', 'true');
  playButton.setAttribute('aria-label', '暫停自動播放');
  playButton.querySelector('.play-symbol').textContent = 'Ⅱ';
  playButton.querySelector('.control-label').textContent = '暫停';
}

function togglePlayback() {
  if (timer) stopPlayback();
  else startPlayback();
}

function toggleThumbnails() {
  const willOpen = thumbnailPanel.hidden;
  thumbnailPanel.hidden = !willOpen;
  thumbnailButton.setAttribute('aria-expanded', String(willOpen));
  thumbnailButton.setAttribute('aria-label', willOpen ? '關閉投影片縮圖' : '開啟投影片縮圖');
  if (willOpen) {
    window.requestAnimationFrame(() => thumbnails[current].scrollIntoView({ block: 'nearest', inline: 'center' }));
  }
}

function flashHint(message) {
  window.clearTimeout(hintTimer);
  hint.textContent = message;
  hintTimer = window.setTimeout(() => {
    hint.textContent = defaultHint;
  }, 3200);
}

async function toggleFullscreen() {
  try {
    const fullscreenElement = document.fullscreenElement || document.webkitFullscreenElement;
    if (!fullscreenElement) {
      const request = player.requestFullscreen || player.webkitRequestFullscreen;
      if (!request) throw new Error('fullscreen-unavailable');
      await request.call(player);
    } else {
      const exit = document.exitFullscreen || document.webkitExitFullscreen;
      if (!exit) throw new Error('fullscreen-unavailable');
      await exit.call(document);
    }
    window.setTimeout(updateFullscreenButton, 350);
  } catch (error) {
    flashHint('瀏覽器未允許全螢幕，請使用「另開大畫面播放器」。');
  }
}

function updateFullscreenButton() {
  const active = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  fullscreenButton.setAttribute('aria-label', active ? '離開全螢幕' : '進入全螢幕');
  fullscreenButton.querySelector('.control-label').textContent = active ? '離開全螢幕' : '全螢幕';
}

player.addEventListener('click', event => {
  const thumbnail = event.target.closest('[data-slide]');
  if (thumbnail) {
    show(Number(thumbnail.dataset.slide));
    return;
  }

  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;
  if (action === 'prev') show(current - 1);
  if (action === 'next') show(current + 1);
  if (action === 'play') togglePlayback();
  if (action === 'thumbnails') toggleThumbnails();
  if (action === 'full') toggleFullscreen();
  if (action === 'retry') {
    showLoadingState();
    load(current, true, true);
  }
});

progress.addEventListener('input', () => {
  stopPlayback();
  show(Number(progress.value) - 1);
});

document.addEventListener('keydown', event => {
  if (event.target.closest('button, a, input, textarea, select')) return;
  if (['ArrowRight', ' ', 'PageDown'].includes(event.key)) {
    event.preventDefault();
    show(current + 1);
  }
  if (['ArrowLeft', 'PageUp'].includes(event.key)) {
    event.preventDefault();
    show(current - 1);
  }
  if (event.key === 'Home') {
    event.preventDefault();
    show(0);
  }
  if (event.key === 'End') {
    event.preventDefault();
    show(total - 1);
  }
  if (event.key.toLowerCase() === 'f') {
    event.preventDefault();
    toggleFullscreen();
  }
});

stage.addEventListener('click', event => {
  if (!event.target.closest('button')) player.focus({ preventScroll: true });
});

stage.addEventListener('touchstart', event => {
  touchStartX = event.changedTouches[0].clientX;
}, { passive: true });

stage.addEventListener('touchend', event => {
  const deltaX = event.changedTouches[0].clientX - touchStartX;
  if (Math.abs(deltaX) > 45) show(current + (deltaX < 0 ? 1 : -1));
}, { passive: true });

document.addEventListener('fullscreenchange', updateFullscreenButton);
document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
document.addEventListener('fullscreenerror', () => flashHint('瀏覽器未允許全螢幕，請使用「另開大畫面播放器」。'));
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopPlayback();
});

show(0);
