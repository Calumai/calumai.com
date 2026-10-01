(() => {
  const hero = document.querySelector('#lesson .lesson-hero');
  if (!hero || document.getElementById('gas-score-handout')) return;
  hero.querySelector('.back-row')?.insertAdjacentHTML('afterbegin', '<a class="gas-hero-link" href="#gas-score-handout">照原簡報做：GAS 成績紀錄 6 步驟 ↓</a>');

  const gasCode = [
    'function doPost(e) {',
    "  const data = JSON.parse(e.postData.contents || '{}');",
    "  const name = String(data.name || '').trim();",
    '  const score = Number(data.score);',
    "  const wrongWords = String(data.wrongWords || '無');",
    '',
    '  if (!name || !Number.isFinite(score) || score < 0 || score > 100) {',
    "    throw new Error('姓名或分數不正確');",
    '  }',
    '',
    '  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];',
    '  sheet.appendRow([new Date(), name, score, wrongWords]);',
    "  return ContentService.createTextOutput('OK');",
    '}'
  ].join('\n');

  const aiPrompt = [
    '請做一份單一 HTML 的「單字填空練習卡」，讓初學者輸入答案，不要做選擇題。',
    '題目與答案只用我提供、已核對的資料；不要自行翻譯族語。',
    '畫面要有姓名輸入框、題目、答案輸入框與「送出」按鈕。',
    '按送出時，用 fetch 將 JSON 送到我的 GAS 網頁應用程式網址：【貼上自己的 /exec 網址】。',
    'JSON 必須包含 name（姓名）、score（0 到 100 的分數）、wrongWords（錯題紀錄）。',
    '請用 POST，並設定 Content-Type: text/plain;charset=utf-8；說明跨網域情況下為何可能需要 mode: no-cors。',
    '送出時按鈕顯示「傳送中…」；完成後提醒我到成績單確認是否真的新增一列。',
    '請提供可複製的完整 HTML，並指出我只需替換哪個網址。'
  ].join('\n');

  hero.insertAdjacentHTML('afterend', `
    <section class="gas-handout" id="gas-score-handout" aria-labelledby="gas-handout-title">
      <div class="gas-handout-head">
        <p class="gas-eyebrow">原 PPT 操作講義 · 先從這裡開始</p>
        <h2 id="gas-handout-title">照簡報做：GAS 成績紀錄 6 步驟</h2>
        <p>先記住一句話：<strong>字表放題目，成績單收結果，GAS 是中間的收件員。</strong>這份講義照原簡報的順序，用假資料走完一次。</p>
        <div class="gas-route" role="img" aria-label="字表提供題目，學生在練習卡作答，GAS 接收後把結果寫入成績單">
          <span>字表<br><small>題目來源</small></span><b aria-hidden="true">→</b><span>練習卡<br><small>學生作答</small></span><b aria-hidden="true">→</b><span>GAS<br><small>接收資料</small></span><b aria-hidden="true">→</b><span>成績單<br><small>新增一列</small></span>
        </div>
        <p class="gas-path-note">本頁原有教材示範「GAS 內建網頁＋google.script.run」。下面是原簡報的另一條路線：「Google Sites 嵌入單一 HTML＋fetch 傳給 GAS」。選一條完成即可，不要把兩段送出程式混貼。</p>
      </div>

      <ol class="gas-steps">
        <li class="gas-step"><div class="gas-step-number">01</div><div>
          <h3>準備題目，再另建成績單 <small>原 PPT 第 3–7 頁</small></h3>
          <p><b>在哪裡點：</b>在 Google 試算表打開已核對的字表，再建立一份新試算表，命名「成績單」。</p>
          <p><b>輸入什麼：</b>成績單第一列依序填 A「時間」、B「姓名」、C「分數」、D「錯題紀錄」。先用「測試者 A」等假名字，族語題目與答案由老師確認。</p>
          <p class="gas-result"><b>完成會看到：</b>第一列有四個欄名；第二列還是空白。</p>
        </div></li>

        <li class="gas-step"><div class="gas-step-number">02</div><div>
          <h3>在成績單建立 GAS 收件程式 <small>原 PPT 第 7–9 頁</small></h3>
          <p><b>在哪裡點：</b>打開「成績單」，按「擴充功能」→「Apps Script」，在「程式碼.gs」把原本範例函式換成下方程式，再按儲存。</p>
          <p><b>這段在做什麼：</b>收到姓名、分數與錯題後，GAS 自動加上時間，寫到成績單的第一個工作表。</p>
          <div class="gas-code-head"><strong>程式碼.gs · 課堂測試版</strong><button type="button" class="gas-copy" data-gas-copy="gas-code">複製程式</button></div>
          <pre class="gas-code"><code id="gas-code"></code></pre>
          <p class="gas-caution">原 PPT 截圖的 <code>TextOutput.setHeader()</code> 無法使用，不能照圖原封不動貼上。上面改成 Apps Script 支援的回傳寫法。此範例只供假資料練習，沒有登入與防重複送出；正式收學生資料前，需由老師檢查權限與資料保護。</p>
          <p class="gas-result"><b>完成會看到：</b>Apps Script 顯示已儲存，程式第一行是 <code>function doPost(e)</code>。</p>
        </div></li>

        <li class="gas-step"><div class="gas-step-number">03</div><div>
          <h3>部署網頁應用程式，複製自己的網址 <small>原 PPT 第 10–20 頁</small></h3>
          <p><b>在哪裡點：</b>Apps Script 右上「部署」→「新增部署作業」→ 齒輪 →「網頁應用程式」。</p>
          <p><b>選什麼：</b>「執行身分」選自己。原簡報測試時「誰可以存取」選所有人；這代表知道網址的人可送資料。課堂只用假資料，正式使用前由老師依學校規定決定存取範圍。</p>
          <p><b>接著做：</b>按「部署」。第一次授權先核對帳號、專案與要求的權限，不確定就請老師一起看。完成後在「網頁應用程式」區塊按「複製」。</p>
          <p class="gas-result"><b>完成會看到：</b>一個通常以 <code>/exec</code> 結尾的網址。要用的是這個網址，不是部署作業 ID。</p>
        </div></li>

        <li class="gas-step"><div class="gas-step-number">04</div><div>
          <h3>請 AI 製作單字填空練習卡 <small>原 PPT 第 21–24 頁</small></h3>
          <p><b>在哪裡輸入：</b>打開 Gemini，把老師確認過的題目與答案，以及下面的需求貼進對話。把方括號換成你自己的 <code>/exec</code> 網址。</p>
          <div class="gas-code-head"><strong>可修改的提示詞</strong><button type="button" class="gas-copy" data-gas-copy="gas-prompt">複製提示詞</button></div>
          <pre class="gas-prompt"><code id="gas-prompt"></code></pre>
          <p><b>要拿什麼：</b>切到「程式碼」取得完整 HTML。Gemini Canvas 的「公開分享連結」不是 HTML 原始碼，不能貼到下一步的「嵌入程式碼」。</p>
          <p class="gas-result"><b>完成會看到：</b>預覽裡有姓名欄、填空題、答案欄與送出按鈕。</p>
        </div></li>

        <li class="gas-step"><div class="gas-step-number">05</div><div>
          <h3>把練習卡放到 Google 協作平台 <small>原 PPT 第 25–33 頁</small></h3>
          <p><b>在哪裡點：</b>在 Google 協作平台建立「空白網站」，右側選「內嵌」→「嵌入程式碼」。貼上完整 HTML，按「下一個」；預覽正常才按「插入」。</p>
          <p><b>接著做：</b>拉大嵌入區塊，讓整張卡片看得見，再按右上「發布」，設定網址並打開發布後的網站。</p>
          <p class="gas-result"><b>完成會看到：</b>正式網站上能輸入姓名和答案，也看得到送出按鈕。</p>
        </div></li>

        <li class="gas-step"><div class="gas-step-number">06</div><div>
          <h3>用假資料驗收：成績單真的多一列才算成功 <small>原 PPT 第 34–35 頁</small></h3>
          <p><b>在哪裡做：</b>打開發布後的練習頁，輸入「測試者 A」並作答，按「送出」。接著回到「成績單」。</p>
          <p><b>檢查什麼：</b>最下方是否新增一列，且時間、姓名、分數、錯題紀錄都在正確欄位。若頁面只顯示「已送出」，但試算表沒新增，還不算完成；跨網域傳送時網頁也可能無法讀取 GAS 回覆。</p>
          <p class="gas-result"><b>完成會看到：</b>成績單新增一列「測試者 A」的紀錄。原 PPT 最後沒有拍到這個結果，請用自己的測試表確認。</p>
        </div></li>
      </ol>

      <div class="gas-footer-grid">
        <div class="gas-help"><h3>沒有新增資料？先查四件事</h3><ol><li>HTML 用的是自己的 <code>/exec</code> 網址嗎？</li><li>改過 GAS 後，有到「管理部署」更新新版本嗎？</li><li>送出的欄位名稱是 <code>name</code>、<code>score</code>、<code>wrongWords</code> 嗎？</li><li>你檢查的是綁定這支 GAS 的那份「成績單」嗎？</li></ol><p>還是不行，就到 Apps Script「執行紀錄」查看錯誤，並請老師協助。</p></div>
        <div class="gas-help"><h3>交作業前的安全檢查</h3><p>只用假資料示範；不要公開學生姓名、分數、帳號、私人試算表與原簡報中的部署網址。網站能開啟，不代表資料已成功寫入。</p><p class="gas-sources">參考：<a href="https://developers.google.com/apps-script/guides/web" target="_blank" rel="noopener">Google 網頁應用程式</a>、<a href="https://developers.google.com/apps-script/reference/content/text-output" target="_blank" rel="noopener">TextOutput 方法</a>。本講義尚未使用個別學員帳號完成線上端對端測試。</p></div>
      </div>
    </section>
  `);

  document.getElementById('gas-code').textContent = gasCode;
  document.getElementById('gas-prompt').textContent = aiPrompt;
  document.querySelectorAll('#gas-score-handout [data-gas-copy]').forEach(button => {
    button.addEventListener('click', async () => {
      const original = button.textContent;
      const value = document.getElementById(button.dataset.gasCopy).textContent;
      try {
        await navigator.clipboard.writeText(value);
        button.textContent = '已複製';
      } catch (_) {
        button.textContent = '複製失敗，請選取文字';
      }
      setTimeout(() => { button.textContent = original; }, 2500);
    });
  });
  if (location.hash === '#gas-score-handout') {
    requestAnimationFrame(() => document.getElementById('gas-score-handout').scrollIntoView({ block: 'start' }));
  }
})();
