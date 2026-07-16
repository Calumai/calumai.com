# Architecture

這是零建置的 GitHub Pages 靜態網站。

- `index.html` 負責品牌首頁與公開導覽。
- `assets/site.css` 與 `assets/site.js` 供首頁、部落格與 404 共用。
- `blog/` 使用資料夾路由，每篇文章各自有 `index.html`。
- `lab/index.html` 保留原本的 localStorage 作業、工具清單與 Google Sheets JSONP 回饋功能。
- `tools/` 各工具獨立運作，首頁只提供入口，不改變工具內部資料格式。

所有路徑都使用相對連結，只有 404 頁使用網域根路徑。
