# 北市府 9/4 AI 繪本線上課程

正式路由：`/class/taipei-ai/2026-0904-picture-book/`

本課程使用日期式路由，相關課程內容、練習素材與下載檔案都集中在這個資料夾中。

## 頁面結構

- `index.html`：課程流程、時間表、提示詞工作台、YAML 工作台、範例、人工關卡與下載區。
- `styles.css`：本路由專用響應式樣式；色票對齊「115年度 AI × 族語教學」封面的冷白、亮藍、深海軍藍、紅與橘。
- `app.js`：30 組提示詞解析／複製、教師備課快速選擇、YAML 載入／複製、個人關卡進度與閱讀進度。
- `workbench/index.html`：可編輯三頁繪本，能下載自帶圖片的 HTML 或列印成 PDF。
- `practice/`：課堂限定 AI 繪本工作室；可上傳參考圖、建立 4-6 頁分鏡、逐頁生成繪本／漫畫、下載單頁與整本列印稿。傳統文化內容須先完成來源範圍與真人審訂。前端只呼叫同網域 `/api/classroom-ai`，不包含永久金鑰、模型或上游位址。
- `materials/`：Markdown、NotebookLM 教師範例包、7 份 YAML 模板與 9 份範例。
- `assets/images/`：5 張課堂備援圖及排版預覽。
- `assets/fonts/`：固定標題使用的 22 KB 芫荽字型子集及 SIL OFL 1.1 授權；學生可編輯內容仍使用繁中系統字型，避免子集缺字。
- `downloads/`：完整本機教材壓縮包。

## 維護與驗證

```powershell
node scripts/test-taipei-picture-book.js
node scripts/test-taipei-practice.js
node scripts/check.js
node scripts/test-lesson-04-code-generator.js
git diff --check
```

課程頁會以 HTTP `fetch()` 載入提示詞 Markdown 與 YAML，因此不能只用 `file://` 測試；請使用本機靜態伺服器或正式網址。

## 公開與審訂狀態

〈紅雨傘回家了〉是低文化風險虛構課堂範例，不包含族群、族語、服飾、祭儀、歷史或文化象徵主張。頁面仍保留 `pending_human_review` 與課堂草稿提示；個人勾選的 Gate 進度只存在瀏覽器本機，不等同具名授權或正式公開放行。
