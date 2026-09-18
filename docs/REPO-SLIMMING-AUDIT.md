# CALUMAI Repo 瘦身盤點

日期：2026-09-18  
範圍：`Calumai/calumai.com` 的 `master` 工作樹  
原則：本階段只盤點與建立工具，不直接刪除正式素材或改既有網址。

## 目前基準

- 檔案數：約 800
- 工作樹內容：約 **322.5 MiB**
- 完全相同檔案造成的理論重複：約 **92.6 MiB**
- 重複來源中約 **91.9 MiB** 來自 `admin/previews` 與 `ai-helper` 的預覽／正式素材雙份保存

### 主要目錄

| 目錄 | 約略大小 | 檔案數 | 判讀 |
| --- | ---: | ---: | --- |
| `class/` | 125.6 MiB | 389 | 課程、下載檔與大型教材為主 |
| `ai-helper/` | 100.5 MiB | 191 | AI-100 正式講義與圖片 |
| `admin/` | 90.7 MiB | 163 | CMS、AI-100 預覽及預覽素材 |
| `assets/` | 4.6 MiB | 11 | 全站共用素材 |

## 第一個真正的大問題：AI-100 預覽素材重複

目前很多 AI-100 圖片在正式講義與管理後台預覽各存一份，而且內容完全相同。

例如：

```text
admin/previews/ai100/EP021/covers/EP021.png
ai-helper/covers/EP021.png
```

SP001 更明顯，同一張約 2.31 MiB 的圖存在四份：

```text
admin/previews/ai100/SP001/assets/SP001/1.png
admin/previews/ai100/SP001/covers/SP001.png
ai-helper/covers/SP001.png
ai-helper/handouts/assets/SP001/1.png
```

### 現在不能直接刪的原因

`admin/previews/ai100/.../index.html` 目前使用相對路徑：

```html
<img src="covers/EP021.png">
<img src="assets/EP021/handout-screenshot.jpg">
```

因此如果直接刪除 `admin/previews` 裡的圖片，CMS 預覽會破圖。

### 正確的瘦身方式

不是直接刪，而是先改「預覽生成流程」。

建議順序：

1. 先定義一個 canonical asset source。
2. 正式講義與預覽共用同一份來源素材，或在部署時才產生 preview copy。
3. `admin/previews` 不再長期把完全相同的圖片 commit 進 Git。
4. 確認 CMS draft preview 仍能顯示尚未發布的新素材。
5. 再移除歷史上不需要的 preview duplicate。

預估可回收：約 **90 MiB 級**。

> 注意：draft 預覽可能需要尚未發布的素材，所以不能單純把所有 preview 圖改指向正式 `/ai-helper/` URL；生成流程必須同時處理草稿素材。

## 大型檔案

### A. `class/examples/lesson-01-rpg-examples.zip` — 約 24.52 MiB

頁面 `class/examples/lesson-01-examples.html` 將它標示為「下載兩份 PDF ZIP」，同一頁也已直接提供：

- `Taroko_RPG_Adventure.pdf` — 約 12.25 MiB
- `Truku_Classroom_RPG_Adventure.pdf` — 約 12.29 MiB

因此這個 ZIP 是很有價值的瘦身候選。

**目前處置：先不刪。**

下一步可選：

- 保留兩份 PDF，移除 ZIP，改成兩個下載按鈕。
- 或把 ZIP 移到 GitHub Release / 下載儲存空間，網站只留連結。

刪除前仍應實際確認 ZIP 內容確實只是這兩份教材。

### B. `class/taipei-ai/downloads/vibe-coding-essentials.pdf` — 約 14.42 MiB

`class/taipei-ai/2026-0911-gamified-learning/index.html` 有正式連結。

**判定：目前保留。**

若之後要再瘦身，可以把大型 PDF 搬到 Release / 物件儲存，但不能直接刪。

### C. `class/taipei-ai/2026-0904-picture-book/downloads/taipei-0904-picture-book-course-pack.zip` — 約 13.46 MiB

目前已檢查的 9/4 主課程頁沒有找到它的直接引用，但 GitHub code search 對此 repo 的索引目前不完整。

**判定：待確認，不可直接刪。**

要先用完整本機掃描確認全 repo 沒有引用，再決定移除或外移。

### D. 兩份 RPG PDF — 合計約 24.5 MiB

兩份都直接嵌入 `class/examples/lesson-01-examples.html` 供課堂預覽。

**判定：目前保留。**

### E. `taipei-0904-class-slides.pptx` — 約 3.66 MiB

9/4 課程頁有「下載課堂簡報」入口。

**判定：保留。**

## 圖片壓縮候選

9/4 繪本課程有多張 2 MiB 以上 PNG，例如：

- `page-discovery.png` 約 2.66 MiB
- `page-cover.png` 約 2.56 MiB
- `page-return.png` 約 2.43 MiB
- 多張角色 turnaround 約 2 MiB 以上

這些並非完全重複，但非常適合做第二階段圖片最佳化。

建議：

1. 先確認是否需要透明背景。
2. 不需要透明的截圖優先轉 WebP。
3. 需要透明的 PNG 先做 lossless/lossy PNG 壓縮。
4. 保留原 URL 或同步更新所有引用。
5. 每批改完都跑 `node scripts/check.js`。

## 分級處理清單

### Tier A — 低風險、可優先做

- 保留目前自動 site check。
- 使用 `node scripts/audit-repo-size.js` 定期量測 repo。
- 確認 `lesson-01-rpg-examples.zip` 是否只是兩份既有 PDF 的便利包。
- 完整掃描 `taipei-0904-picture-book-course-pack.zip` 是否仍有引用。

### Tier B — 高回收、需先改生成流程

- `admin/previews/ai100` 與 `ai-helper` 的重複 cover/assets。
- 預估回收空間：約 **91.9 MiB**。
- 必須先確保 draft preview 可以讀到未發布素材。

### Tier C — 外移大型下載

可評估移到 GitHub Releases 或專用下載儲存：

- ZIP
- PDF
- PPTX

網站保留穩定下載入口，但不把每個大型二進位檔長期塞在網站 source repo。

### Tier D — 圖片最佳化

- 大型 PNG → WebP / 壓縮 PNG。
- 建議一次只處理一個課程資料夾，避免大範圍破圖。

## 使用盤點工具

```bash
node scripts/audit-repo-size.js
```

只看前 10 個最大檔與重複群：

```bash
node scripts/audit-repo-size.js --limit=10
```

輸出 JSON：

```bash
node scripts/audit-repo-size.js --json
```

## 瘦身原則

1. 不因為檔案重複就直接刪，先看網址與 preview 是否依賴該 path。
2. 不改現有公開網址，除非已提供替代或轉址。
3. 大型教材優先「外移」，不要用刪除解決。
4. AI-100 優先解決生成流程，而不是人工逐張刪圖。
5. 每次瘦身都走 branch → PR → Site checks → merge。
6. 歷史 Git 物件不在本階段重寫；先降低未來新增與目前 checkout 大小，再評估是否需要歷史清理。

## 建議的下一個實作

優先處理 **AI-100 preview asset pipeline**。

目標不是馬上刪 90 MiB，而是先讓新的 preview 不再繼續複製同一份素材。當新流程穩定後，再一次性清理既有 duplicate。
