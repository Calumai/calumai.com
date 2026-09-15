// Read current textarea values so handout-editor changes are also copied/downloaded.
(() => {
  'use strict';
  const root = document.querySelector('.lesson-six');
  if (!root) return;
  const timers = new WeakMap();
  for (const button of root.querySelectorAll('[data-copy]')) {
    button.hidden = false;
    button.addEventListener('click', async () => {
      const field = document.getElementById(button.dataset.copy);
      const status = button.parentElement.querySelector('[role="status"]');
      if (!field || button.disabled) return;
      clearTimeout(timers.get(button));
      button.disabled = true;
      status.textContent = '';
      let copied = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(field.value);
          copied = true;
        }
      } catch (_) { /* Offer selection/copy when clipboard access is unavailable. */ }
      if (!copied) {
        field.focus();
        field.select();
        field.setSelectionRange(0, field.value.length);
        try { copied = document.execCommand('copy'); } catch (_) { copied = false; }
      }
      button.disabled = false;
      button.classList.toggle('copied', copied);
      button.textContent = copied ? '已複製' : '複製提示詞';
      status.textContent = copied ? '貼到 AI 對話，填好【】欄位後再送出。' : '已選取提示詞。請按 Ctrl＋C；手機可長按文字選「複製」。';
      if (copied) {
        button.focus({ preventScroll: true });
        timers.set(button, setTimeout(() => {
          button.textContent = '複製提示詞';
          button.classList.remove('copied');
        }, 2500));
      }
    });
  }

  const download = document.getElementById('download-prompts');
  const downloadStatus = document.getElementById('download-status');
  if (download) {
    download.hidden = false;
    download.addEventListener('click', () => {
      const sections = Array.from(root.querySelectorAll('.six-game')).map(game => {
        const title = game.querySelector('h3').textContent.trim();
        const category = game.querySelector('.six-category').textContent.trim();
        return `${category}\n${title}\n\n${game.querySelector('textarea[readonly]').value}`;
      });
      const intro = 'CALUMAI｜族語教學遊戲提示詞\n\n選一款玩法，把【】欄位換成自己的課堂資料，貼入老師確認的語料後再送出給 AI。\n';
      const blob = new Blob(['\uFEFF', intro + '\n' + sections.join('\n\n' + '─'.repeat(36) + '\n\n')], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'CALUMAI-第六堂-五類遊戲提示詞.txt';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
      downloadStatus.textContent = '已送出下載，請到瀏覽器的下載清單查看 TXT 檔。';
    });
  }
})();
