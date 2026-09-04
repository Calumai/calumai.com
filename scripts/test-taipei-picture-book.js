const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const route = path.join(root, "class", "taipei-ai", "2026-0904-picture-book");

function read(relative) {
  return fs.readFileSync(path.join(route, relative), "utf8");
}

function relativeLuminance(hex) {
  const channels = hex.match(/[0-9a-f]{2}/gi).map((value) => Number.parseInt(value, 16) / 255);
  const [red, green, blue] = channels.map((value) => (
    value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  ));
  return (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
}

function contrastRatio(first, second) {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
}

function assertContrast(foreground, background, minimum, label) {
  assert(
    contrastRatio(foreground, background) >= minimum,
    `${label} contrast must be at least ${minimum}:1`
  );
}

const html = read("index.html");
const styles = read("styles.css");
const app = read("app.js");
const promptLibrary = read(path.join("materials", "docs", "prompt-library.md"));
const teacherExamples = read(path.join("materials", "docs", "notebooklm-teacher-examples.md"));
const teacherGuide = read(path.join("materials", "docs", "teacher-guide.md"));
const studentHandout = read(path.join("materials", "docs", "student-handout.md"));
const workbench = read(path.join("workbench", "index.html"));
const practiceHtml = read(path.join("practice", "index.html"));
const practiceStyles = read(path.join("practice", "styles.css"));
const practiceCore = read(path.join("practice", "core.js"));
const practiceApp = read(path.join("practice", "app.js"));
const warmupHtml = read(path.join("warmup", "index.html"));
const warmupStyles = read(path.join("warmup", "styles.css"));
const warmupApp = read(path.join("warmup", "app.js"));
const promptIntroHtml = read(path.join("prompt-intro", "index.html"));
const promptIntroStyles = read(path.join("prompt-intro", "styles.css"));
const promptIntroApp = read(path.join("prompt-intro", "app.js"));
const classIndex = fs.readFileSync(path.join(root, "class", "index.html"), "utf8");
const classStyles = fs.readFileSync(path.join(root, "class", "styles.css"), "utf8");
const seriesIndex = fs.readFileSync(path.join(root, "class", "taipei-ai", "index.html"), "utf8");
const seriesStyles = fs.readFileSync(path.join(root, "class", "taipei-ai", "styles.css"), "utf8");

const palette = {
  ink: "#111827",
  inkSoft: "#536273",
  paper: "#f8fafb",
  white: "#ffffff",
  teal: "#147d7e",
  gold: "#e3a62f",
  red: "#d45a4a",
  redDark: "#a33d31",
  controlBorder: "#7b8898"
};

for (const [token, value] of Object.entries({
  ink: palette.ink,
  "ink-soft": palette.inkSoft,
  paper: palette.paper,
  white: palette.white,
  teal: palette.teal,
  gold: palette.gold,
  red: palette.red,
  "control-border": palette.controlBorder,
  focus: palette.teal
})) {
  assert.match(styles, new RegExp(`--${token}:\\s*${value}`, "i"), `course must share /class token --${token}`);
}

assert.match(html, /<meta name="theme-color" content="#147d7e">/i, "theme color should match /class teal");
assert.match(html, /styles\.css\?v=20260904l/, "course stylesheet cache key is stale");
assert.match(html, /app\.js\?v=20260904h/, "course script cache key is stale");
assert.match(workbench, /--ink:\s*#0c2247/i, "workbench navy token is stale");
assert.match(workbench, /--accent:\s*#005fb8/i, "workbench action blue is stale");
assert.match(workbench, /--orange:\s*#fca116/i, "workbench orange token is stale");
assert.match(workbench, /@media \(max-width: 700px\)[\s\S]*?\.toolbar\s*{[^}]*flex-direction:\s*column/, "workbench mobile toolbar should stack");
assert.match(workbench, /@media \(max-width: 700px\)[\s\S]*?\.actions\s*{[^}]*grid-template-columns:\s*1fr 1fr/, "workbench mobile actions should stay inside the viewport");
assert.match(workbench, /@media \(max-width: 700px\)[\s\S]*?\.slide,[\s\S]*?\.status\s*{\s*width:\s*100%/, "workbench mobile canvas should not overflow");

for (const oldColor of [
  "#173c35", "#42625b", "#f6f1e7", "#ebe2d2", "#fffdf8", "#c94e3d", "#9d352b",
  "#e8ae43", "#b9d2c4", "#66829a", "#203028", "#f7f2e8", "#b84235", "#d9ded8",
  "#24372f", "#102b26", "#203f49", "#122b31", "#0d2227", "#294c55", "#efe4d5",
  "#ece7dc", "#f2eadd", "#f6e4df"
]) {
  assert(!`${styles}\n${workbench}`.toLowerCase().includes(oldColor), `legacy course color remains: ${oldColor}`);
}

for (const campaignColor of [
  "#0c2247", "#415673", "#f5faff", "#007eeb", "#005fb8", "#d91d26", "#fca116"
]) {
  assert(!(styles + "\n" + promptIntroStyles).toLowerCase().includes(campaignColor), "old campaign color remains: " + campaignColor);
}

assert.doesNotMatch(`${html}\n${workbench}`, /[—–]/, "student-facing HTML should use regular hyphens");
assert.doesNotMatch(`${practiceHtml}\n${practiceStyles}\n${practiceCore}\n${practiceApp}`, /[—–]/, "practice page should use regular hyphens");
assert.match(styles, /--blue-dark:\s*var\(--teal\)/, "legacy action alias must resolve to /class teal");
assert.match(styles, /--orange:\s*var\(--gold\)/, "legacy highlight alias must resolve to /class gold");
assert.match(styles, /\.button\.primary\s*{[\s\S]*?background:\s*var\(--blue-dark\)/, "primary CTA should resolve to teal");
assert.match(styles, /\.prompt-item\.is-active\s*{[\s\S]*?background:\s*var\(--blue-dark\)/, "active prompt should resolve to teal");
assert.match(styles, /\.route-card\.is-featured\s*{[\s\S]*?background:\s*var\(--blue-dark\)/, "featured course stage should resolve to teal");
assert.match(styles, /\.tool-drawer\s*{[\s\S]*?border:\s*1px solid var\(--line\)/, "optional tools should use a quiet disclosure pattern");
assert.match(styles, /\.prompt-viewer pre\s*{[\s\S]*?max-height:\s*50vh/, "prompt preview should not dominate the page height");
assert.match(styles, /footer\s*{[\s\S]*?background:\s*var\(--ink\)/, "footer should use brand navy");
assert.match(styles, /:focus-visible\s*{[\s\S]*?outline:\s*3px solid var\(--focus\)/, "focus ring should use the accessible focus token");

assert.match(html, /<section class="course-intro shell"[^>]+aria-labelledby="course-title"/, "course page needs a compact title section");
assert.match(html, /<h1 id="course-title">自己的繪本自己生！<\/h1>/, "course title should be one clear line without forced breaks");
assert.doesNotMatch(html + "\n" + styles, /class="hero|hero-art|hero-deck|\.hero\b/, "removed campaign hero must not return");
assert.match(html, /class="course-deck"[^>]+href="downloads\/taipei-0904-class-slides\.pptx"[^>]+download/, "course intro should offer the official classroom slide deck");
assert.match(html, /下載課堂簡報[\s\S]*?21 頁 PPTX/, "course deck label should explain the download clearly");
assert.match(styles, /\.course-intro\s*\{[\s\S]*?grid-template-columns:\s*minmax\(0, 1fr\) auto/, "course intro should stay compact on desktop");
assert.match(styles, /\.course-intro h1\s*\{[\s\S]*?font-size:\s*clamp\(2\.35rem, 5vw, 4rem\)/, "course title must not be oversized");

assertContrast(palette.white, palette.teal, 4.5, "white on action teal");
assertContrast(palette.redDark, palette.white, 4.5, "warning red on white");
assertContrast(palette.ink, palette.gold, 4.5, "ink on gold");
assertContrast(palette.ink, palette.paper, 7, "primary text on paper");
assertContrast(palette.inkSoft, palette.paper, 4.5, "secondary text on paper");
assertContrast(palette.controlBorder, palette.white, 3, "control border on white");

for (const id of ["prompts", "style-switcher", "yaml", "example"]) {
  assert.match(html, new RegExp(`<details[^>]+id=["']${id}["']`), `missing collapsed tool #${id}`);
}
assert.match(html, /<section class="route-section" id="route"/, "course needs one clear three-stage route");
assert.equal((html.match(/class="route-card(?:\s|")/g) || []).length, 3, "course route should contain exactly three stages");
for (const stage of ["先看懂", "再做出", "最後轉教材"]) {
  assert.match(html, new RegExp(stage), `course route is missing ${stage}`);
}
assert.match(html, /<h3>提示詞入門互動教學<\/h3>/, "first stage should introduce the interactive prompt lesson");
assert.match(html, /href="prompt-intro\/">開始互動教學<\/a>/, "first stage should link to the prompt introduction");
assert.match(html, /class="route-card is-featured"[\s\S]*?<h3>AI 圖片工作室<\/h3>/, "second stage should match the live five-gate image workflow");
assert.doesNotMatch(html, /class="route-card[^\"]*no-action/, "linked course stages must not keep the obsolete no-action layout");
assert.match(html, /看看 AI 的建議，再用修正版生成圖片/, "second stage should explain the current AI review flow");
assert.match(html, /帶走一張可預覽、可下載的圖片/, "second stage should promise the current single-image result");
assert.match(html, /href="practice\/">進入 AI 圖片工作室<\/a>/, "course homepage should expose the requested direct image-studio link");
assert.match(html, /href="#prompts"[^>]+data-open-tool="prompts"[^>]+data-prompt-code="T01"/, "third stage should open the teacher prompt drawer");
assert(html.indexOf('id="route"') < html.indexOf('id="teacher-tools"'), "three-stage route must appear before optional tools");
assert(html.indexOf('href="prompt-intro/">開始互動教學') < html.indexOf('id="prompts"'), "prompt introduction must precede the optional prompt library");
assert.doesNotMatch(html, /hero-lead|hero-actions|開始第一站/, "removed hero explanation and controls must not return");
assert.doesNotMatch(html, /<details[^>]+id="(?:prompts|style-switcher|yaml|example)"[^>]*\sopen(?:\s|>|=)/, "optional tools must be collapsed on first load");
assert.doesNotMatch(html, /id=["']workflow["']|href=["']#workflow["']|老師帶著學生，把作品一步一步做出來|老師現場帶做|作品會逐步累積|老師帶課節奏|00:00-00:10|02:20-03:00/, "removed teacher pacing section must not remain in the public lesson page");
assert.doesNotMatch(styles, /\.immersion-board|\.studio-steps|\.studio-task|\.studio-wall|\.outcome-strip|\.teaching-run/, "removed teacher pacing section must not leave unused styles");
assert.doesNotMatch(html, /3-HOUR ROUTE|三小時，先求走完整條線|查看完整 12 段時間表|本頁屬於北市府四堂/u, "internal schedule or boundary copy must not be public");
assert.doesNotMatch(html, /id=["'](?:gates|downloads)["']|HUMAN GATES|TAKE IT WITH YOU|AI 可以初審，不能替人簽名|需要時，再帶走這兩份|class=["']header-cta["']|href=["']#downloads["']/, "removed review and download sections must not remain in the public lesson page");
assert.doesNotMatch(styles, /\.gates-section|\.gate-grid|\.gate-status|\.download-grid|\.download-card|\.header-cta/, "removed review and download sections must not leave unused styles");
assert.doesNotMatch(app, /initGateChecklist|data-gate|gate-status|calumai-taipei-0904-gates/, "removed review checklist must not leave unused JavaScript");

assert.match(styles, /@media \(max-width: 940px\)[\s\S]*?\.route-grid\s*\{[^}]*grid-template-columns:\s*1fr/, "course route must collapse to one column before mobile widths");
assert.match(styles, /@media \(max-width: 700px\)[\s\S]*?\.route-card \.button\s*\{\s*width:\s*100%/, "course stage actions must fit mobile width");
assert.match(styles, /@media \(max-width: 940px\)[\s\S]*?\.style-method-grid\s*\{[^}]*grid-template-columns:\s*1fr/, "style methods must collapse to one column on narrow screens");
assert.match(styles, /@media \(max-width: 390px\)[\s\S]*?\.style-method-card \.copy-button\s*\{[^}]*width:\s*100%/, "style copy buttons must fit a 390px viewport");
for (const relative of ["index.html", "styles.css", "core.js", "app.js"]) {
  assert(fs.existsSync(path.join(route, "practice", relative)), `missing practice/${relative}`);
}

assert.equal((warmupHtml.match(/data-warmup-step="\d"/g) || []).length, 8, "warmup must show exactly eight steps");
for (const label of [
  "AI 會通靈嗎？",
  "多一個線索",
  "換個場景",
  "要看多近？",
  "故事換衣服",
  "AI 偷加什麼？",
  "救一句短句",
  "我的第一幕"
]) {
  assert.match(warmupHtml, new RegExp(label.replace(/[?？]/g, ".")), `warmup is missing ${label}`);
}
assert.match(warmupHtml, /aria-current="step"/, "warmup initial step needs an accessible current-state marker");
assert.match(warmupApp, /Array\.from\(value\)\.length < 2/, "warmup short topic should accept two characters");
assert.match(warmupApp, /window\.location\.href = "\.\.\/practice\/"/, "warmup should hand off to the existing practice room");
assert.doesNotMatch(warmupApp, /scrollIntoView|window\.scroll|fetch\s*\(/, "warmup must not jump the viewport or call an API");
assert.doesNotMatch(`${warmupHtml}\n${warmupStyles}\n${warmupApp}`, /Authorization|API[_ -]?Key|OPENAI|VECTORENGINE/i, "warmup must not expose or use API credentials");
assert.doesNotMatch(`${warmupHtml}\n${warmupApp}`, /[—–]/, "warmup learner copy should use regular hyphens");
assert.match(warmupStyles, /grid-template-columns:\s*220px minmax\(420px, 1fr\) minmax\(270px, 330px\)/, "warmup desktop should keep progress, task and preview in one view");
assert.match(warmupStyles, /@media \(max-width: 680px\)[\s\S]*?\.workspace\s*{\s*display:\s*flex;\s*flex-direction:\s*column/, "warmup mobile layout should collapse to one column");
assert.match(warmupStyles, /@media \(max-width: 390px\)/, "warmup needs a 390px layout check");

for (const relative of ["index.html", "styles.css", "app.js"]) {
  assert(fs.existsSync(path.join(route, "prompt-intro", relative)), `missing prompt-intro/${relative}`);
}
assert.match(promptIntroHtml, /<html lang="zh-Hant">/, "prompt introduction needs the correct page language");
assert.match(promptIntroHtml, /Content-Security-Policy[^>]+default-src 'self'/, "prompt introduction needs a same-origin CSP");
assert.match(promptIntroHtml, /<meta name="theme-color" content="#147d7e">/, "prompt introduction must use the /class theme color");
assert.match(promptIntroHtml, /styles\.css\?v=20260904b/, "prompt introduction stylesheet cache key is stale");
assert.match(promptIntroHtml, /app\.js\?v=20260904a/, "prompt introduction script cache key is stale");
assert.match(promptIntroApp, /window\.location\.href\s*=\s*"\.\.\/warmup\/"/, "prompt introduction should hand off to the image prompt warmup");
assert.match(promptIntroHtml, /aria-live="polite"/, "prompt introduction needs accessible live feedback");
assert.equal((promptIntroHtml.match(/data-panel=/g) || []).length, 6, "prompt introduction needs exactly six focused panels");
assert.equal((promptIntroHtml.match(/data-compare=/g) || []).length, 2, "prompt introduction needs a before-and-after comparison");
assert.equal((promptIntroHtml.match(/data-builder-group=/g) || []).length, 4, "prompt introduction needs four click-to-build prompt parts");
assert.equal((promptIntroHtml.match(/data-quiz=/g) || []).length, 3, "prompt introduction needs exactly three quiz questions");
assert.match(promptIntroHtml, /id="copy-template"/, "prompt introduction needs a copyable take-away template");
assert.match(promptIntroStyles, /@media \(max-width: 760px\)/, "prompt introduction needs a tablet/mobile collapse");
assert.match(promptIntroStyles, /@media \(max-width: 390px\)/, "prompt introduction needs a 390px layout check");
assert.match(promptIntroStyles, /prefers-reduced-motion:\s*reduce/, "prompt introduction must respect reduced motion");
for (const [token, value] of Object.entries({
  ink: "#111827",
  "ink-soft": "#536273",
  paper: "#f8fafb",
  teal: "#147d7e",
  gold: "#e3a62f",
  line: "#d7dee7"
})) {
  assert.match(promptIntroStyles, new RegExp("--" + token + ":\\s*" + value, "i"), "prompt introduction must share /class token --" + token);
}
assert.doesNotMatch(`${promptIntroHtml}\n${promptIntroStyles}\n${promptIntroApp}`, /unpkg|fonts\.googleapis|ReactDOM|Babel|new Function|support\.js/i, "prompt introduction must not depend on external runtimes");
assert.doesNotMatch(`${promptIntroHtml}\n${promptIntroApp}`, /fetch\s*\(|XMLHttpRequest|Authorization|API[_ -]?Key|localStorage/i, "prompt introduction must stay local and private");
assert.doesNotMatch(`${promptIntroHtml}\n${promptIntroStyles}\n${promptIntroApp}`, /[—–]/, "prompt introduction must not use long dash characters");
assert.match(warmupStyles, /@media \(prefers-reduced-motion: reduce\)/, "warmup must respect reduced motion");

assert.doesNotMatch(html, /Captain|來源透明|原資料庫|實體 schema/i, "student page must not expose internal source notes");
assert.doesNotMatch(promptLibrary, /Captain/i, "downloadable prompt library must not expose internal source notes");
assert.doesNotMatch(`${html}\n${app}\n${promptLibrary}`, /Captain|船長|部落格|原資料庫|實體 schema/i, "public lesson materials must not expose internal source labels");
assert.doesNotMatch(`${html}\n${app}\n${promptLibrary}`, /4-6|故事節拍|事實包|Gate 1|情緒重量|來源內|來源支持|可支持|去識別數據|工單/u, "approved plain-language replacements must remain in public materials");

const promptHeadings = Array.from(promptLibrary.matchAll(/^##\s+(N-CLASS|N\d{2}|T\d{2}|C\d{2})｜([^\r\n]+)$/gm));
const promptCodes = promptHeadings.map((match) => match[1]);
assert.equal(promptCodes.length, 40, "prompt library should expose 40 task prompts");
assert.equal(new Set(promptCodes).size, 40, "prompt codes must be unique");
for (const code of ["N-CLASS", "N00", "N08", "T01", "T10", "T11", "T20", "C00", "C09"]) {
  assert(promptCodes.includes(code), `missing prompt ${code}`);
}
assert.match(html, /data-prompt-group="teacher">簡報與圖表<\/button>/, "teacher prompt tab is missing");
assert.match(html, /id="teacher-example-select"/, "teacher quick picker is missing");
assert.match(html, /<option value="T01">/, "teacher quick picker is missing T01");
assert.match(html, /<option value="T10">/, "teacher quick picker is missing T10");
assert.match(html, /<option value="T20">/, "teacher quick picker is missing T20");
assert.match(html, /<optgroup label="教學簡報">/, "teacher picker should lead with slide decks");
assert.match(html, /<optgroup label="資訊圖表">/, "teacher picker should group infographics");
assert.match(styles, /\.prompt-tabs\s*{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/, "prompt tabs should fit three groups");
assert.match(app, /requiredCodes\s*=\s*\["N-CLASS", "N00", "N08", "T01", "T10", "T11", "T20", "C00", "C09"\]/, "prompt loader should validate teacher prompts");
assert.match(app, /promptGroup:\s*"teacher"/, "teacher materials should be the default optional prompt group");
assert.match(app, /setPromptGroup\("teacher", "T01"\)/, "teacher prompt drawer should open with one practical slide prompt");
assert.doesNotMatch(`${html}\n${styles}\n${app}`, /reading-progress|initReadingProgress|addEventListener\("scroll"/, "self-study reading progress must not return");

assert(html.indexOf('id="prompts"') < html.indexOf('id="style-switcher"'), "style switcher should follow the prompt helper");
assert(html.indexOf('id="style-switcher"') < html.indexOf('id="example"'), "style switcher should remain inside the optional toolbox flow");
for (const key of ["notebook-text", "notebook-reference"]) {
  assert.match(html, new RegExp(`data-copy-style-prompt=["']${key}["']`), `missing copy control for ${key}`);
  assert.match(html, new RegExp(`data-style-status=["']${key}["'][^>]+aria-live=["']polite["']`), `missing accessible status for ${key}`);
}
for (const label of [
  "柔霧低彩度",
  "等角立體",
  "霓虹科技",
  "蠟筆手繪",
  "紙張拼貼",
  "粉筆黑板",
  "裝飾幾何",
  "溫柔繪本"
]) {
  assert.match(app, new RegExp(`name:\\s*["']${label}["']`), `missing original poster style ${label}`);
}
assert.equal((app.match(/^\s{6}id:\s*"[^"]+",$/gm) || []).length, 8, "poster style selector should expose exactly eight styles");
assert.match(app, /keep_title_exact:\s*true/, "poster YAML must lock the original title");
assert.match(app, /keep_body_text_exact:\s*true/, "poster YAML must lock the original body copy");
assert.match(app, /copyText\(prompt\)/, "NotebookLM style prompts should use the shared copy helper");
assert.match(app, /copyText\(buildPosterStyleYaml\(style\)\)/, "poster YAML should use the shared copy helper");
assert.match(`${html}\n${app}`, /參考圖必須是你有權使用|只使用有權使用的參考圖/, "reference-image rights reminder is missing");
assert.match(`${html}\n${app}`, /族語.*逐字核對/, "indigenous-language review reminder is missing");
assert.match(`${html}\n${app}`, /傳統服飾、圖紋與器物.*熟悉該族文化者確認/, "cultural review reminder is missing");
assert.doesNotMatch(app, /\.innerHTML|localStorage|sessionStorage|scrollIntoView/, "toolbox interactions must not inject HTML, persist content or move the viewport");
assert.match(teacherExamples, /教學簡報｜六種直接套用情境/, "teacher slide-deck examples are incomplete");
assert.match(teacherExamples, /資訊圖表｜四種直接套用情境/, "teacher infographic examples are incomplete");
assert.match(teacherExamples, /工作室 → 簡報／資訊圖表 → 鉛筆 → 自訂提示詞/, "teacher guide should show where to paste visual prompts");
assert.match(teacherExamples, /answer\/16757456/, "teacher guide should cite official slide-deck guidance");
assert.match(teacherExamples, /answer\/16758265/, "teacher guide should cite official infographic guidance");
assert.match(teacherExamples, /support\.google\.com\/gemininotebook\/answer\/16179559/, "teacher guide should cite official source-grounded chat guidance");
assert.doesNotMatch(teacherExamples, /Captain|來源透明|原資料庫|實體 schema/i, "teacher guide must not expose internal source notes");
assert.doesNotMatch(teacherExamples, /kocpc|ghost\.io|Captain|Balung/i, "teacher guide must not expose reference-article attribution");
assert.doesNotMatch(`${promptLibrary}\n${teacherGuide}\n${studentHandout}`, /固定 10 頁|10 頁故事|10 頁完整|線上 10 頁|10 張精修/, "course planning should consistently use the 4-6 page studio");

const yamlPaths = Array.from(app.matchAll(/path:\s*"([^"]+\.yaml)"/g), (match) => match[1]);
assert.equal(yamlPaths.length, 16, "YAML viewer should list 16 files");
assert.equal(new Set(yamlPaths).size, 16, "YAML viewer paths must be unique");
for (const relative of yamlPaths) {
  assert(fs.existsSync(path.join(route, relative)), `missing YAML viewer file ${relative}`);
}

for (const image of [
  "char-xq-turnaround.png",
  "char-manager-turnaround.png",
  "page-cover.png",
  "page-discovery.png",
  "page-return.png",
  "workbench-preview.png"
]) {
  const target = path.join(route, "assets", "images", image);
  assert(fs.existsSync(target), `missing image ${image}`);
  assert(fs.statSync(target).size > 100_000, `image ${image} is unexpectedly small`);
}

const displayFont = path.join(route, "assets", "fonts", "iansui-course-display.woff2");
const fontLicense = path.join(route, "assets", "fonts", "OFL-Iansui.txt");
assert(fs.existsSync(displayFont), "missing self-hosted Iansui display font");
assert(fs.statSync(displayFont).size > 10_000, "display font is unexpectedly small");
assert.equal(fs.readFileSync(displayFont).subarray(0, 4).toString("ascii"), "wOF2", "display font must be WOFF2");
assert(fs.existsSync(fontLicense), "missing Iansui OFL license");
assert.doesNotMatch(html + "\n" + styles + "\n" + promptIntroHtml + "\n" + promptIntroStyles, /iansui-course-display|font-family:\s*"Iansui"/i, "course and introduction should use the same system type as /class");
assert.match(styles, /--font-body:\s*Arial,\s*"Noto Sans TC"/, "course should share the /class font stack");
assert.match(styles, /\.course-intro h1\s*\{[\s\S]*?font-weight:\s*900/, "compact course title should use a clear sans heading");
assert.match(styles, /\.section-heading h2\s*\{[\s\S]*?font-weight:\s*900/, "section headings should use a clear sans heading");
assert.doesNotMatch(styles, /DFKai-SB|BiauKai/, "legacy Kai font fallback should be removed");

assert.match(workbench, /blobToDataUrl/, "workbench should embed images in downloaded HTML");
assert.match(workbench, /\.\.\/assets\/images\/page-cover\.png/, "workbench cover path is invalid");
assert.match(workbench, /href="\.\.\/"/, "workbench needs a return link");

const courseZip = path.join(route, "downloads", "taipei-0904-picture-book-course-pack.zip");
assert(fs.existsSync(courseZip), "missing downloadable course ZIP");
assert(fs.statSync(courseZip).size > 10_000_000, "course ZIP is unexpectedly small");

const classSlides = path.join(route, "downloads", "taipei-0904-class-slides.pptx");
assert(fs.existsSync(classSlides), "missing official classroom slide deck");
assert(fs.statSync(classSlides).size > 3_000_000, "classroom slide deck is unexpectedly small");
assert.equal(fs.readFileSync(classSlides).subarray(0, 2).toString("ascii"), "PK", "classroom slide deck must be a valid PPTX container");

assert.equal((classIndex.match(/<!doctype html>/gi) || []).length, 1, "class index must contain one HTML document");
assert.match(classIndex, /href="\/class\/taipei-ai\/"/, "class index should lead to the Taipei four-course hub");
assert.match(classIndex, /2026 秋季四堂課/, "class index must label the Taipei series");
assert.match(html, /href="\/class\/taipei-ai\/" aria-label="回到北市府四堂課首頁"/, "lesson page should return to the Taipei series hub");

assert.equal((seriesIndex.match(/class="course-card(?:\s|")/g) || []).length, 4, "Taipei series hub must show exactly four courses");
assert.match(seriesIndex, /<meta name="theme-color" content="#147d7e">/, "Taipei series hub must use the class theme color");
assert.match(seriesIndex, /styles\.css\?v=20260904c/, "Taipei series stylesheet cache key is stale");
assert.match(seriesIndex, /<h1 id="course-title">四堂課，把 AI 帶進你的教室。<\/h1>/, "Taipei series title must lead directly into the course list");
assert.doesNotMatch(seriesIndex, /class="hero"|hero-preview/, "Taipei series hub must not reserve the first viewport for a large hero");
for (const date of ["2026/9/4", "2026/9/11", "2026/9/18", "2026/10/2"]) {
  assert.match(seriesIndex, new RegExp(date.replaceAll("/", "\\/")), `Taipei series hub is missing ${date}`);
}
assert.match(seriesIndex, /自己的繪本自己生！用 AI 生成專屬部落故事/, "first Taipei course title is missing");
assert.match(seriesIndex, /href="2026-0904-picture-book\/prompt-intro\/">先做互動緒論<\/a>/, "Taipei series hub must expose the interactive introduction");
assert.match(seriesIndex, /href="2026-0904-picture-book\/">進入第 1 堂課程<\/a>/, "Taipei series hub must retain the full lesson entry");
assert.equal((seriesIndex.match(/遊戲化教學術：把靜態教材變成超好玩的互動闖關/g) || []).length, 2, "the two game-based teaching sessions are missing");
assert.match(seriesIndex, /拒絕加班！把 Gemini 訓練成最懂你的 AI 備課助理/, "fourth Taipei course title is missing");
assert.equal((seriesIndex.match(/<button[^>]+class="course-status"[^>]+disabled/g) || []).length, 3, "future Taipei sessions must use three disabled building-state buttons");
assert.doesNotMatch(seriesIndex, /2026-0911|2026-0918|2026-1002/, "building sessions must not link to nonexistent routes");
assert.match(seriesStyles, /@media \(max-width: 480px\)[\s\S]*?\.course-card\s*{/, "Taipei series hub needs a 390px card layout");
for (const [token, value] of Object.entries({
  ink: "#111827",
  muted: "#536273",
  line: "#d7dee7",
  paper: "#f8fafb",
  teal: "#147d7e",
  gold: "#e3a62f",
  blue: "#3d8dff",
  red: "#d45a4a",
  navy: "#101827"
})) {
  assert.match(seriesStyles, new RegExp(`--${token}:\\s*${value}`, "i"), `Taipei series hub must share /class token --${token}`);
  assert.match(classStyles, new RegExp(`--${token}:${value}`, "i"), `/class is missing expected token --${token}`);
}
assertContrast("#ffffff", "#111827", 4.5, "Taipei series CTA white on ink");
assertContrast("#536273", "#f8fafb", 4.5, "Taipei series muted text on paper");
assertContrast("#147d7e", "#f8fafb", 4.5, "Taipei series teal on paper");
assertContrast("#9a690e", "#ffffff", 4.5, "Taipei series gold label on white");
assertContrast("#2458aa", "#ffffff", 4.5, "Taipei series blue label on white");
assertContrast("#a33d31", "#ffffff", 4.5, "Taipei series red label on white");
assert.match(seriesStyles, /\.course-actions\s*\{[\s\S]*?display:\s*flex;[\s\S]*?flex-wrap:\s*wrap;[\s\S]*?margin-top:\s*auto/, "Taipei series actions should stay grouped");
assert.match(seriesStyles, /@media \(max-width: 480px\)[\s\S]*?\.course-actions\s*\{[\s\S]*?flex-direction:\s*column/, "Taipei series actions should stack on small screens");
assert.match(seriesStyles, /\.course-section\s*{[\s\S]*?padding-block:\s*clamp\(44px, 6vw, 72px\) 84px/, "Taipei series intro must stay compact");
assert.match(seriesStyles, /\.course-grid\s*{[\s\S]*?grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/, "Taipei series cards should use a compact two-column desktop grid");
assert.doesNotMatch(seriesStyles, /@font-face|Iansui|min-height:\s*min\(720px|course-card-featured[\s\S]{0,300}?url\(/, "Taipei series hub still contains the removed campaign hero treatment");
assert.doesNotMatch(`${seriesIndex}\n${seriesStyles}`, /Captain|船長|—|–/, "Taipei series hub must not expose internal labels or long dash characters");

console.log("Taipei course tests passed: four-course hub, interactive prompt introduction, three-stage 9/4 route, collapsed optional tools, plain-language prompts, style switcher, palette, contrast, YAML files, assets, mobile layout, practice room and ZIP.");
