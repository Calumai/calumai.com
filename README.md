# CALUMAI

CALUMAI 是一個以族語教學現場為起點的靜態網站，集中展示可直接使用的教材、錄音與課務工具，也保存開發紀錄與文章。

正式網站：<https://calumai.com/>

## 網站結構

- `/`：品牌首頁與工具入口
- `/blog/`：文章列表
- `/blog/word-card-classroom/`：文章頁範例
- `/lab/`：工具想法、每日作業、回饋與練習流程
- `/tools/`：既有教學工具
- `/assets/`：共用樣式、互動與實際工具截圖

## 本機預覽

不需要建置或安裝套件。在專案根目錄啟動靜態伺服器：

```powershell
python -m http.server 4173 --bind 127.0.0.1
```

開啟 <http://127.0.0.1:4173/>。

## 發布

網站由 GitHub Pages 從 `master` 分支發布，`CNAME` 保留自訂網域 `calumai.com`。
