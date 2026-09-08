(function () {
  const root = document.getElementById('lesson');

  const lessonNav = document.querySelector('header nav');
  if (lessonNav && !lessonNav.querySelector('[data-prompt-guide-link]')) {
    const guideLink = document.createElement('a');
    const promptLink = lessonNav.querySelector('a[href="#prompts"]');
    guideLink.href = '#index-prompt-guide';
    guideLink.dataset.promptGuideLink = 'true';
    guideLink.textContent = '提示詞教學';
    lessonNav.insertBefore(guideLink, promptLink);
  }

  if (root && !root.querySelector('[data-lesson-overview-image]')) {
    const figure = document.createElement('figure');
    const image = document.createElement('img');
    figure.className = 'lesson-overview-image';
    figure.dataset.lessonOverviewImage = 'true';
    image.src = '/class/examples/assets/lesson-03-gas-vibe-coding-role.jpg';
    image.alt = 'GAS 在 Vibe Coding 中的角色與優勢圖解';
    image.width = 2816;
    image.height = 1536;
    image.loading = 'eager';
    image.decoding = 'async';
    figure.appendChild(image);
    root.insertBefore(figure, root.firstChild);
  }

  const resourceRow = document.querySelector('.resources .resource-row');
  if (resourceRow && !resourceRow.querySelector('[data-audio-advanced]')) {
    const link = document.createElement('a');
    link.href = '/class/examples/lesson-04-gas-audio-starter.html';
    link.target = '_blank';
    link.rel = 'noopener';
    link.dataset.audioAdvanced = 'true';
    link.textContent = '進階第三課｜族語聽力測驗（音檔版） ↗';
    resourceRow.appendChild(link);
  }

  const promptSection = document.querySelector('.prompts');
  if (!promptSection || document.getElementById('index-prompt-guide')) return;

  const ultimatePrompt = [
    '【角色與目標】',
    '我目前有一個 Google Apps Script（GAS）的線上測驗系統後端程式碼。請幫我撰寫搭配的 Index.html，並將 HTML、CSS、JavaScript 寫在同一個檔案內。不可使用 React、Bootstrap、Vue、jQuery 或其他外部框架，請使用 Vanilla JavaScript 與原生 CSS 完成。',
    '',
    '【既有後端介面】',
    '請直接串接並保留以下函式名稱，不要自行改名：',
    '- getQuizData()',
    '- saveQuizResult(payload)',
    '- getTeacherQuiz(pin)',
    '- saveTeacherQuiz(pin, quiz)',
    '',
    '【介面與視覺設計（UI／UX）】',
    '1. 使用現代、乾淨的卡片式設計（Card UI），背景為淺灰藍色，卡片為白色圓角並帶有適度陰影。',
    '2. 使用響應式設計（RWD），手機版與電腦版都要清楚好操作。',
    '3. 色彩使用 CSS 變數，例如 --blue、--good、--bad；按鈕需區分主要、次要與危險狀態。',
    '',
    '【系統架構（JavaScript）】',
    '1. 設計成單頁面應用程式（SPA），透過切換 .hidden class 顯示不同畫面，不重新載入網頁。',
    '2. 將 google.script.run 封裝成 Promise，讓所有後端呼叫可以使用 async／await。',
    '3. 加入本地預覽模式：如果偵測不到 google.script.run，改用 sessionStorage 模擬相同的後端函式與資料格式，讓我可以直接雙擊 HTML 測試畫面。',
    '',
    '【畫面 1：學生首頁】',
    '- 輸入欄位：姓名、班級、座號。',
    '- 按鈕：開始測驗、教師題庫管理。',
    '- 開始前驗證所有必填欄位。',
    '',
    '【畫面 2：測驗畫面】',
    '- 顯示目前題號、分數與上方進度條。',
    '- 依題目資料動態產生 2～4 個選項按鈕。',
    '- 點擊選項後立刻鎖定本題。答對標示綠色；答錯標示紅色，並同時標示正確答案。',
    '- 下方顯示解析與「下一題」按鈕。',
    '',
    '【畫面 3：測驗結果】',
    '- 顯示大字體得分百分比與答對題數。',
    '- 提供「送出成績」與「重新挑戰」按鈕。',
    '- 送出時呼叫 saveQuizResult(payload)，立即停用按鈕以避免重複提交；成功後顯示清楚提示。',
    '',
    '【畫面 4：教師登入】',
    '- 提供教師 PIN 碼輸入欄位。',
    '- 呼叫 getTeacherQuiz(pin)，驗證成功後才能進入管理介面。',
    '',
    '【畫面 5：教師管理介面】',
    '- 頂部提供「測驗名稱」輸入框。',
    '- 每一題使用獨立卡片，包含：題型下拉選單、題目 textarea、4 個選項 input、正確答案 radio、解析 textarea。',
    '- 提供「＋新增一題」與「刪除這題」。',
    '- 點擊「儲存題庫」後，讀取所有表單資料並組成正確 JSON，再呼叫 saveTeacherQuiz(pin, quiz)。',
    '',
    '【錯誤與狀態處理】',
    '1. 每一次非同步操作都要有處理中、成功與失敗狀態。',
    '2. 失敗訊息要用一般老師看得懂的繁體中文。',
    '3. 不可因為單次錯誤就清除老師尚未儲存的題目。',
    '4. 不要改動後端函式名稱或自行新增外部 API。',
    '',
    '【輸出格式】',
    '請先列出你將串接的四個後端函式與五個畫面，再輸出完整的 <!doctype html> 程式碼。不要省略任何 CSS 或 JavaScript，也不要只提供片段。',
    '',
    '【我的 Code.gs】',
    '請把目前可正常執行的 Code.gs 貼在這一行下面。'
  ].join('\n');

  const guide = document.createElement('section');
  guide.className = 'lesson-card prompt-guide';
  guide.id = 'index-prompt-guide';
  guide.innerHTML = [
    '<p class="eyebrow" style="color:#3d8dff">PROMPT DESIGN / 提示詞教學</p>',
    '<h2>讓 AI 寫出 GAS 測驗的 Index.html</h2>',
    '<p class="guide-lede">不要只說「幫我做一個測驗」。先交代角色、技術限制、五個畫面與後端函式，AI 才比較不會漏功能或自行換掉架構。</p>',
    '<h3>實際使用順序</h3>',
    '<ol class="prompt-use-steps"><li>先確認 Code.gs 可以儲存</li><li>展開並複製完整提示詞</li><li>把自己的 Code.gs 貼在最後</li><li>交給 ChatGPT、Claude 或 Gemini</li><li>將完整結果貼進 Index.html 測試</li></ol>',
    '<details class="ultimate-prompt-details"><summary>展開完整的「終極提示詞」</summary><div class="ultimate-prompt-body"><div class="prompt-toolbar"><span>最後記得補上目前可用的 Code.gs</span><button class="prompt-copy-button" type="button">複製完整提示詞</button></div><textarea class="ultimate-prompt-text" readonly aria-label="產生 GAS 測驗 Index.html 的完整提示詞"></textarea></div></details>',
    '<div class="prompt-breakdown"><article><h3>1. 結構化分塊</h3><p>把角色、介面、架構與畫面分開說，AI 比較不容易漏掉需求。</p></article><article><h3>2. 技術限制清楚</h3><p>指定單一檔案、Vanilla JS、CSS 變數與 async／await，避免加入不需要的框架。</p></article><article><h3>3. 說清楚狀態變化</h3><p>明確寫出鎖定答案、答對答錯、傳送中與防止重複點擊，互動才會完整。</p></article><article><h3>4. 本地預覽替身</h3><p>用 sessionStorage 模擬相同介面，能先測畫面；正式資料仍要回到 GAS 網頁應用程式測試。</p></article></div>'
  ].join('');

  const textarea = guide.querySelector('.ultimate-prompt-text');
  const copyButton = guide.querySelector('.prompt-copy-button');
  textarea.value = ultimatePrompt;

  copyButton.addEventListener('click', async function () {
    try {
      await navigator.clipboard.writeText(ultimatePrompt);
    } catch (error) {
      textarea.focus();
      textarea.select();
      document.execCommand('copy');
    }
    copyButton.textContent = '已複製';
    copyButton.classList.add('copied');
    window.setTimeout(function () {
      copyButton.textContent = '複製完整提示詞';
      copyButton.classList.remove('copied');
    }, 1600);
  });

  promptSection.parentNode.insertBefore(guide, promptSection);
})();
