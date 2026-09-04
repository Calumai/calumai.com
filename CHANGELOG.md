# Changelog

## Unreleased

- Replaced the Taipei 9/4 oversized campaign hero with a compact course title and slide-deck action, aligned the lesson and interactive introduction to the existing `/class` ink, paper, teal and gold design tokens, and added a direct interactive-introduction button to the four-course hub.
- Added a native interactive prompt introduction before the Taipei 9/4 image workflow, with before-and-after comparisons, click-to-build prompts, classroom examples, misconception feedback, a three-question quiz and a clear handoff to the existing warmup. It replaces the supplied CDN-dependent design runtime with same-site HTML, CSS and JavaScript for classroom reliability and responsive use.
- Added the official 21-slide Taipei 9/4 classroom PPTX as a compact hero download without changing the source deck or expanding the opening layout.
- Reduced the Taipei 9/4 opening hero from a near full-screen 1180px layout to a compact 960px course header, with a smaller title, illustration and mobile footprint so the three-stage lesson route appears sooner.
- Restored the direct `AI 圖片工作室` link on the Taipei 9/4 course route and updated the four-course hub description to match the live five-gate image workflow before publication.
- Rewrote the learner-facing copy across the Taipei 9/4 lesson, prompt warmup, prompt library and five-gate image studio after an approved `speak-human-tw` review. Replaced stale multi-page instructions and internal terms, clarified friendly errors and classroom quotas, and added a collapsed slide/poster style lab with two NotebookLM methods plus eight original, copyable YAML presets. The new lesson content contains no attribution or copied branding from the internal reference articles.
- Replaced the multi-page picture-book builder with one exact five-gate path: choose an image purpose, write a 3-4000 character description, receive genuine AI feedback, edit the AI revision, then generate only from that revision. Removed reference uploads, character/style/storyboard requirements from the main flow, restored the CALUMAI `/class` palette, and added fixed-view desktop plus 390px regression coverage. Local preview results are explicitly labeled as interface samples rather than AI output.
- Removed the direct AI picture-book studio button from the 9/4 course homepage. Learners now enter the studio only through the handoff at the end of the eight-step warmup, while the second-stage card remains as the stated course outcome.
- Replanned the public 9/4 lesson page around three teacher-led stages: understand through the eight-choice warmup, make a 4-6 page draft in the AI picture-book studio, then turn the work into a NotebookLM slide deck or infographic. The prompt library, complete example and YAML viewer now sit in collapsed optional drawers; the studio CTA is no longer buried under reference tools, and the self-study reading progress was removed.
- Removed the public 9/4 lesson page's HUMAN GATES and TAKE IT WITH YOU sections, including the header download controls and obsolete checklist JavaScript/styles. Source material files remain in the project but are no longer presented on the course page.
- Added a no-API `warmup/` route as the first activity in the Taipei 9/4 course. The eight-step, fixed-view exercise teaches ambiguity, details, scenes, shots, styles, exclusions and prompt assembly through click choices, with only an optional two-character topic field before handing learners to the existing classroom-gated picture-book studio.
- Reduced the Taipei 9/4 public download area from eight specialist files to two learner-facing choices: one classroom material pack and one link back to the interactive prompt library. Teacher guides, planning notes and backup files remain available in source materials without being spread across the student page.
- Simplified the Taipei picture-book studio so learners can begin with only a product choice and a two-character topic. Title, learning goal, fixed facts, palette, character notes and reference images are now optional, with safe AI-ready fallbacks; image source and rights checks appear only after an upload, while verified traditional cultural imagery keeps its stricter human-review gate.
- Lowered the picture-book story seed requirement from 20 characters to 2 trimmed characters, replaced the intimidating long-prompt wording with short-topic guidance, and instructed the storyboard AI to expand short fictional seeds without inventing cultural, language, historical or real-person details.
- Removed the public lesson page's teacher pacing section, six-workspace overview and three-hour timeline, together with its obsolete navigation anchor and unused styles; the page now moves directly from the opening example to the prompt library.
- Added a dedicated `/class/taipei-ai/` hub for the four Taipei City teacher-training sessions. The 9/4 picture-book course links to the live lesson, while the 9/11, 9/18 and 10/2 course cards clearly remain in a non-clickable building state.
- Reworked the Taipei four-course hub to use the same ink, teal, gold and paper palette as `/class/`; removed the full-viewport campaign hero and its large preview image so the four-course list begins in the opening screen.
- Reframed the Taipei 9/4 lesson as a teacher-led immersive studio, removed the self-study-style hero controls and metrics, and made the classroom practice open on a 4-6 page picture-book, comic or poster workflow.
- Stabilized the Taipei 9/4 practice room as a single-view workbench with a five-step rail, one active task panel, one fixed preview and one storyboard page at a time; removed forced document scrolling and added responsive navigation checks.
- Aligned the Taipei 9/4 practice room with the lesson page's cool white, bright blue, navy, red and orange campaign system, including the Iansui display face, atmospheric background, controls, workbench rails and preview surfaces.
- Connected `/class/patrol/` to the live three-student classroom service with secure teacher/student tokens, six-digit room codes, ten-second low-resolution snapshots, help status, and cross-device teacher monitoring.
- Clarified that the ten-page studio supports picture-book, 2-4-panel comic and mixed formats; comic selection now constrains storyboard layouts to panel-based pages and adds explicit panel-order guidance to every generated page prompt.
- Replaced the Taipei 9/4 single-image exercise with a course-centered ten-page picture-book studio: learners upload rights-cleared reference images, lock story/character/style decisions, generate an editable ten-page storyboard, then create and download one reviewed page at a time. Added a mandatory source-and-human-review gate for traditional clothing, patterns, objects and cultural scenes, server-side RelayRouter `/images/edits` forwarding, per-page retry limits, printable book output and responsive mobile layouts.
- Fixed the AI revised-prompt textarea so it fills the available responsive column instead of rendering at the browser's narrow default width; mobile actions remain stacked and full width.
- Added a post-share reminder in `/class/patrol/` telling students they may minimize the patrol page and return to their learning materials, while keeping the page and shared window or tab open.
- Added the CALUMAI-styled remote classroom patrol prototype at `/class/patrol/`, including teacher and student entry points, 100-person/25-per-page patrol layout, student search and help filtering, announcements, and browser screen-sharing preview. Added its entry to the `/class/` course overview. The first version is an interaction prototype; cross-device teacher delivery is not yet implemented.
- Rebuilt the Taipei 9/4 image exercise as one clear path: choose a purpose, write one canonical prompt, optionally receive real AI feedback, explicitly keep the original or select the suggested revision, then generate. Removed the duplicated helper/form controls, added a 3-4000 character counter, optional style insertion and a 2:3 preview matching the API output.
- Fixed `INVALID_PROMPT` requests caused by newline-delimited prompts and a `safe_area`/`safeArea` mismatch; the browser now submits only `{ prompt }` to the image proxy and the server safely normalizes ordinary textarea whitespace.
- Made the Taipei 9/4 practice room resilient to mixed HTML/JavaScript cache versions: optional prompt-library and prompt-review controls no longer stop session login when an older cached page is briefly served.
- Added the classroom-gated AI practice room at `/class/taipei-ai/2026-0904-picture-book/practice/` with text and image exercises, same-origin session handling, personal and class quotas, bounded timeouts, idempotent retry, complete loading and error states, accessible downloads, strict browser safeguards, and a course-page entry after the YAML lab. Added contract, safety and 390px layout regression tests.
- Recolored the Taipei 9/4 course and layout workbench to match the supplied campaign artwork with cool white, bright blue, accessible navy, red and orange; regenerated the workbench preview and added palette, contrast, legacy-color and mobile-overflow regression checks.
- Removed internal source/schema provenance notes from the Taipei 9/4 student page, prompt library, source handouts, and downloadable course archive while preserving the teaching YAML fields and workflow.
- Replaced the Taipei 9/4 course's oversized Windows Kai headline with a self-hosted 22 KB Iansui subset, relaxed Chinese tracking, balanced section headings, and added typography regression checks plus the OFL license.
- Added the independent Taipei City 9/4 AI picture-book course at `/class/taipei-ai/2026-0904-picture-book/`, including 20 copyable prompts, 16 browsable YAML files, a self-contained layout workbench, human review gates, classroom examples and downloadable source materials.
- Rebuilt `/class/index.html` as one valid semantic HTML document, preserved the existing 12-course, Vibe Flow, AI Handout and NTNU entries, and added a clearly separated Taipei City course section.
- Added `scripts/test-taipei-picture-book.js` to verify the course route, prompt inventory, YAML viewer files, images, downloadable archive, workbench behavior and `/class/` entry.

- Fixed the Lesson 04 eight-step workflow so steps 05–08 share the intended second desktop row, while preserving the single-column mobile layout.

- Added a Lesson 04 Google Sheet example, copy link, and eight-step visual workflow from preparing audio files through Apps Script deployment.

- Replaced the hard-coded Lesson 04 Drive folder ID with a browser-only Code.gs generator that validates a student's folder ID, then enables complete-code preview, copy, download, and reset actions.

- Updated the Lesson 04 quiz.html sample to load Drive audio through the server-side Base64 helper, with loading, failure, stale-request, and playback error states.

- Updated the Lesson 04 Code.gs sample with the new Drive folder ID and a server-side Base64 audio helper.

- Added Lesson 04 Code.gs and quiz.html samples with expandable source views and one-click copy actions.

- Added direct Lesson 04 links for the deployed tribal-language listening quiz and the shared classroom materials folder.

- 將 `/class/lesson-04.html` 的 44 張靜態長列表改為可直接操作的頁內投影片播放器，加入翻頁、自動播放、進度列、縮圖總覽、鍵盤、全螢幕、手機滑動與載入失敗重試。
- 以使用者提供的 44 張 Google Apps Script 工作坊簡報與 3 頁 AI 指令 PDF，重做 `/class/lesson-04.html`：新增完整講義、五段可複製提示詞、安全／權限提醒、44 張線上預覽、全螢幕播放與原始教材下載。
- 將 `/class/vibe-flow/` 的預設六節點範例改為「用 Vibe Coding 做一個族語單詞測驗網站」，涵蓋題庫、答案、AI 製作、計分驗證、修正與發布。
- 在 `/class/vibe-flow/` 加入完全公開的作品分享流程，並新增 `/class/vibe-flow/gallery/` 作品牆；公開 API 僅使用獨立的 `/api/vibe-flow/*` 路由。
- 在 `/class/` 新增 Vibe Coding 流程白板入口，白板使用獨立 `/class/vibe-flow/` 路由，不取代原有 12 堂課程內容。
- 依使用者回饋將首頁新工具公告縮成精簡通知列，並將首頁工具數量修正為 5。
- 首頁新增「族語教學提示詞工具」上線公告，提供工具畫面、用途提醒、開始使用與情境示範入口。
- 更新 `/tools/prompt-builder/` 族語教學提示詞工具，加入教材貼上、精簡預設設定、複製備援與三種教師使用情境，並新增至小工具列表。
- 在 `/ai-helper/` 新增「玩題」與「貼貼板」老師互動工具入口，支援免帳號開啟、跨工具分享與手機版單欄操作。
- 補回 `/blog/` 入口頁的 HTTPS redirect 與 `upgrade-insecure-requests` 安全標記。
- 調整 `/blog/` 列表字級與文章卡片尺寸，讓文章封面和標題不要過大；並在正式文章頁新增清楚的公開留言入口。
- 調淡部落格文章卡片與工具卡片 hover 效果，避免滑鼠移入時色塊過重。
- 將 `/games/` 更新為「原地重生・返璞歸真」正式入口，加入玩法摘要、基本資訊與外部遊戲連結。
- 在部落格列表與測試文章新增留言互動區，提供回饋提問、留言格式複製與公開留言入口。
- 為所有 HTML 頁面新增 HTTP 轉 HTTPS 前端保險與 `upgrade-insecure-requests`，降低瀏覽器顯示不安全狀態的機率。
- 新增首頁使用者分類區塊，並調整四個入口卡片文案，讓族語老師、教學夥伴與喜歡原住民族文化的訪客更容易找到入口。
- 調淡首頁四個入口卡片 hover 顏色，避免白底版滑鼠移入時出現過深色塊。
- 移除首頁右側大型 logo 徽章區塊，改為最新文章列表，保留首頁右側資訊欄。
- 依使用者回饋將首頁 orbital command 視覺改為白底版本，保留細線艙格、狀態列與科技感，但降低暗色壓迫感。
- 依 `http://localhost:4317/` 參考頁，將 CALUMAI mission 視覺改為暗色 orbital command 風格。
- 首頁新增 MODULES、TOOLS、BLOG、STATUS 狀態列，呼應任務監控介面。
- 調整 Logo 呈現方式，導覽列使用徽章裁切版，首頁主視覺使用徽章加可讀字標。
- 將首頁視覺改為乾淨的太空任務控制科技風，減少重色塊與復古像素壓迫感。
- 新增任務徽章式 CALUMAI logo 標記。
- 將首頁文案改為使用者指定的版本 B 語氣。
- 將四個首頁入口調整為：遊戲介紹、遊戲製作心得、族語教學備課小幫手、各類小工具。
- 新增 `/games/` 遊戲入口與玩法說明預備頁。
- 將 `/blog/` 改為遊戲製作心得部落格列表，先放置一篇測試文章。
- 將 `/ai-helper/` 改為建置中頁，保留後續獨立處理空間。
- 新增 `/tools/` 已完成小工具列表與用途說明。
- 以原創 16-bit 像素視覺重做 CALUMAI 首頁與導覽。
- 將首頁重排為簡短介紹、使用對象推薦與 9 個已完成功能入口。
- 所有功能入口先連到新手流程，不再直接進入複雜工具介面。
- 將 `/lab/` 改為五份可操作的新手流程，涵蓋詞卡、字幕、例句、錄音與課務行政。
- 移除候選任務看板、公開開發清單與尚未完成的文章草稿。
- 為已完成工具製作對應功能的像素封面圖，並保留手機導覽與 reduced-motion 支援。
- 重做 404 為像素風格的地圖外關卡。
