# 北市府 9/4 AI 繪本線上課程

正式路由：`/class/taipei-ai/2026-0904-picture-book/`

本課程使用日期式路由，相關課程內容、練習素材與下載檔案都集中在這個資料夾中。

## 頁面結構

- `index.html`：課程首頁，以「看懂、做出、轉教材」三站帶領上課；提示詞、簡報／海報換風格、完整範例與 YAML 都收進選用工具箱。
- `styles.css`：本路由專用響應式樣式；色票對齊「115年度 AI × 族語教學」封面的冷白、亮藍、深海軍藍、紅與橘。
- `app.js`：40 組提示詞解析／複製、教師備課快速選擇、2 組 NotebookLM 換風格提示、8 種海報 YAML、工具箱深連結與 YAML 載入／複製。
- `warmup/`：課程第一站的 8 關點選式提示詞暖身，不呼叫 API；完成後銜接既有課堂碼練習室。
- `workbench/index.html`：可編輯三頁繪本，能下載自帶圖片的 HTML 或列印成 PDF。
- `practice/`：課堂限定 AI 圖片工作室；學員依序選擇圖片用途、輸入簡短描述、查看真正的 AI 回饋、調整 AI 修正版，再用修正版生成並下載一張圖片。主流程不要求參考圖、角色設定或多頁分鏡；傳統文化內容仍提醒先確認來源並交由合適的人審訂。前端只呼叫同網域課堂 API，不包含永久金鑰、模型或上游位址。
- `materials/`：Markdown、NotebookLM 教師範例包、7 份 YAML 模板與 9 份範例。
- `assets/images/`：5 張課堂備援圖及排版預覽。
- `assets/fonts/`：固定標題使用的 22 KB 芫荽字型子集及 SIL OFL 1.1 授權；學生可編輯內容仍使用繁中系統字型，避免子集缺字。
- `downloads/`：保留在專案中的完整本機教材壓縮包；公開課程頁不提供下載入口。

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

〈紅雨傘回家了〉是低文化風險虛構課堂範例，不包含族群、族語、服飾、祭儀、歷史或文化象徵主張。頁面仍保留 `pending_human_review` 與課堂草稿提示，正式公開前仍須由具權責的人員完成審訂。
