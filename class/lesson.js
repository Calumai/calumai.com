const DATA={
'01':{title:'Gemini Notebook 遊戲化 RPG 簡報',tag:'GEMINI NOTEBOOK / GAME DESIGN',accent:'#147d7e',lede:'把一份教材變成一場可以闖關、練習與展示的學習冒險。',goals:['理解遊戲化的目標、任務、挑戰、回饋與成長','用 Gemini Notebook 整理真實教材與來源','完成 8–12 張 RPG 簡報初版'],steps:['上傳「112年情境族語｜01上課用語｜太魯閣語」PDF','請 Gemini Notebook 先整理對話、單詞與互動測驗','設計玩家、世界觀、任務線與三個關卡','要求 Gemini Notebook 生成簡報大綱','人工核對太魯閣語與中文意思'],practice:'把 PDF 中的對話練習、單詞練習與互動測驗轉成三個 RPG 關卡。',output:'Gemini Notebook 遊戲化 RPG 簡報 v1',prompts:['請根據我上傳的教材，整理所有語言資料、中文意思、使用情境與頁碼。只能使用來源中確認的內容，不可以自行猜測或補寫。','請把這份教材設計成適合國中生的 RPG。請提供世界觀、角色、3 個任務、挑戰、回饋、獎勵與勝利條件，並區分教材資料與故事設定。','請檢查這份 RPG 簡報：哪些語言內容有來源？哪些可能是推測？請列出需要族語教師人工確認的地方。'],source:'使用者提供的 112 年情境族語 PDF'},
'02':{"title":"Vibe 你的學生測驗網頁","tag":"VIBE CODING / QUIZ WEB","accent":"#e3a62f","lede":"先讓測驗「能玩」：全班走同一條主線，卡住就拿救援卡，提早完成就開支線任務。","goals":["把自己的教材整理成可替換的 QUIZ_DATA 題庫","完成開始、答題、回饋、計分、錯題與重玩的單一 HTML 測驗","使用「一次改一項、改完立刻測」的 Vibe Coding 除錯流程"],"steps":["玩一次範例，從學生角度找出最想修理的體驗","在教師標準版找到 QUIZ_INFO 與 QUIZ_DATA","先替換標題與 1 題，再完整測試一次","用主線提示詞完成至少 5 題的最低可用版本","依目前狀態選擇救援卡、主線卡或一項支線任務","交換作品進行 Bug 狩獵，記錄重現步驟與修正結果","保留可用版本，整理成可開啟 HTML 或網址"],"practice":"完成一份至少 5 題的學生測驗，請另一位同學從頭作答，至少修正一個實際發現的問題。","output":"可開啟的單一 HTML 測驗、題目來源、使用提示詞與 Bug 狩獵紀錄","promptNames":["主線｜產生最低可用測驗","救援｜只替換題庫","升級｜一次新增一項功能","除錯｜不要重寫整份作品","遷移｜把骨架換成別科教材"],"prompts":["你是一位熟悉國中教學、使用者介面與前端網頁開發的教學工程師。\n\n請根據我提供的教材，製作一份可以給學生使用的互動測驗網頁。\n\n請使用單一 HTML 檔案，將 HTML、CSS、JavaScript 全部放在同一個檔案中，不需要安裝套件，也不需要登入或資料庫。\n\n【基本功能】\n1. 首頁顯示測驗名稱、說明與開始按鈕。\n2. 學生填寫姓名、班級或座號後才能開始。\n3. 每次顯示一題選擇題。\n4. 每題包含題目、3 至 4 個選項、正確答案與解析。\n5. 選擇答案後立即顯示答對或答錯。\n6. 答錯時顯示提示與正確解析。\n7. 顯示目前題數與進度條。\n8. 完成後顯示答對題數、總分與鼓勵文字。\n9. 提供查看錯題與重新挑戰按鈕。\n10. 按鈕要大、文字清楚，適合手機與國中學生。\n\n【程式要求】\n1. 將題目集中放在程式上方的 QUIZ_DATA。\n2. 將測驗名稱與說明集中放在 QUIZ_INFO。\n3. 在可修改位置加上繁體中文註解。\n4. 不使用外部框架，不加入登入、資料庫、排行榜或付費功能。\n5. 先確保開始、答題、回饋、計分、錯題與重玩流程完整可用。\n6. 直接輸出完整的 <!DOCTYPE html> 程式碼。\n\n【教材內容】\n請貼在這裡：","以下是一份已經可以正常運作的 HTML 測驗。請不要重新設計整份網頁，也不要改變原本功能。\n\n你只需要：\n1. 找出 QUIZ_INFO 與 QUIZ_DATA。\n2. 將測驗名稱、說明與題庫換成我提供的內容。\n3. 保留計分、解析、錯題、重玩與手機版功能。\n4. 檢查每題 answer 是否真的對應正確選項。\n5. 在修改位置加上「從這裡開始修改題目」的繁體中文註解。\n6. 回傳修改完成的完整 HTML。\n\n【原始 HTML】\n\n【至少 5 題的新題目】","以下 HTML 測驗目前可以正常運作。\n\n請只新增【填入一項功能，例如：每次隨機抽 5 題】。\n\n重要要求：\n1. 不要刪除原本功能。\n2. 不要改變 QUIZ_DATA 的資料格式。\n3. 保留開始、答題、回饋、計分、錯題與重新挑戰。\n4. 修改完成後列出新增的位置。\n5. 提供至少 5 個重新測試步驟。\n6. 回傳完整 HTML。\n\n【原始程式碼】","你是一位耐心的網頁程式除錯老師。\n\n【我原本期待】\n\n【實際發生】\n\n【重現步驟】\n1.\n2.\n3.\n\n【錯誤訊息；沒有就寫沒有看到】\n\n請回答：\n1. 最可能的原因。\n2. 要檢查的程式區域。\n3. 最小修改方案。\n4. 修改後的完整函式或完整 HTML。\n5. 修正後必須再測試的 3 個案例。\n\n不要重寫整個作品，也不要改動與錯誤無關的功能。\n\n【原始程式碼】","請保留這份測驗的操作骨架，只替換成【科目／教材主題】版本。\n\n請先輸出一張轉換表：\n1. 原本題目內容要換成什麼。\n2. 學生要進行哪一種互動。\n3. 答對與答錯要得到什麼回饋。\n4. 結果頁要提供什麼下一步。\n5. 哪些內容必須由老師人工確認。\n\n等我確認轉換表後，再修改 QUIZ_INFO 與 QUIZ_DATA。不要先增加新功能，也不要改動可正常運作的流程。\n\n【原始 HTML】\n\n【新教材】"],"interaction":["如果學生一直連按答案，分數會不會像爆米花一樣一直跳？","你寧願要 50 題普通題，還是 5 題有清楚解析的題目？","答錯時，你比較想收到提示、重試，還是隊友幫忙？","如果把這份測驗換成你的科目，第一題會問什麼？"],"branches":[{"title":"救援卡","subtitle":"改一改就能交","items":["使用教師標準版","只改 QUIZ_INFO 與 5 題 QUIZ_DATA","完整作答一次即可通關"]},{"title":"共同主線","subtitle":"做出自己的版本","items":["完成作答、回饋、計分與重玩","加入一項教學個人化設計","交給同學實際測試"]},{"title":"支線任務","subtitle":"一次只選一項","items":["隨機抽題或選項","Combo、限時、圖片題","錯題複習、最高分或深色模式"]}],"checks":["不填姓名能不能開始？","沒選答案能不能前進？","連按會不會重複加分？","最後一題能不能正常結算？","錯題與解析有沒有對應？","重新挑戰後狀態有沒有歸零？","手機畫面會不會超出？","長題目仍能不能閱讀？"],"resources":[{"label":"開啟學生測驗 HTML 範例","href":"/class/examples/lesson-02-quiz-example.html"}],"source":"課程自製差異化 Vibe Coding 教學框架；題目內容與答案需由授課教師人工確認。"},
'03':{"title":"Gemini＋GAS 測驗成績系統","tag":"GEMINI + GAS / GOOGLE SHEETS","accent":"#3d8dff","lede":"再讓測驗「會收」：把學生結果送進 Google 試算表，留下真正能用的教學資料。","goals":["看懂 Index.html、Code.gs 與 Google 試算表之間的資料路線","使用 google.script.run 傳送成績，處理傳送中、成功與失敗狀態","部署成別人能開啟的 Web App，完成跨裝置真人測試"],"steps":["不論上一堂進度，先取得教師標準版測驗重新起跑","建立「測驗紀錄」工作表與九個資料欄位","從試算表開啟 Apps Script，建立 Code.gs 與 Index.html","加入 doGet、saveQuizResult 與 appendRow 寫入流程","由 Index.html 使用 google.script.run 傳送 payload","加入 withSuccessHandler、withFailureHandler 與防重複提交","部署成網頁應用程式，使用另一個帳號或裝置測試","用試算表回答一個真實教學問題"],"practice":"至少完成兩次跨裝置測試：正常送出一筆，以及故意漏填或重複按送出，確認資料與回饋正確。","output":"正式 Web App 網址、Google 試算表測驗紀錄、真人測試結果與個資／權限說明","promptNames":["主線｜把 HTML 改造成 GAS Web App","升級｜避免重複提交","除錯｜GAS 急診室","分析｜把成績變成教學問題","遷移｜改造成另一種收集系統"],"prompts":["你是一位熟悉 Google Apps Script、Google Sheets 與國中數位教學的工程師。\n\n請將我提供的單一 HTML 測驗改造成 Google Apps Script Web App，分別輸出 Code.gs 與 Index.html。\n\n【Code.gs】\n1. 建立 doGet()，使用 HtmlService 顯示 Index.html。\n2. 建立 saveQuizResult(payload)。\n3. 寫入目前綁定的 Google 試算表，工作表名稱為「測驗紀錄」。\n4. 工作表不存在時自動建立，第一列自動建立：提交時間、姓名、班級、座號、測驗名稱、答對題數、總題數、百分比、作答內容。\n5. 每次成功提交新增一列，並驗證必要欄位與分數範圍。\n6. 成功回傳 success: true 與「成績已送出」。\n\n【Index.html】\n1. 保留原本測驗、計分、錯題與重玩功能。\n2. 完成測驗後才顯示送出成績。\n3. 整理姓名、班級、座號、測驗名稱、分數、總題數、百分比與作答內容成 payload。\n4. 使用 google.script.run 呼叫 saveQuizResult(payload)。\n5. 加入 withSuccessHandler 與 withFailureHandler。\n6. 傳送時停用按鈕並顯示傳送中；成功後顯示已送出；失敗時允許重試。\n7. 不收集不必要的個人資料。\n\n【限制】\n- 由 Apps Script HTML Service 顯示，不使用外部 fetch 或第三方資料庫。\n- 不加入登入、排行榜或複雜管理後台。\n- 不省略檔案內容，加入繁體中文註解。\n\n【原始 HTML】","以下 Apps Script 測驗目前可以正常送出成績。\n\n請只新增「避免重複提交」功能：\n1. 點擊後立即停用送出按鈕。\n2. 成功前顯示「傳送中」。\n3. 成功後按鈕改成「已送出」，不可再次點擊。\n4. 失敗時恢復按鈕，允許重新送出。\n5. 不刪除原本測驗與寫入試算表功能。\n6. 分別回傳修改後的 Code.gs 與 Index.html。\n\n【Code.gs】\n\n【Index.html】","你是一位 Google Apps Script 除錯老師。\n\n【我完成到哪一步】\n\n【正式網址能不能開】\n\n【按送出後看到什麼】\n\n【Apps Script 錯誤或執行記錄】\n\n【試算表是否新增資料】\n\n【Code.gs】\n\n【Index.html 中與送出相關的程式】\n\n請回答最可能原因、先檢查的設定、最小修改方案、修改後完整函式，以及修正後要重測的 3 個案例。不要重寫整個專案，也不要要求我公開試算表或任何金鑰。","以下是 Google 試算表「測驗紀錄」的欄位與匿名化資料。\n\n請先不要產生新程式，先協助我回答：\n1. 有多少人完成？\n2. 班級平均與完成率是多少？\n3. 哪些題目最多人答錯？\n4. 哪些資料不足以支持結論？\n5. 下一堂課可以安排哪三種複習活動？\n\n請把計算方式、需要的欄位與適合的試算表公式分開列出。不要捏造缺少的資料，也不要輸出學生個人敏感資訊。\n\n【欄位與匿名化資料】","請保留 Index.html → google.script.run → Code.gs → Google 試算表的資料路線，改造成【課前調查／課後回饋／闖關紀錄／作品互評】系統。\n\n請先輸出：\n1. 新系統的使用者與目的。\n2. 要收集的最少欄位。\n3. 不應收集的個人資料。\n4. Index.html 要改的輸入與畫面。\n5. Code.gs 要改的驗證與欄位。\n6. 至少 6 個測試案例。\n\n等我確認後，再分別修改 Code.gs 與 Index.html。"],"interaction":["學生按下送出後，資料要經過哪三個地方才會到老師手上？","如果把送出按鈕當成打地鼠連按三次，試算表會發生什麼？","只有老師自己的電腦能開，算正式完成嗎？","收回成績後，你最想先回答哪一個教學問題？"],"branches":[{"title":"救援卡","subtitle":"先收到一筆就通關","items":["直接使用教師 Code.gs 與 Index.html","取得正式網址","同學送出後試算表新增一列"]},{"title":"共同主線","subtitle":"做成班級可用版","items":["必填與欄位驗證","傳送中、成功、失敗","防止重複提交並記錄作答內容"]},{"title":"支線任務","subtitle":"讓資料真的幫助教學","items":["班級平均與完成率","各題答對率與錯題排行","伺服器計分或教師結果頁"]}],"checks":["正式網址能由別人開啟嗎？","姓名留白會阻止送出嗎？","正常作答會新增一列嗎？","連按會產生重複資料嗎？","傳送失敗能看到訊息並重試嗎？","欄位順序與分數正確嗎？","更新程式後有更新部署嗎？","是否只收集必要資料？"],"resources":[{"label":"開啟 GAS Starter 與可複製程式碼","href":"/class/examples/lesson-03-gas-starter.html"},{"label":"先玩測驗送出流程預覽","href":"/class/examples/lesson-03-gas-quiz-preview.html"}],"source":"<a href=\"https://developers.google.com/apps-script/guides/web\" target=\"_blank\" rel=\"noopener\">Google Apps Script Web Apps</a>、<a href=\"https://developers.google.com/apps-script/guides/html/communication\" target=\"_blank\" rel=\"noopener\">google.script.run</a>、<a href=\"https://developers.google.com/apps-script/reference/spreadsheet/sheet\" target=\"_blank\" rel=\"noopener\">Sheet.appendRow</a>；學生資料與部署權限須由教師確認。"},
'04':{
  title:'把 Google 雲端硬碟變成你的網頁伺服器',
  tag:'VIBE CODING / GOOGLE APPS SCRIPT',
  accent:'#3d8dff',
  lede:'用 Google Apps Script 把完成的 Vibe Coding 網頁部署成可分享的 Web App，再從族語單字卡一路升級到聽力測驗與成績紀錄。',
  goals:[
    '理解 doGet、HTML Service、測試部署 /dev 與正式部署 /exec 的角色',
    '整理 index.html、圖片、CSS、JavaScript 與音檔，辨認相對路徑、公開權限與 iframe 沙盒限制',
    '完成 Web App 部署、跨帳號／跨裝置驗收，以及修改後發布新版本',
    '用五段 AI 指令逐步製作族語單字卡、聽力測驗、音檔配對與成績紀錄'
  ],
  steps:[
    '準備 Google 帳號、桌機瀏覽器，以及一份可在本機正常開啟的網頁作品',
    '先判斷 GAS 是否適合：低流量教學展示可以；需要自訂網域、高流量或高權限瀏覽器 API 時改用其他部署方式',
    '建立 Apps Script 專案，認識編輯器、檔案清單、執行記錄與「部署」選單',
    '建立 doGet() 與 HTML 檔；若使用圖片、CSS、JavaScript 或音檔，逐項確認路徑與最小必要權限',
    '使用「測試部署」取得 /dev 網址，在擁有編輯權限的帳號確認最新儲存版本',
    '新增「網頁應用程式」部署，依資料敏感度選擇執行身分與存取範圍，再取得 /exec 正式網址',
    '用無痕視窗、另一個帳號與手機測試首頁、圖片、按鈕、連結與錯誤狀態',
    '修改一行文字，建立新版本並更新部署，確認正式網址真的顯示新版',
    '完成基本部署後，再依補充講義的五段提示詞逐項增加單字卡、測驗、音檔與成績功能'
  ],
  practice:'在 30 分鐘內完成三個檢核：另一台裝置可開啟 /exec 網址、所有必要素材正常顯示，以及修改標題後發布新版本並看見更新。',
  output:'可分享的 Web App 正式網址、跨裝置驗收截圖、版本更新紀錄與公開權限檢查表',
  showcase:{
    title:'先體驗成品，再取得課堂素材',
    lede:'先用學生視角完成一次族語聽力測驗，再回到素材資料夾拆解程式碼與音檔。',
    items:[
      {
        label:'成品',
        title:'族語聽力測驗',
        description:'開啟已部署的 Google Apps Script Web App，完整走過開始、作答與結算流程。',
        action:'開啟成品',
        href:'https://script.google.com/macros/s/AKfycbxX8Ot9ZUnLZwIYGHlqygd4q3urC_zKFwUHm6mMu7N2WacYrTFdfJ30oQ8vUM3W_DlP/exec'
      },
      {
        label:'素材',
        title:'課堂素材資料夾',
        description:'取得本堂使用的程式碼範例、音檔與練習素材。',
        action:'開啟素材',
        href:'https://drive.google.com/drive/folders/1tlBxmsOu74q0fJPUuiGq5sW0GzgyGcf5'
      }
    ],
    note:'若 Google 多帳號把成品網址導向錯誤帳號，請改用無痕視窗開啟原始 /exec 網址。'
  },
  codeFiles:[
    {
      id:'codegs-04',
      name:'Code.gs',
      description:'讀取試算表題庫、配對 Drive 音檔，並由後端轉成 Base64 供瀏覽器播放。',
      copyLabel:'一鍵複製 Code.gs',
      href:'/class/examples/lesson-04-code.gs?v=20260901f'
    },
    {
      id:'quiz-html-04',
      name:'quiz.html',
      description:'顯示聽力題目、四個選項、答題回饋與最後得分。',
      copyLabel:'一鍵複製 HTML',
      href:'/class/examples/lesson-04-quiz.html?v=20260901e'
    }
  ],
  promptNames:[
    '階段一｜建立最基礎的網頁單字卡',
    '階段二｜升級成四選一聽力測驗',
    '階段三｜一鍵自動配對音檔',
    '階段四｜以 Base64 載入受保護音檔',
    '階段五｜建立成績與錯題紀錄'
  ],
  prompts:[
    '我是一位族語老師，我有一份包含「族語、中文、例句」的單字清單，目前整理在 Google 試算表中。請幫我寫一段 Google Apps Script（GAS）程式碼，功能需求如下：\n\n1. 讀取試算表資料。\n2. 建立一個前端網頁 card.html，要有 3D 翻牌動畫效果的單字卡。\n3. 正面顯示族語，點擊卡片會翻面顯示中文與例句。\n4. 網頁要有「上一張／下一張」按鈕可以切換單字。\n5. 只讀取我指定的工作表，不公開試算表 ID 或不必要的資料。\n\n請給我完整的 Code.gs 與 card.html，並告訴我如何部署、如何測試，以及哪些權限需要由我確認。',
    '我想把剛才的單字卡升級成「聽力測驗網頁 quiz.html」。請幫我修改前端與後端程式碼：\n\n1. 題目隨機洗牌，每次載入順序都不同。\n2. 每題播放試算表 D 欄的發音檔。\n3. 顯示 4 個中文選項：1 個正確、3 個從其他單字隨機取得。\n4. 作答後立即回饋；答對變綠，答錯變紅並顯示正確答案與族語文字。\n5. 加入計分與最後結算畫面。\n6. 不允許重複作答或重複加分；沒有音檔時要顯示可理解的錯誤。\n\n請保留已能運作的功能，分別提供修改後的 Code.gs 與 quiz.html，並列出至少 6 個測試案例。',
    '錄音檔都放在 Google 雲端硬碟的一個資料夾，檔名可能像 01-43_amin.wav、cacay_a_pulu.mp3。請在 Apps Script 建立「族語小工具 → 自動填入音檔」自訂選單：\n\n1. 掃描我指定且有權限的資料夾。\n2. 清洗檔名：去除前方數字編號、將底線轉空格、去除副檔名。\n3. 與試算表 A 欄族語比對。\n4. 成功才把可播放的檔案連結填入 D 欄。\n5. 完成後回報成功筆數、未配對、重複檔名與一對多衝突。\n6. 先提供 dry run 預覽，不要在我確認前覆寫既有 D 欄資料。\n\n請提供完整函式、必要權限、回復方式與測試案例。',
    '聽力測驗中的 Google Drive 音檔無法穩定播放。請先診斷權限、連結格式、CORS／瀏覽器限制與 Apps Script 配額，再提供最小修改方案。若確實需要 Base64：\n\n1. 後端接收 Drive 檔案 ID，驗證檔案類型與大小後轉成 Base64 資料流回傳。\n2. 前端透過 google.script.run 非同步取得資料，播放按鈕先顯示「音檔準備中…」。\n3. 成功後才建立 audio 來源並顯示「點此播放發音」。\n4. 加入成功與失敗處理、逾時提示及有限度快取。\n5. 不把永久金鑰、OAuth token 或非必要檔案內容送到瀏覽器。\n\n請分別提供修改後的 Code.gs、quiz.html 與效能／配額限制說明。',
    '請在目前可正常運作的測驗加入學習者資料與成績回報：\n\n1. 首頁輸入姓名或代碼，並選擇 5、10、20 題或全部。\n2. 結算後透過 google.script.run 傳送成績。\n3. 後端驗證必要欄位與分數範圍；不要只相信前端傳回的百分比。\n4. 若「成績紀錄」工作表不存在才建立，欄位包含測驗時間、學習者、得分、總分、答對率與錯題。\n5. 送出時顯示傳送中；成功後鎖定；失敗可重試；使用 submission_id 防止重複寫入。\n6. 只收集教學必要資料，說明保存期限與誰能查看。\n\n請保留原測驗功能，提供完整 Code.gs、quiz.html，以及成功、驗證失敗、重複送出與網路失敗測試。'
  ],
  interaction:[
    '你現在手上的網址是 file://、localhost、/dev，還是可分享的 /exec？',
    '哪些素材必須讓學生讀到？哪些學生姓名、錄音或試算表資料絕對不該公開？',
    '程式已儲存但正式網頁沒更新時，下一步應該檢查什麼？',
    '如果一個外部程式庫要求讀取整個雲端硬碟，你會先做哪三項確認？'
  ],
  warnings:[
    '/dev 測試網址只供擁有指令碼編輯權限的人使用；交作業或給學生時要驗收 /exec 正式網址。',
    '學校 Workspace 可能不提供「任何人」或匿名公開選項；請依校方政策選擇最小存取範圍。',
    'Drive 資料夾設為知道連結者可查看，代表連結持有人可以讀取；學生姓名、錄音與成績不要放進公開資料夾。',
    '簡報中的外部 Script Library 僅作為來源案例；未檢查原始碼、維護者與 OAuth 權限前，不要授權正式資料。',
    'Apps Script 配額依帳號與服務而異且可能調整；不要把「可同時多少人使用」當成固定保證。'
  ],
  branches:[
    {title:'救援卡',subtitle:'先讓一頁成功上線',items:['使用沒有外部圖片的單一 index.html','只完成 doGet、測試部署與正式部署','請同學用另一個帳號打開 /exec']},
    {title:'共同主線',subtitle:'做成可分享的教材',items:['整理圖片、CSS、JS 與權限','完成桌機、手機、無痕與同儕測試','修改一行文字並發布新版本']},
    {title:'支線任務',subtitle:'部署成功再加功能',items:['Google Sheets 族語單字卡','四選一聽力測驗與音檔配對','成績／錯題紀錄與防重複送出']}
  ],
  checks:[
    '本機原始頁面能完整操作嗎？',
    '/dev 是否只有編輯者可開？',
    '/exec 是否能由另一個帳號開啟？',
    '圖片、CSS、JavaScript 與音檔都正常嗎？',
    '權限是否只開到完成教學所需的範圍？',
    '更新後是否建立新版本並更新部署？',
    '手機與無痕視窗是否完整走完流程？',
    '錯誤狀態是否有訊息與重試方法？',
    '外部函式庫是否已檢查來源與權限？',
    '是否避免公開學生姓名、錄音、成績與永久金鑰？'
  ],
  resources:[
    {label:'下載 44 張可編輯課程 PPT',href:'/class/ppt/lesson-04.pptx?v=20260901a'},
    {label:'開啟五段 AI 指令補充 PDF',href:'/class/handouts/lesson-04-ai-five-prompts.pdf?v=20260901a'},
    {label:'Google 官方：部署 Web App',href:'https://developers.google.com/apps-script/guides/web'},
    {label:'Google 官方：HTML Service 限制',href:'https://developers.google.com/apps-script/guides/html/restrictions'},
    {label:'Google 官方：前後端通訊',href:'https://developers.google.com/apps-script/guides/html/communication'},
    {label:'Google 官方：服務配額',href:'https://developers.google.com/apps-script/guides/services/quotas'}
  ],
  supplement:{
    title:'補充講義｜從單字卡一路做到聽力測驗與成績追蹤',
    lede:'一次只複製一個階段給 AI，確認可運作再往下走。同一個對話持續修改，並在每一步保留上一個可用版本。這份 PDF 提供提示詞與規格，不是可直接執行的完整程式。',
    stages:[
      ['01','3D 翻牌單字卡','讀取 Sheets 的族語、中文、例句，先完成最小可用的 card.html。'],
      ['02','四選一聽力測驗','加入隨機題目、音檔、即時回饋、計分與結算。'],
      ['03','音檔自動配對','清洗 Drive 檔名後比對 A 欄，先 dry run 再寫入 D 欄。'],
      ['04','穩定載入音檔','先診斷權限；必要時以 google.script.run 取得 Base64，並限制大小與快取。'],
      ['05','成績與錯題紀錄','後端驗證、最少個資、傳送狀態與 submission_id 防重複。']
    ],
    troubleshooting:[
      ['音檔沒聲音','先查檔案權限、檔案 ID、網路與瀏覽器主控台，再考慮 Base64。'],
      ['改了程式但網頁沒變','/dev 讀最新儲存內容；/exec 要到「管理部署」更新到新版本。'],
      ['別人打不開','檢查部署的存取範圍、學校網域政策與是否誤傳 /dev。'],
      ['AI 程式跑不動','保留可用版本，貼完整錯誤訊息、檔名、重現步驟與最小相關程式碼。']
    ]
  },
  source:'主教材：使用者提供的 44 張〈把 Google 雲端硬碟變成你的網頁伺服器〉PPT；補充教材：使用者提供的 3 頁〈族語數位教材：給 AI 的五段指令〉PDF。技術查核依 <a href="https://developers.google.com/apps-script/guides/web" target="_blank" rel="noopener">Google Apps Script Web Apps</a>、<a href="https://developers.google.com/apps-script/guides/html/restrictions" target="_blank" rel="noopener">HTML Service 限制</a>、<a href="https://developers.google.com/apps-script/guides/html/communication" target="_blank" rel="noopener">google.script.run</a> 與 <a href="https://developers.google.com/apps-script/guides/services/quotas" target="_blank" rel="noopener">服務配額</a>（2026-09-01 查核）。'
},
'05':{title:'讓你的網頁活起來：Google 協作平台與 Netlify 上架',tag:'GOOGLE SITES / NETLIFY',accent:'#147d7e',lede:'把作品整理、發布，變成別人打得開、看得懂、可以使用的網址。',goals:['理解內容結構、嵌入、權限與發布','用 Google Sites 包裝教學作品','認識 Netlify 靜態網站部署與檢查'],steps:['規劃首頁、導覽、作品、說明與資源頁','Google Sites 加入文字、圖片、檔案與嵌入','預覽桌機與手機版','發布並確認 Published site 權限','Netlify 部署後檢查路徑、網址與資產'],practice:'把第 3–4 堂題庫作品包裝成 Google Sites 或 Netlify 網站。',output:'可開啟、可分享的線上作品網址',prompts:['請把我的作品整理成教學網站，規劃首頁、作品介紹、操作步驟、學習資源、作品展示與聯絡方式。','請產生 Google Sites 發布前檢查表，包含預覽、連結、手機版、權限與個人資料。','請產生 Netlify 靜態網站上架前檢查表，包含檔案路徑、首頁、資產、公開網址與回復方式。'],source:'https://support.google.com/sites/answer/6372880?hl=en；https://docs.netlify.com/'},
'06':{title:'一份教材生出 5 種遊戲：生成方法',tag:'GAME GENERATION / FIVE FORMS',accent:'#e3a62f',lede:'固定同一份教材，一次產生五種不同的遊戲化方向。',goals:['理解教材、任務、挑戰的轉換公式','一次生成 RPG、卡牌、密室、經營、偵探五種遊戲','保留每種遊戲的教材來源與限制'],steps:['固定教材與學習目標','指定五種遊戲形式','要求每種都有規則、任務與勝利條件','整理成比較表','排除沒有真正使用教材的方案'],practice:'用同一份教材生成五種遊戲提案，不更換學習內容。',output:'五種遊戲提案比較表',prompts:['請根據同一份教材，設計 RPG、卡牌、密室逃脫、模擬經營、偵探解謎五種遊戲。每種都要有目標、規則、3 個任務、回饋、獎勵與勝利條件。','請確保五種遊戲都使用相同的教材內容，並標出每個任務對應的教材段落。','請列出這五種遊戲各自的優點、限制、製作成本與適合的課堂情境。'],source:'課程自製遊戲化設計框架'},
'07':{title:'一份教材生出 5 種遊戲：比較與實作',tag:'GAME PROTOTYPE / PLAYTEST',accent:'#e3a62f',lede:'從五個方向選出一個真正能上課的遊戲，做出最小可玩版本。',goals:['用評分表選擇遊戲形式','把創意變成可執行規則','完成 10 分鐘可試玩的原型'],steps:['依教材貼合度、時間、參與度、成本、評量打分','選出主方案與備案','刪掉不必要機制','用紙張或投影片做原型','找同儕試玩並記錄問題'],practice:'完成遊戲選擇評分表，並讓同學試玩 10 分鐘。',output:'遊戲選擇評分表與最小可玩原型',prompts:['請比較這五種遊戲，依教材貼合度、課堂時間、製作難度、學生參與度與學習評量各 1–5 分。','請把推薦遊戲縮小成 10 分鐘可試玩的最小版本，只保留核心規則。','請根據試玩回饋，分類問題為規則、教材、操作、時間與評量，並提出修正順序。'],source:'課程自製遊戲化設計框架'},
'08':{title:'什麼？我可以用 Gemini 製作自己的 Padlet？',tag:'GEMINI / PADLET',accent:'#147d7e',lede:'用 Gemini 規劃一面真正服務課堂的協作牆。',goals:['理解 Padlet 的課堂協作用途','讓 Gemini 規劃欄位與學生任務','建立發文、回饋與教師總結規則'],steps:['決定課堂任務與學習目標','請 Gemini 產生 Padlet 欄位結構','建立至少四欄與一則範例貼文','設定發文與留言權限','設計收尾分享與教師總結'],practice:'製作一面課堂任務牆或作品展覽牆，包含四個欄位與回饋規則。',output:'Padlet 牆面規劃、發文模板與課堂流程',prompts:['請幫我設計一個 Padlet 課堂協作牆。主題是【】，學生是【】，請規劃欄位、任務、發文格式、同儕回饋與教師總結。','請幫我寫一份學生發文模板，限制在 100 字內並加入一個必答問題。','請檢查這面 Padlet 是否有重複、空泛或學生不知道怎麼做的欄位。'],source:'Padlet 實作課程；實際功能與權限依 Padlet 帳號方案為準'},
'09':{title:'Google Vids：單字與會話圖卡影片',tag:'GOOGLE VIDS / FLASHCARDS',accent:'#d45a4a',lede:'把文字教材拆成圖卡、字幕、旁白與互動複習，完成第一支學習影片。',goals:['用 Gemini 規劃影片分鏡','把單字與會話拆成場景','完成圖卡、字幕、旁白與節奏'],steps:['整理單字、例句與會話','使用 Google Vids 的 Help me create','檢查 outline、腳本與場景','替換圖卡與媒體','調整時間、字幕、旁白與片尾問題'],practice:'製作至少六幕、60–90 秒單字與會話圖卡影片。',output:'單字與會話圖卡影片初版',prompts:['請把以下單字與會話教材設計成 60–90 秒 Google Vids 教學影片，每幕只放一個學習重點，提供畫面、字幕、旁白與互動問題。','請檢查每一幕是否只教一個重點，並刪除會造成認知負擔的內容。','請為這支影片設計片尾 3 題複習題，答案只能來自教材。'],source:'https://support.google.com/a/users/answer/14819770?hl=en'},
'10':{title:'Google Vids：故事有聲書',tag:'GOOGLE VIDS / AUDIOBOOK',accent:'#d45a4a',lede:'把故事教材變成有畫面、有旁白、有角色對話與理解問題的影片。',goals:['用故事結構規劃影片','用 Vids 產生分鏡、腳本與旁白','完成可播放的 2–3 分鐘故事有聲書'],steps:['整理故事角色、場景與事件','請 Gemini 產生 8–10 幕 outline','逐幕確認旁白、對話與字幕','加入畫面、聲音與轉場','輸出後檢查故事連貫、字幕與音量'],practice:'完成一支 8–10 幕故事有聲書，片尾加入三題理解問題。',output:'故事有聲書影片與腳本',prompts:['請把這份故事教材改編成 Google Vids 有聲書，提供 8–10 幕分鏡、畫面、旁白、對話、字幕與音效建議。','請檢查改編內容是否超出原始故事，並把新增設定標示出來。','請為故事設計片尾三題理解題，分成找訊息、理解因果與表達感想。'],source:'https://support.google.com/a/users/answer/14819770?hl=en'},
'11':{title:'打造你的備課工具箱',tag:'TEACHER WORKBENCH / SOP',accent:'#3d8dff',lede:'把前面做過的工具組成每天真的用得到的備課流程。',goals:['盤點自己的重複工作','選擇適合的 AI 工具與資料入口','建立可重複使用的模板與 SOP'],steps:['盤點一週備課工作','找出最耗時與最重複的步驟','組合 NotebookLM、Gemini、GAS、Padlet、Vids 與簡報','建立模板、命名與版本規則','寫成一頁 SOP 並跑一次'],practice:'完成自己的 AI 備課工具箱地圖、一頁 SOP 與模板包。',output:'個人 AI 備課工具箱、模板包與 SOP',prompts:['請根據我的備課工作，設計一套可重複使用的 AI 備課工具箱，分成資料整理、教案、題庫、互動、影片、簡報與檢查。','請將這套工具箱整理成一頁式 SOP，包含輸入、工具、輸出、人工檢查與保存位置。','請找出流程中的單點失敗風險，並提出沒有 AI 也能繼續工作的備案。'],source:'課程整合設計；工具功能需依實際帳號與環境確認'},
'12':{title:'期末發表',tag:'CAPSTONE / PRESENTATION',accent:'#101827',lede:'把 11 堂課累積的作品，說成一個清楚、有證據、能被理解的故事。',goals:['清楚說明問題與使用情境','展示工具流程與作品證據','回應提問並說明限制與下一步'],steps:['完成作品包與 README','整理 5–8 分鐘簡報','準備 live demo 或錄影','同儕彩排與修正','正式發表、問答與反思'],practice:'完成作品展演、簡報、提示詞紀錄、測試證據與反思報告。',output:'期末作品包、簡報、README 與反思報告',prompts:['請把我的期末作品整理成 5–8 分鐘發表簡報，包含問題、對象、工具、流程、成果證據、人工檢查、限制與下一步。','請扮演評審，提出 8 個可能問題，並幫我準備不誇大成果的回答。','請幫我檢查作品包是否足以讓另一位使用者依 README 重現基本流程。'],source:'課程期末發表規格'}
};
const FULL_PROMPT=`你是一位熟悉國中教學、遊戲化學習與 RPG 任務設計的課程設計師。

請根據我上傳的 PDF：「112年情境族語_01上課用語_33太魯閣語」設計一份「太魯閣語上課用語遊戲化 RPG」簡報。

重要規則：
1. 只能使用 PDF 中確認存在的太魯閣語詞彙、句子與中文意思。
2. 不可以自行創造、改寫或猜測太魯閣語。
3. 如果 PDF 沒有提供資料，請標示「來源未提供」，不要自行補充。
4. 遊戲故事、角色名稱與任務情境可以創作，但必須與語言教材內容清楚區分。
5. 每一個語言學習內容都要標示來自 PDF 的頁碼或來源位置。
6. 請特別檢查太魯閣語與中文翻譯是否完全依照 PDF。
7. 遊戲設計要適合國中學生，簡單、清楚、可以實際進行。

請完成以下內容：

一、教材內容分析：整理 PDF 中的上課用語；列出每一句太魯閣語、中文意思與使用情境；分成 3 至 5 個學習主題；標示 PDF 頁碼或來源位置。

二、RPG 遊戲設定：遊戲名稱、背景故事、玩家角色、遊戲任務、能力值或經驗值、學習目標、過關條件、獎勵與徽章、答錯或不會時的學習回饋。

三、關卡設計：至少 3 個關卡，請用「關卡、故事任務、要練習的上課用語、玩家行動、過關條件、獎勵」表格呈現。每個關卡都必須使用 PDF 中的實際語言資料。

四、簡報大綱：設計 8 至 12 張投影片，欄位包含頁次、投影片標題、內容重點、建議畫面、講者說明、使用來源。至少包含遊戲名稱、學習動機、RPG 世界觀、玩家角色、學習目標、第 1 至 3 關、能力值與獎勵系統、學習評量方式、PDF 資料來源與 Gemini Notebook 使用方式，以及未來如何做成真正的課堂活動。

五、最後整理：本簡報使用到的 PDF 頁碼、仍需要老師確認的語言內容、Gemini Notebook 可能產生錯誤的地方、建議族語教師人工檢查的項目，以及如何把 RPG 活動帶進國中課堂。

輸出時請嚴格區分「PDF 確認資料」、「遊戲創作設定」與「需要教師確認的內容」。`;
const ESCAPE_PROMPT=`請依據來源文件中的太魯閣語「上課用語」與單詞，製作一份「RPG 教室逃脫闖關遊戲」主題簡報。

【簡報風格與結構要求】
1. 風格設定：冒險 RPG 像素風格遊戲感，將課堂生活包裝成 4 個「逃脫關卡」，每關卡由「情境事件投影片」接續「答案與通關解析投影片」。
2. 題目設計嚴格依據文件內容，提供 ABC 選項，並標註族語與中文對照。所有族語拼音與中文意思都必須逐字核對來源。
3. 頁面規劃（共約 9–10 頁）：
   - Slide 1：【封面】太魯閣族語冒險：勇闖奇幻教室（RPG 逃脫大作戰）
   - Slide 2：【遊戲規則與角色血量設定】答錯扣血，答對獲得部落勇士星星
   - Slide 3：【第一關：鐘聲響起的危機】學生遲到進教室，該對老師說什麼才能安全入座？選項測驗：Ini ta kla, qsuqi ku dhuq da!
   - Slide 4：【第一關：通關揭曉】正確族語解析、單詞 Qsuqi 說明與老師的回應：Iyah mtmay nhari.
   - Slide 5：【第二關：保健室大逃脫】突然肚子痛或想吐，如何向老師正確請假上廁所？選項測驗：Qntpbrih ku, mha ku ngangut han. / Mnarux buyas mu
   - Slide 6：【第二關：通關揭曉】身體症狀單詞解析：Buyas、Qntpbrih、Tkuni、Knrikit
   - Slide 7：【第三關：時間魔法陣】明天是星期幾？該如何跟同學約去打球或去教會？選項測驗：Tgtru jiyax iyax sngayan / Jiyax sngayan
   - Slide 8：【第三關：通關揭曉】星期時間詞彙與活動配對解析
   - Slide 9：【終極魔王關：點名風暴】老師問「Iwal 為何沒來？」，如何用族語回答？選項：Mnarux tunux na da. / mcilux
   - Slide 10：【結算與勝利】成功逃離教室，恭喜成為太魯閣語對話大師！全單詞總複習。

請確保所有族語拼音完全符合來源文件，繁體中文字體排版清晰美觀。若來源文件沒有提供某個答案、翻譯或單詞，請標示「來源未提供」，不可自行創造、改寫或猜測。

輸出每一頁時，請另外標註：使用到的來源頁碼或位置、這一頁的學習目標、教師講解重點，以及學生答錯時的提示。請嚴格區分「來源語言資料」與「RPG 故事設定」。`;
const ADVANCED_RPG_PROMPT=`你是一位頂尖的網頁遊戲開發者與數位語言教學設計師。請將我提供的原住民族語教材製作成一款單一 HTML 檔案的 2D 像素風格校園冒險 RPG 遊戲。

【RPG 定義】
RPG 是讓學習者扮演角色，在故事情境中完成任務，透過挑戰、回饋與角色成長學會教材。遊戲故事可以創作，但族語、中文翻譯與學習資料只能使用來源文件確認的內容。

【技術要求】
1. 輸出完整且可直接運行的 <!DOCTYPE html> 程式碼。
2. 所有 HTML、Tailwind CSS CDN、FontAwesome、Canvas 繪圖與 JavaScript 遊戲引擎整合在同一個 HTML 檔案。
3. 使用 HTML5 Canvas 渲染 2D 像素風格地圖，包含族語教室、保健室與走廊洗手台、校園廣場與河邊或教會等可切換場景。
4. 支援 WASD、方向鍵、手機觸控方向鈕，以及 E 鍵或點擊互動。
5. 使用深色 8-bit / NES 風格介面，並保持繁體中文清楚易讀；本遊戲採靜音圖文模式。

【遊戲玩法】
1. 玩家與老師、同學、好友 NPC 互動時，顯示族語原文、讀音指引與 3 個中文選項；1 個正確、2 個合理干擾。
2. 答對顯示綠色回饋、正式中文翻譯與繼續對話；答錯顯示紅色提示並允許重試。
3. 放置三個互動寶箱：詞序重組、單詞配對、日期星期與活動情境問答。
4. 導覽列提供字卡圖鑑庫，逐步解鎖單詞、中文意思、例句與分類標籤。
5. 設計角色血量、經驗值、星星或徽章，但獎勵不能取代學習目標。

【教材資料】
請只使用我附上的來源文件與以下已確認資料，並將所有族語拼音、中文翻譯與例句回到來源核對。若來源沒有提供，請標示「來源未提供」，不可自行創造、改寫或猜測。

課堂禮貌：
- Miyah ka mtgsa da!（老師來了！）
- Iya rawa duri ha, Usa tluung tleegan nhari hiya.（不要再玩了，快坐在座位上。）
- Ini ta kla, qsuqi ku dhuq da!（抱歉，我遲到了！）
- Iyah mtmay nhari.（快進來。）

健康與請假：
- Mtgsa, mnarux buyas mu, mha ku ngangut han.（老師，我肚子痛，要去廁所。）
- Mnarux tunux na da. / mcilux.（發燒而且頭痛。）
- Mtgsa, mnarux glu na ka Rudaw, ga msangay ka sayang.（老師，Rudaw 喉嚨痛，今天請假。）

日期與週末行程：
- Tgpiya jiyax iyax sngayan ka sayang hug?（今天星期幾？）
- Tgrima jiyax iyax sngayan ka sayang!（今天星期五！）
- Jiyax sngayan ka saman, mowsa ku Pnrhulan tuhuy bubu mu.（明天是星期日，我要和媽媽去教會。）

單詞庫：Ngangut（廁所）、Mluqih（受傷）、Qsuqi（遲到）、mcilux（發燒）、Glu（喉嚨）、Buyas（肚子）、mnarux（痛／生病）、tkuni（暈）、Knrikit（趴著）、Tgrima jiyax iyax sngayan（星期五）、Tgtru jiyax iyax sngayan（星期三）、Jiyax sngayan（星期日／放假日）。

【輸出前檢查】
請檢查每一個題目、選項、答案、NPC 對話、字卡與翻譯是否有來源依據；列出使用到的來源位置、仍需族語教師確認的內容、可能錯誤與測試方式。最後只輸出完整可運行的 <!DOCTYPE html> 程式碼，不要輸出 Markdown 說明文字。`;
const SCRIPT_PROMPTS=[
`請只根據我提供的來源分析教材。不要新增教材中不存在的族語內容。請整理：1. 主題 2. 核心學習內容 3. 可以拆成哪些小能力 4. 學習順序 5. 整合任務 6. 需要老師確認的部分。最後整理成「基礎 → 理解 → 應用 → 綜合任務」四個層次。`,
`根據目前教材，提出 5 種適合學生的 RPG 任務情境。不得自行新增族語、文化、祭儀或傳說內容。每種包含：世界觀、玩家角色、最終任務、以及為什麼適合這份教材。`,
`將教材設計為 4 個普通關卡＋1 個 Boss。第一關最容易，讓學生快速進入狀況；第二關理解教材內容；第三關開始使用所學內容；第四關整合兩項以上能力；Boss 必須實際使用本課所學能力完成挑戰。每關列出名稱、故事、學習目標、學生任務、教材內容、過關條件、教師準備與卡住時的提示。不得自行新增族語內容。`,
`請將我們完成的 RPG 教學設計轉換成課堂簡報腳本。不要自行新增任何族語內容。簡報包含：封面、故事開場、最終任務、冒險地圖、每個關卡的故事頁與挑戰頁、過關提示頁、Boss 關、任務完成、今日學到什麼。每張提供頁碼、標題、畫面內容、老師要說什麼、學生要做什麼與建議圖片；文字要短，一頁只呈現一個主要概念。`,
`請幫我在現有 RPG 課程中加入 2 個簡單的選擇點。不要增加新的學習內容，不要讓老師需要準備兩整套課程；無論學生選哪個選項，最後仍回到相同學習目標。請說明 A 選項、B 選項，以及最後如何重新匯合。`,
`不要修改教材。請只將目前的 RPG 教材內容分類為：A. 明確來自我提供教材的內容；B. AI 加入的教學設計、活動或故事框架；C. 可能需要老師再次確認的語言、文化或知識內容。如果有任何族語文字不是直接來自來源，請特別標示出來。不要自行修正，只需要指出問題。`
];
const id=(location.pathname.match(/lesson-(\d+)/)||[])[1]||'01';
const d=DATA[id]||DATA['01'];
const root=document.querySelector('#lesson');
document.title=`第 ${id} 堂｜${d.title}｜CALUMAI`;
const assetVersion=id==='04'?'?v=20260901a':'';
const ppt=`/class/ppt/lesson-${id}.pptx${assetVersion}`;
const slideCounts={'01':9,'02':12,'03':12,'04':44};
const slideTotal=slideCounts[id]||8;
let slideHtml='';
if(id!=='04'){
  for(let i=1;i<=slideTotal;i++){
    const n=String(i).padStart(2,'0');
    slideHtml+=`<figure class="slide-frame"><img loading="lazy" decoding="async" src="/class/ppt-preview/${id}/slide-${n}.png${assetVersion}" alt="第 ${id} 堂 PPT 第 ${i} 張"><figcaption>第 ${i} 張</figcaption></figure>`;
  }
}
const slidePreviewHtml=id==='04'
  ? `<div class="slide-player-shell"><iframe class="slide-player-embed" src="/class/slideshow.html?lesson=${id}&embed=1" title="第 ${id} 堂 Google Apps Script 投影片播放器" loading="lazy" allow="fullscreen" allowfullscreen></iframe></div><div class="slide-player-actions"><span>${slideTotal} 張完整投影片，可直接翻頁或開啟縮圖。</span><div><a href="/class/slideshow.html?lesson=${id}" target="_blank" rel="noopener">另開大畫面播放器</a><a href="${ppt}">下載可編輯 PPT</a></div></div>`
  : `<div class="slide-grid">${slideHtml}</div><p><a class="download-secondary" href="${ppt}">需要時下載可編輯 PPT</a></p>`;
const allPrompts=id==='01'?[...d.prompts,...SCRIPT_PROMPTS,FULL_PROMPT,ESCAPE_PROMPT,ADVANCED_RPG_PROMPT]:d.prompts;
const promptHtml=allPrompts.map((p,i)=>{
  const label=(d.promptNames&&d.promptNames[i])||`提示詞 ${i+1}`;
  return `<div class="prompt-block"><div class="prompt-label">${label}</div><textarea readonly id="prompt-${i}">${p}</textarea><button class="copy-btn" data-copy="prompt-${i}">複製提示詞</button></div>`;
}).join('');
const opening=id==='01'?'<section class="teaching-intro lesson-card"><h2>為什麼先談遊戲教學？</h2><p>遊戲教學不是把課堂變成單純玩遊戲，而是把學習目標、練習、回饋與成長設計成學生願意參與的任務流程。</p><h3>遊戲教學的好處</h3><ul><li>提高參與動機與持續練習意願</li><li>把語言放進有意義的情境</li><li>提供立即回饋、重試與可見的成長</li><li>促進合作、表達與成果展示</li></ul><h3>為什麼選 RPG？</h3><p>RPG 能把角色、任務、關卡、能力值與回饋串成一條成長路線，適合將 PDF 中的上課用語放進連續情境。</p><h3>除了 RPG 還能做什麼？</h3><p>同一份教材也可以做成卡牌配對、密室逃脫、模擬經營、偵探解謎、闖關問答、合作任務或故事分支。</p><p><a class="download-secondary" href="/class/examples/lesson-01-examples.html">預覽第一堂課兩份 RPG PDF 範例 ↗</a></p><p><a class="download-secondary" href="/class/examples/lesson-01-rpg-examples.zip">下載第一堂課兩份 RPG PDF 範例（ZIP）</a></p><p><a class="download-secondary" href="/class/examples/truku-campus-rpg-example.html" target="_blank" rel="noopener">開啟族語 2D RPG 校園大冒險 HTML 範例 ↗</a></p></section>':'';
const interactionHtml=d.interaction?`<section class="lesson-card discussion"><p class="eyebrow" style="color:${d.accent}">先聊聊 / 沒有標準答案</p><h2>用有趣的問題打開這堂課</h2><ul>${d.interaction.map(x=>`<li>${x}</li>`).join('')}</ul></section>`:'';
const warningsHtml=d.warnings?`<section class="lesson-card safety-card"><p class="eyebrow" style="color:${d.accent}">部署前先看 / 權限與資料</p><h2>能上線，也要安全地上線</h2><ul>${d.warnings.map(x=>`<li>${x}</li>`).join('')}</ul></section>`:'';
const showcaseHtml=d.showcase?`<section class="lesson-showcase" id="showcase" style="--lesson-accent:${d.accent}"><div class="lesson-showcase-heading"><div><p class="eyebrow" style="color:${d.accent}">第 ${id} 堂成品與素材</p><h2>${d.showcase.title}</h2><p>${d.showcase.lede}</p></div></div><div class="lesson-showcase-links">${d.showcase.items.map((item,index)=>`<a class="lesson-showcase-link${index===0?' is-primary':''}" href="${item.href}" target="_blank" rel="noopener noreferrer"><span class="lesson-showcase-label">${item.label}</span><strong>${item.title}</strong><span class="lesson-showcase-description">${item.description}</span><span class="lesson-showcase-action">${item.action}<span aria-hidden="true">↗</span></span></a>`).join('')}</div><p class="lesson-showcase-note">${d.showcase.note}</p></section>`:'';
const codeFilesHtml=d.codeFiles?`<section class="lesson-code-sample" id="codegs" style="--lesson-accent:${d.accent}"><div class="lesson-code-heading"><p class="eyebrow">可直接貼進 Apps Script</p><h2>一鍵複製兩個完整檔案</h2><p>在同一個 Apps Script 專案建立 <code>Code.gs</code> 與 <code>quiz.html</code>，再依照檔名貼入。</p></div><div class="code-file-list">${d.codeFiles.map(file=>`<article class="code-file" data-code-source="${file.href}" aria-busy="true"><div class="code-file-heading"><div><strong>${file.name}</strong><span>${file.description}</span></div><button type="button" class="copy-btn codegs-copy" data-copy="${file.id}" data-ready-label="${file.copyLabel}" disabled>程式載入中</button></div><details class="codegs-details"><summary>查看完整 ${file.name}</summary><pre id="${file.id}" tabindex="0"><code>程式載入中...</code></pre></details><p class="code-load-status" role="status">正在準備可複製的程式碼。</p><a class="code-raw-link" href="${file.href}" download="${file.name}">下載原始檔</a></article>`).join('')}</div><p class="codegs-note">使用前請確認 A 至 E 欄位、<code>quiz.html</code> 與音檔資料夾 ID。只有需要被 iframe 嵌入時才保留 <code>ALLOWALL</code>。</p></section>`:'';
const branchHtml=d.branches?`<section class="branches"><p class="eyebrow" style="color:${d.accent}">同一條主線，不同任務深度</p><h2>卡住拿救援卡，完成就開支線</h2><div class="branch-grid">${d.branches.map(b=>`<article class="branch-card"><small>${b.subtitle}</small><h3>${b.title}</h3><ul>${b.items.map(x=>`<li>${x}</li>`).join('')}</ul></article>`).join('')}</div></section>`:'';
const checksHtml=d.checks?`<section class="lesson-card check-card"><p class="eyebrow" style="color:${d.accent}">真人測試</p><h2>請另一個人想辦法把作品弄壞</h2><div class="check-grid">${d.checks.map((x,i)=>`<div><b>${String(i+1).padStart(2,'0')}</b><span>${x}</span></div>`).join('')}</div></section>`:'';
const resourcesHtml=d.resources?`<section class="lesson-card resources"><p class="eyebrow" style="color:${d.accent}">課堂素材 / 官方文件</p><h2>${id==='04'?'下載教材，遇到問題回官方文件查證':'先玩一次，再開始修改'}</h2><div class="resource-row">${d.resources.map(r=>`<a href="${r.href}" target="_blank" rel="noopener">${r.label} ↗</a>`).join('')}</div></section>`:'';
const supplementHtml=d.supplement?`<section class="lesson-card supplement-guide" id="supplement"><p class="eyebrow" style="color:${d.accent}">PDF 補充資料</p><h2>${d.supplement.title}</h2><p class="supplement-lede">${d.supplement.lede}</p><div class="stage-list">${d.supplement.stages.map(s=>`<article><b>${s[0]}</b><div><h3>${s[1]}</h3><p>${s[2]}</p></div></article>`).join('')}</div><h3 class="trouble-title">卡住的時候</h3><div class="trouble-list">${d.supplement.troubleshooting.map(t=>`<article><b>${t[0]}</b><p>${t[1]}</p></article>`).join('')}</div></section>`:'';
root.innerHTML=`<section class="lesson-hero" style="border-left-color:${d.accent}"><p class="eyebrow" style="color:${d.accent}">第 ${id} 堂 / ${d.tag}</p><h1>${d.title}</h1><p class="lede">${d.lede}</p><div class="back-row"><a href="#slides">先看 PPT 預覽</a><a class="secondary" href="/class/slideshow.html?lesson=${id}">全螢幕播放投影片</a><a class="secondary" href="#prompts">複製提示詞</a></div></section>${showcaseHtml}${codeFilesHtml}${opening}${interactionHtml}${warningsHtml}<section class="lesson-grid" id="handout"><article class="lesson-card"><h2>課堂目標</h2><ul>${d.goals.map(x=>`<li>${x}</li>`).join('')}</ul><h3>今天的作品</h3><p>${d.output}</p></article><article class="lesson-card"><h2>講義：操作流程</h2><ol>${d.steps.map(x=>`<li>${x}</li>`).join('')}</ol><h3>課堂實作</h3><p>${d.practice}</p></article></section>${branchHtml}${supplementHtml}${checksHtml}${resourcesHtml}<section class="slides-section" id="slides"><h2>PPT 線上預覽</h2><p class="lede">直接在下方翻頁、開啟縮圖或自動播放；點一下播放區後，也可以使用鍵盤左右鍵。</p>${slidePreviewHtml}</section><section class="prompts" id="prompts"><h2>可直接複製的提示詞</h2><p class="lede">一次只選一個任務；修改後立刻測試，確認可用再進下一步。</p>${promptHtml}</section><section class="lesson-card source-note"><b>來源與提醒</b><p>${d.source}</p><p>AI 產出一定要人工檢查；語言、教材、學生資料與公開發布內容，請由教師確認。</p></section>`;
document.querySelectorAll('[data-code-source]').forEach(async block=>{
  const source=document.getElementById(block.querySelector('[data-copy]').dataset.copy);
  const button=block.querySelector('[data-copy]');
  const status=block.querySelector('.code-load-status');
  try{
    const response=await fetch(block.dataset.codeSource);
    if(!response.ok) throw new Error(`HTTP ${response.status}`);
    source.textContent=await response.text();
    button.disabled=false;
    button.textContent=button.dataset.readyLabel;
    status.textContent='程式碼已載入，可以一鍵複製。';
  }catch(error){
    source.textContent='程式碼載入失敗，請使用「下載原始檔」。';
    button.textContent='載入失敗';
    status.textContent='程式碼載入失敗，請下載原始檔後手動複製。';
  }finally{
    block.setAttribute('aria-busy','false');
  }
});
document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{
  const source=document.getElementById(button.dataset.copy);
  const text='value' in source?source.value:source.textContent;
  const originalLabel=button.textContent;
  let copied=false;
  try{
    if(navigator.clipboard&&window.isSecureContext){
      await navigator.clipboard.writeText(text);
      copied=true;
    }else{
      const fallback=document.createElement('textarea');
      fallback.value=text;
      fallback.setAttribute('readonly','');
      fallback.style.position='fixed';
      fallback.style.opacity='0';
      document.body.appendChild(fallback);
      fallback.select();
      copied=document.execCommand('copy');
      fallback.remove();
    }
  }catch(error){
    copied=false;
  }
  button.textContent=copied?'已複製':'請手動複製';
  button.classList.toggle('copied',copied);
  setTimeout(()=>{
    button.textContent=originalLabel;
    button.classList.remove('copied');
  },1600);
}));
