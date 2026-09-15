(() => {
  const fallbackCopy = (element) => {
    element.focus();
    element.select();
    element.setSelectionRange(0, element.value.length);
    return document.execCommand('copy');
  };

  document.querySelectorAll('[data-copy-target]').forEach((button) => {
    const target = document.getElementById(button.dataset.copyTarget);
    if (!target) return;

    const readyLabel = button.textContent;
    let resetTimer = 0;

    button.addEventListener('click', async () => {
      let copied = false;

      try {
        if (navigator.clipboard && window.isSecureContext) {
          await navigator.clipboard.writeText(target.value);
          copied = true;
        } else {
          copied = fallbackCopy(target);
        }
      } catch (error) {
        copied = fallbackCopy(target);
      }

      window.clearTimeout(resetTimer);
      button.textContent = copied ? '已複製' : '請手動複製文字框';
      button.classList.toggle('copied', copied);

      resetTimer = window.setTimeout(() => {
        button.textContent = readyLabel;
        button.classList.remove('copied');
      }, 1800);
    });
  });
})();
