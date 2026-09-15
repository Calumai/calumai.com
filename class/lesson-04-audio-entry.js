(() => {
  'use strict';
  const oldAnchors = new Set([
    '#audio-relationship', '#audio-relationship-title', '#audio-shortcuts',
    '#audio-sop', '#audio-mistake', '#audio-library', '#audio-filename-example',
    '#audio-troubleshooting', '#audio-sync', '#audio-sync-title'
  ]);
  const followOldLink = () => {
    if (!oldAnchors.has(location.hash)) return false;
    location.replace('/class/lesson-04-audio.html' + location.hash);
    return true;
  };
  if (followOldLink()) return;
  window.addEventListener('hashchange', followOldLink);
  document.querySelector('#lesson .source-note')?.remove();

  const hero = document.querySelector('#lesson .lesson-hero');
  if (!hero || document.getElementById('audio-guide-entry')) return;
  const entry = document.createElement('section');
  entry.id = 'audio-guide-entry';
  entry.className = 'lesson-card audio-entry';
  entry.setAttribute('aria-labelledby', 'audio-guide-entry-title');
  entry.innerHTML = '<div><p class="eyebrow">音檔操作</p><h2 id="audio-guide-entry-title">音檔與同步操作說明</h2><p>看懂檔名怎麼取、音檔放哪裡，以及同步後要檢查什麼。裡面有操作 SOP、圖書館比喻和不能播放時的檢查表。</p></div><a href="/class/lesson-04-audio.html">開啟音檔說明 <span aria-hidden="true">→</span></a>';
  hero.after(entry);
})();
