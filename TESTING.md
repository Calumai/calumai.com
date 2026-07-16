# Testing

## 靜態檢查

1. HTML 中不存在錯誤的本機絕對路徑。
2. JavaScript 通過 `node --check assets/site.js`。
3. 首頁、部落格、文章、練習基地與工具連結皆回傳 200。
4. `CNAME` 內容維持 `calumai.com`。

## 瀏覽器驗證

- 桌面：1440 x 900
- 手機：390 x 844
- 導覽選單可開啟、關閉，按 Esc 可關閉。
- 首頁可看到下一區段提示，文字與按鈕不重疊。
- 部落格按鈕可到文章列表，文章列表可進入文章頁。
- 練習基地的工具連結仍指向 `/tools/`。
- 主控台沒有 JavaScript error。
- `prefers-reduced-motion` 時內容不會維持隱藏。
