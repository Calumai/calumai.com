(() => {
  const data = window.AMIS_MATERIALS;
  const key = new URLSearchParams(location.search).get('lesson');
  if (!data || !data[key]) return;
  const lesson = data[key];
  const play = document.getElementById('play');
  play.hidden = false;
  document.getElementById('lesson-label').textContent = `112 年情境族語 · ${lesson.shortTitle}`;
  document.getElementById('play-title').textContent = lesson.title;
  document.getElementById('attribution').textContent = `資料來源：${lesson.source}，教材標示族語 E 樂園設計製作／財團法人原住民族語言研究發展基金會 © 版權所有。`;
  let index = 0, score = 0, selected = null, revealed = false, scored = new Set();
  const $ = id => document.getElementById(id);
  function render() {
    const q = lesson.questions[index];
    selected = null; revealed = false;
    $('progress').textContent = `第 ${index + 1} / ${lesson.questions.length} 題`;
    $('type-label').textContent = q.type;
    $('scene').textContent = q.scene;
    $('question').textContent = q.prompt;
    $('source-page').textContent = `來源 PDF 印刷第 ${q.page} 頁`;
    $('score').textContent = `得分 ${score}`;
    $('answer').hidden = true;
    $('choices').replaceChildren(...q.choices.map((choice, i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = `${String.fromCharCode(65 + i)}　${choice}`;
      button.addEventListener('click', () => choose(i));
      return button;
    }));
    $('next').disabled = true;
    $('next').textContent = index === lesson.questions.length - 1 ? '完成遊戲 →' : '下一題 →';
    $('reveal').disabled = false;
    $('stage').focus({preventScroll:true});
  }
  function choose(i) {
    if (revealed) return;
    selected = i;
    [...$('choices').children].forEach((button, j) => button.classList.toggle('selected', i === j));
  }
  function reveal() {
    if (revealed) return;
    revealed = true;
    const q = lesson.questions[index];
    [...$('choices').children].forEach((button, j) => {
      button.classList.toggle('correct', j === q.answer);
      button.classList.toggle('incorrect', j === selected && j !== q.answer);
      button.disabled = true;
    });
    const correct = selected === q.answer;
    if (correct && !scored.has(index)) { score++; scored.add(index); }
    $('score').textContent = `得分 ${score}`;
    $('answer').textContent = `${correct ? '答對了！' : '正確答案'} ${String.fromCharCode(65 + q.answer)}　${q.choices[q.answer]} · PDF 印刷第 ${q.page} 頁`;
    $('answer').hidden = false;
    $('next').disabled = false;
    $('reveal').disabled = true;
  }
  function next() {
    if (!revealed) return;
    if (index < lesson.questions.length - 1) { index++; render(); return; }
    $('scene').textContent = '任務完成';
    $('question').textContent = `${score} / ${lesson.questions.length} 分`;
    $('choices').replaceChildren();
    $('answer').textContent = '可以回到選教材頁，下載資訊圖表接著複習。';
    $('answer').hidden = false;
    $('source-page').textContent = lesson.source;
    $('next').disabled = true;
  }
  $('reveal').addEventListener('click', reveal);
  $('next').addEventListener('click', next);
  $('restart').addEventListener('click', () => {index = 0; score = 0; scored = new Set(); render();});
  $('fullscreen').addEventListener('click', () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else $('stage').requestFullscreen();
  });
  document.addEventListener('keydown', e => {
    if (!location.hash.includes('play') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (['1','2','3'].includes(e.key)) choose(Number(e.key) - 1);
    if (e.key === 'Enter') reveal();
    if (e.key === 'ArrowRight') next();
  });
  render();
  if (location.hash === '#play') requestAnimationFrame(() => play.scrollIntoView());
})();
