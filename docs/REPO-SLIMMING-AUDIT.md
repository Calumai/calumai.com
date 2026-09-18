# CALUMAI Repo 瘦身紀錄

日期：2026-09-18  
範圍：`Calumai/calumai.com`

## 瘦身前基準

- 工作樹：約 **322.5 MiB**
- 檔案：約 **800**
- `admin/`：約 **90.7 MiB**
- 完全相同檔案造成的理論重複：約 **92.6 MiB**
- 主要重複來源：`admin/previews/ai100` ↔ `ai-helper`

## 2026-09-18 AI-100 preview 去重

已完成第一批真正的空間回收。

### 做法

32 個已發布 AI-100 preview HTML 原本使用自己的相對素材：

```html
<img src="covers/EP021.png">
<img src="assets/EP021/handout-screenshot.jpg">
```

現在改為共用正式素材：

```html
<img src="/ai-helper/covers/EP021.png">
<img src="/ai-helper/handouts/assets/EP021/handout-screenshot.jpg">
```

刪除前，每一個 preview 素材都先驗證：

1. 正式 `ai-helper` 對應檔存在。
2. Git blob SHA 完全相同。
3. 只有驗證為完全相同的副本才刪除。

### 結果

- 更新 preview HTML：**32 個**
- 移除完全重複 preview 素材：**104 個**
- 回收工作樹：約 **89.6 MiB**
- 工作樹：約 **322.5 → 233.0 MiB**
- 檔案：約 **800 → 699**
- `admin/`：約 **90.7 → 1.1 MiB**
- `admin/previews/ai100/**/covers` / `assets`：目前 **0 個素材檔**

正式 `ai-helper` 講義、cover 與教學圖片沒有刪除。

## 為什麼這樣做

這些 preview 不是第二套內容，而是已發布內容的靜態預覽副本。既有 preview HTML 改成讀正式素材後，沒有必要把同一張圖片再 commit 一次。

這次沒有改：

- `/ai-helper/` 公開網址
- 正式講義 HTML
- 正式 cover / assets
- AI-100 內容文字
- 課程 PDF / ZIP / PPTX
- CMS 原始內容

## 上游發布器限制

AI-100 CMS 的原始內容由 `Calumai/blog-content` 發布到本 repo；目前 ChatGPT 的 GitHub 連線只授權 `calumai.com`，不能直接修改該上游 publisher。

因此上游 publisher 日後仍有可能再次把 preview asset copy 寫回本 repo。

為此新增：

```bash
node scripts/dedupe-ai100-previews.js
```

預設只做 dry run，不修改檔案。

實際套用：

```bash
node scripts/dedupe-ai100-previews.js --apply
```

CI / 檢查用途：

```bash
node scripts/dedupe-ai100-previews.js --check
```

`--check` 若發現可去重內容會回傳失敗狀態，可用來偵測 publisher 是否重新產生 duplicate。

> 目前不把 `--check` 強制掛到主站 deploy gate，避免在上游 publisher 尚未修改前影響正常發布。

## Repo 尺寸盤點

一般盤點：

```bash
node scripts/audit-repo-size.js
```

只看前 10 名：

```bash
node scripts/audit-repo-size.js --limit=10
```

JSON：

```bash
node scripts/audit-repo-size.js --json
```

## 下一批候選

### 1. Lesson 01 RPG ZIP（已完成）

`class/examples/lesson-01-rpg-examples.zip` 約 **24.52 MiB**，Git 歷史記錄為「Add lesson one RPG example PDF archive」，而同一堂課後續已將兩份 PDF 個別加入：

- `Taroko_RPG_Adventure.pdf` 約 12.25 MiB
- `Truku_Classroom_RPG_Adventure.pdf` 約 12.29 MiB

2026-09-18 已移除 ZIP 便利包，改為兩份 PDF 個別下載。預覽功能與兩份正式 PDF 均保留。

### 2. 9/4 課程包 ZIP

`class/taipei-ai/2026-0904-picture-book/downloads/taipei-0904-picture-book-course-pack.zip` 約 **13.46 MiB**。

目前已檢查的主課程頁沒有直接引用，但移除前仍需做完整引用掃描。

### 3. 大型圖片最佳化

9/4 繪本課程有多張 2 MiB 以上 PNG。下一階段可以按資料夾逐批：

1. 確認透明需求。
2. 不需要透明的截圖轉 WebP。
3. 需要透明的 PNG 做壓縮。
4. 保留 URL 或同步更新引用。
5. 每批都跑 Site checks。

## 仍保留的大型正式下載

下列目前有正式用途，不直接刪除：

- `class/taipei-ai/downloads/vibe-coding-essentials.pdf`
- `class/examples/Taroko_RPG_Adventure.pdf`
- `class/examples/Truku_Classroom_RPG_Adventure.pdf`
- `class/taipei-ai/2026-0904-picture-book/downloads/taipei-0904-class-slides.pptx`

## 原則

1. 不因為檔案大或重複就直接刪，先驗證公開網址與 preview 依賴。
2. 完全相同檔案才做自動去重。
3. 正式教材優先保留；大型下載若要瘦身，優先外移而非消失。
4. 每批都走 branch → PR → Site checks → merge。
5. 本輪只縮小目前工作樹；**沒有重寫 Git 歷史**，因此既有歷史物件仍存在於 repository history。
