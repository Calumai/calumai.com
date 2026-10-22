# 太魯閣語遊戲教室（公開教師審閱版）

網址：`https://calumai.com/class/nlm/`

20 個 NotebookLM 產生的課堂活動，以靜態網頁播放投影片圖片。首頁有提示詞工作坊，提供 20 則原始提示詞，以及更改遊戲形式的指令產生器。沒有帳號、後端、外部 AI API 或使用者資料蒐集。

首頁另有兩份延伸講義：`materials/notebooklm-beginner-guide.pptx`（NotebookLM 入門教學，27 張）及 `materials/google-drive-large-print-guide.pdf`（Google 雲端硬碟基礎教學大字版，25 頁）。第二份提供的是 PDF，不是 PPTX。

`amis/` 是南勢阿美語 NotebookLM 資訊圖表專區，與太魯閣語 20 個活動分開。兩份《112 年情境族語》PDF 的可擷取文字按頁貼進 NotebookLM，分別生成「教室闖關地圖」與「人物線索偵探」兩張 2752 × 1536 PNG；圖片頁提供下載與原始提示詞。原 PDF 未上傳網站，先前程式製作的搶答、PPTX 及資訊圖已從公開目錄撤下。可修改源稿在本機專案 `outputs/notebooklm-amis-infographics/` 與 `outputs/notebooklm-truku-game-slides/web/amis/`。

## 內容狀態

- 這是教師審閱草稿，族語、答案、頁碼、圖像及教材公開使用範圍尚未完成逐頁核對。
- 已確認有問題的 09 第 2 張、16 封面、19 封面及第 9 張，在公開版改顯示「待修正」，相關原圖未納入此網站；原始 PPTX 也未公開下載。
- 其他頁面仍需對照來源《太魯閣語單詞句型本》PDF，並請太魯閣語教師確認後才能當作正式教材。
- 網頁的倒數與 A／B／C 記票由教師操作，不會自動判分。修改 NotebookLM 提示詞不會自動修改網頁互動功能。

## 修改源稿

- `index.html`：頁面結構與文字。
- `style.css`：桌機與手機版面。
- `app.js`：搜尋、播放、教師工具、提示詞介面及公開版待修正頁設定。
- `lessons.js`：20 個活動的名稱與已知問題。
- `20個遊戲化簡報提示詞.md`：提示詞源稿。修改後執行 `python build_prompts.py` 更新 `prompts.js`。
- `assets/`：可公開預覽的投影片圖片與縮圖。這些圖來自原始 NotebookLM 輸出，文字不能在 HTML 內直接修改。
- `materials/`：兩份延伸講義的原檔，與首頁下載／閱讀連結相對應。

若修正了原始簡報，須重新擷取對應圖片、再次核對，再移除 `app.js` 中該頁的 `reviewHolds` 設定。不能只取消遮蔽。
