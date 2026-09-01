let loadingRemoved = false;

const params = new URLSearchParams(location.search);
const id = (params.get('lesson') || '01').padStart(2, '0');
const assetVersion = id === '04' ? '?v=20260901a' : '';
const total = ({ '01': 9, '02': 12, '03': 12, '04': 44 })[id] || 8;
const player = document.querySelector('#player');

let current = 0;

const slides = Array.from({ length: total }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  const image = document.createElement('img');
  image.className = 'slide';
  image.dataset.src = `/class/ppt-preview/${id}/slide-${number}.png${assetVersion}`;
  image.alt = `第 ${id} 堂第 ${index + 1} 張投影片`;
  image.loading = 'lazy';
  image.decoding = 'async';
  image.draggable = false;
  player.appendChild(image);
  return image;
});

const topbar = document.createElement('div');
topbar.className = 'topbar';
topbar.innerHTML = `<a class="back" href="/class/lesson-${id}.html">← 回到課程頁</a><span class="counter"></span>`;
player.appendChild(topbar);

const controls = document.createElement('div');
controls.className = 'controls';
controls.innerHTML = '<button data-action="prev" aria-label="上一張">←</button><button class="primary" data-action="full">全螢幕</button><button data-action="next" aria-label="下一張">→</button>';
player.appendChild(controls);

const hint = document.createElement('div');
hint.className = 'hint';
hint.textContent = '左右鍵／空白鍵翻頁・手機左右滑動・按 F 進入全螢幕';
player.appendChild(hint);

function load(index, priority = false) {
  const image = slides[(index + total) % total];
  if (!image.src) {
    image.src = image.dataset.src;
    if (priority) image.fetchPriority = 'high';
  }
}

function show(index) {
  if (!loadingRemoved) {
    document.querySelectorAll('.loading').forEach(element => element.remove());
    loadingRemoved = true;
  }

  current = (index + total) % total;
  load(current, true);
  load(current + 1);
  load(current - 1);
  slides.forEach((slide, slideIndex) => slide.classList.toggle('active', slideIndex === current));
  topbar.querySelector('.counter').textContent = `第 ${current + 1} / ${total} 張`;
  document.title = `第 ${id} 堂｜第 ${current + 1} 張｜CALUMAI`;
}

function next() {
  show(current + 1);
}

function previous() {
  show(current - 1);
}

function fullscreen() {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
  else document.exitFullscreen?.();
}

controls.addEventListener('click', event => {
  const action = event.target.dataset.action;
  if (action === 'next') next();
  if (action === 'prev') previous();
  if (action === 'full') fullscreen();
});

document.addEventListener('keydown', event => {
  if (['ArrowRight', ' ', 'PageDown'].includes(event.key)) {
    event.preventDefault();
    next();
  }
  if (['ArrowLeft', 'PageUp'].includes(event.key)) {
    event.preventDefault();
    previous();
  }
  if (event.key.toLowerCase() === 'f') fullscreen();
  if (event.key === 'Escape' && document.fullscreenElement) document.exitFullscreen?.();
});

let downX = 0;
document.addEventListener('touchstart', event => {
  downX = event.changedTouches[0].clientX;
}, { passive: true });

document.addEventListener('touchend', event => {
  const deltaX = event.changedTouches[0].clientX - downX;
  if (Math.abs(deltaX) > 45) (deltaX < 0 ? next : previous)();
}, { passive: true });

show(0);
