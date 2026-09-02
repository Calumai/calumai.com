# 北市府 9/4 AI 繪本線上課程

正式路由：`/class/taipei-ai/2026-0904-picture-book/`

這是北市府四堂 AI 教學應用系列的獨立課程，不使用 CALUMAI 12 堂進階班的 `lesson-*` 編號、資料或控制腳本。

## 頁面結構

- `index.html`：課程流程、時間表、提示詞工作台、YAML 工作台、範例、人工關卡與下載區。
- `styles.css`：本路由專用響應式樣式。
- `app.js`：提示詞解析／複製、YAML 載入／複製、個人關卡進度與閱讀進度。
- `workbench/index.html`：可編輯三頁繪本，能下載自帶圖片的 HTML 或列印成 PDF。
- `materials/`：Markdown、7 份 YAML 模板與 9 份範例。
- `assets/images/`：5 張課堂備援圖及排版預覽。
- `assets/fonts/`：固定標題使用的 22 KB 芫荽字型子集及 SIL OFL 1.1 授權；學生可編輯內容仍使用繁中系統字型，避免子集缺字。
- `downloads/`：完整本機教材壓縮包。

## 維護與驗證

```powershell
node scripts/test-taipei-picture-book.js
node scripts/check.js
node scripts/test-lesson-04-code-generator.js
git diff --check
```

課程頁會以 HTTP `fetch()` 載入提示詞 Markdown 與 YAML，因此不能只用 `file://` 測試；請使用本機靜態伺服器或正式網址。

## 公開與審訂狀態

〈紅雨傘回家了〉是低文化風險虛構課堂範例，不包含族群、族語、服飾、祭儀、歷史或文化象徵主張。頁面仍保留 `pending_human_review` 與課堂草稿提示；個人勾選的 Gate 進度只存在瀏覽器本機，不等同具名授權或正式公開放行。
