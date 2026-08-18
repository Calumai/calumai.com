const DATA={
'01':{title:'Gemini Notebook 遊戲化 RPG 簡報',tag:'GEMINI NOTEBOOK / GAME DESIGN',accent:'#147d7e',lede:'把一份教材變成一場可以闖關、練習與展示的學習冒險。',goals:['理解遊戲化的目標、任務、挑戰、回饋與成長','用 Gemini Notebook 整理真實教材與來源','完成 8–12 張 RPG 簡報初版'],steps:['上傳「112年情境族語｜01上課用語｜太魯閣語」PDF','請 Gemini Notebook 先整理對話、單詞與互動測驗','設計玩家、世界觀、任務線與三個關卡','要求 Gemini Notebook 生成簡報大綱','人工核對太魯閣語與中文意思'],practice:'把 PDF 中的對話練習、單詞練習與互動測驗轉成三個 RPG 關卡。',output:'Gemini Notebook 遊戲化 RPG 簡報 v1',prompts:['請根據我上傳的教材，整理所有語言資料、中文意思、使用情境與頁碼。只能使用來源中確認的內容，不可以自行猜測或補寫。','請把這份教材設計成適合國中生的 RPG。請提供世界觀、角色、3 個任務、挑戰、回饋、獎勵與勝利條件，並區分教材資料與故事設定。','請檢查這份 RPG 簡報：哪些語言內容有來源？哪些可能是推測？請列出需要族語教師人工確認的地方。'],source:'使用者提供的 112 年情境族語 PDF'},
'02':{title:'活用 Gemini：製作自己的排課行事曆',tag:'GEMINI / CALENDAR / HTML',accent:'#e3a62f',lede:'先讓 Gemini 協助處理 Google Calendar，再讓它寫出可以自己使用的單檔 HTML 排課工具。',goals:['用 @Google Workspace 協助建立與檢查 Calendar 行程','把排課條件、衝堂規則與確認流程說清楚','用 Gemini 產出並測試本地端 HTML 排課工具'],steps:['確認 Gemini 的 Google Workspace 擴充功能與權限','用 Prompt 1 建立單一課程行程並核對 Calendar','用 Prompt 2 提供限制條件、避開既有行程並先預覽','用 Prompt 3 產生單檔 HTML 排課工具','用 Prompt 4 加入時間驗證、刪除、防呆與 localStorage','延伸加入 CSV 匯出並測試中文編碼'],practice:'完成一個 Calendar 排程案例與一個可在瀏覽器開啟的 HTML 排課工具，測試新增、刪除、錯誤時間、重新整理與 CSV 匯出。',output:'Google Calendar 排程紀錄、HTML 排課工具、測試清單與 CSV 匯出',prompts:['請幫我建立下週的課程行事曆：AI 基礎工具應用實務，下週一到週三，每天下午 2:00 到 4:00。請先列出三個事件供我確認日期、時間與時區，再協助加入 Google Calendar。','你現在是一位專業排課助理。請安排下個月 5 堂、每堂 2 小時的進階提示詞工程課程，只能在每週二或週四下午 1:00 到 5:00，兩堂不能同一天；先檢查既有 Calendar 行程並輸出候選時段，等我確認後再建立，備註加上「請記得帶筆電與充電線」。','我需要一個單頁式專屬排課工具，請產生同一個 HTML 檔案中的 CSS 與 JavaScript；介面包含課程名稱、講師、日期、開始與結束時間、新增按鈕及課程表格，風格現代簡約，資料使用 localStorage。','請在上一個 HTML 工具加入時間驗證、刪除、防呆、日期檢查與 CSV 匯出功能，並列出測試方式。'],source:'使用者提供的第二堂課程講義；Google Workspace 與 Gemini 功能依帳號權限與介面為準'},
'03':{title:'Vibe 你的題庫：題庫產品設計',tag:'VIBE CODING / PRODUCT',accent:'#3d8dff',lede:'用自然語言把一個題庫想法變成可開發、可驗收的產品規格。',goals:['拆解使用者與真正問題','規劃題型、欄位、畫面與操作流程','用 Gemini 產出第一版 MVP brief'],steps:['描述誰會使用題庫','定義題型、難度、答案與解析','規劃新增、作答、檢查與成績流程','請 Gemini 產生需求 brief','刪掉第一版不必要功能'],practice:'設計一個自己的題庫，至少包含 2 種題型、3 種難度與成績紀錄。',output:'題庫需求 brief、欄位表與畫面草圖',prompts:['你是產品經理。請把我的題庫想法拆成使用者、問題、功能、資料欄位、畫面流程與 MVP。遇到未知資訊請列出問題。','請將這份題庫需求改成開發者可以執行的 user stories 與驗收標準。','請檢查這個題庫 MVP 是否過大，提出可以延後的功能。'],source:'課程自製方法與學員真實題目'},
'04':{title:'Gemini + GAS 自動化題庫',tag:'GEMINI + GAS / AUTOMATION',accent:'#3d8dff',lede:'讓題庫可以自動產生、整理、評分、批次處理並留下紀錄。',goals:['理解 Google Sheet、GAS 與 Gemini 的資料流','設計提示詞模板與結構化輸出','加入錯誤處理、測試與人工抽查'],steps:['建立題庫輸入、輸出與狀態欄位','設計固定格式的 Gemini 提示詞','用 GAS 讀取資料並呼叫模型','將結果寫回指定欄位','測試空白、錯誤與重複資料'],practice:'讓系統根據 3 個主題各產生 5 題，保留版本、來源與檢查狀態。',output:'可重複執行的題庫自動化工具與測試報告',prompts:['請協助我設計 Google Apps Script 題庫自動化流程，輸入為主題與難度，輸出為題目、選項、答案、解析與標籤。','請把這個 Gemini 題庫輸出限制成嚴格 JSON，並列出格式錯誤時的處理方式。','請幫我建立題庫自動化的測試案例，包含成功、空白、重複與模型輸出錯誤。'],source:'Google Apps Script 與 Gemini 實作課程；API 權限需依帳號設定'},
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
const id=(location.pathname.match(/lesson-(\d+)/)||[])[1]||'01';const d=DATA[id]||DATA['01'];const root=document.querySelector('#lesson');document.title=`第 ${id} 堂｜${d.title}｜CALUMAI`;const ppt=`/class/ppt/lesson-${id}.pptx`;let slideHtml='';for(let i=1;i<=8;i++){const n=String(i).padStart(2,'0');slideHtml+=`<figure class="slide-frame"><img loading="lazy" src="/class/ppt-preview/${id}/slide-${n}.png" alt="第 ${id} 堂 PPT 第 ${i} 張"><figcaption>第 ${i} 張</figcaption></figure>`}let promptHtml=(id==='01'?[...d.prompts,FULL_PROMPT,ESCAPE_PROMPT,ADVANCED_RPG_PROMPT]:d.prompts).map((p,i)=>`<div class="prompt-block"><div class="prompt-label">提示詞 ${i+1}</div><textarea readonly id="prompt-${i}">${p}</textarea><button class="copy-btn" data-copy="prompt-${i}">複製提示詞</button></div>`).join('');const opening=id==='01'?'<section class="teaching-intro lesson-card"><h2>為什麼先談遊戲教學？</h2><p>遊戲教學不是把課堂變成單純玩遊戲，而是把學習目標、練習、回饋與成長設計成學生願意參與的任務流程。</p><h3>遊戲教學的好處</h3><ul><li>提高參與動機與持續練習意願</li><li>把語言放進有意義的情境</li><li>提供立即回饋、重試與可見的成長</li><li>促進合作、表達與成果展示</li></ul><h3>為什麼選 RPG？</h3><p>RPG 能把角色、任務、關卡、能力值與回饋串成一條成長路線，適合將 PDF 中的上課用語放進連續情境。</p><h3>除了 RPG 還能做什麼？</h3><p>同一份教材也可以做成卡牌配對、密室逃脫、模擬經營、偵探解謎、闖關問答、合作任務或故事分支。選擇形式時，要看學習目標、課堂時間、學生人數與教師準備成本。</p><p><a class="download-secondary" href="/class/examples/lesson-01-rpg-examples.zip">下載第一堂課兩份 RPG PDF 範例（ZIP）</a></p></section>':'';root.innerHTML=`<section class="lesson-hero" style="border-left-color:${d.accent}"><p class="eyebrow" style="color:${d.accent}">第 ${id} 堂 / ${d.tag}</p><h1>${d.title}</h1><p class="lede">${d.lede}</p><div class="back-row"><a href="#slides">先看 PPT 預覽</a><a class="secondary" href="#prompts">複製提示詞</a></div></section>${opening}<section class="lesson-grid" id="handout"><article class="lesson-card"><h2>課堂目標</h2><ul>${d.goals.map(x=>`<li>${x}</li>`).join('')}</ul><h3>今天的作品</h3><p>${d.output}</p></article><article class="lesson-card"><h2>講義：操作流程</h2><ol>${d.steps.map(x=>`<li>${x}</li>`).join('')}</ol><h3>課堂實作</h3><p>${d.practice}</p></article></section><section class="slides-section" id="slides"><h2>PPT 線上預覽</h2><p class="lede">先逐張預覽投影片；如果要保留原始檔，再從下方開啟 PPT。</p><div class="slide-grid">${slideHtml}</div><p><a class="download-secondary" href="${ppt}">需要時下載原始 PPT</a></p></section><section class="prompts" id="prompts"><h2>可複製提示詞</h2><p class="lede">把需要的提示詞複製到 NotebookLM、Gemini 或 Google Vids，再替換【】中的內容。</p>${promptHtml}</section><section class="lesson-card supplement-note"><b>補充資源</b><p><a href="https://aihandout-lexjxdgq.manus.space/" target="_blank" rel="noopener">開啟 AI Handout 補充網站 ↗</a></p><p>可把本堂課產出的教材、提示詞與教學流程，延伸整理成可分享的教學手冊。</p></section><section class="lesson-card source-note"><b>來源與提醒</b><p>${d.source}</p><p>AI 產出一定要人工檢查；語言、教材、學生資料與公開發布內容，請由教師確認。</p></section>`;document.querySelectorAll('[data-copy]').forEach(btn=>btn.addEventListener('click',async()=>{const t=document.getElementById(btn.dataset.copy);await navigator.clipboard.writeText(t.value);btn.textContent='已複製';btn.classList.add('copied');setTimeout(()=>{btn.textContent='複製提示詞';btn.classList.remove('copied')},1600)}));
