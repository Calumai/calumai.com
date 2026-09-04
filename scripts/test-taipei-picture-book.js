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
const classIndex = fs.readFileSync(path.join(root, "class", "index.html"), "utf8");
const seriesIndex = fs.readFileSync(path.join(root, "class", "taipei-ai", "index.html"), "utf8");
const seriesStyles = fs.readFileSync(path.join(root, "class", "taipei-ai", "styles.css"), "utf8");

const palette = {
  ink: "#0c2247",
  inkSoft: "#415673",
  paper: "#f5faff",
  white: "#ffffff",
  blue: "#007eeb",
  blueDark: "#005fb8",
  red: "#d91d26",
  orange: "#fca116",
  controlBorder: "#7896b4"
};

for (const [token, value] of Object.entries({
  ink: palette.ink,
  "ink-soft": palette.inkSoft,
  paper: palette.paper,
  white: palette.white,
  blue: palette.blue,
  "blue-dark": palette.blueDark,
  red: palette.red,
  orange: palette.orange,
  "control-border": palette.controlBorder,
  focus: palette.blueDark
})) {
  assert.match(styles, new RegExp(`--${token}:\\s*${value}`, "i"), `missing brand palette token --${token}`);
}

assert.match(html, /<meta name="theme-color" content="#005fb8">/i, "theme color should use accessible brand blue");
assert.match(html, /styles\.css\?v=20260904b/, "course stylesheet cache key is stale");
assert.match(html, /app\.js\?v=20260904b/, "course script cache key is stale");
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

assert.doesNotMatch(`${html}\n${workbench}`, /[—–]/, "student-facing HTML should use regular hyphens");
assert.doesNotMatch(`${practiceHtml}\n${practiceStyles}\n${practiceCore}\n${practiceApp}`, /[—–]/, "practice page should use regular hyphens");
assert.match(styles, /\.button\.primary\s*{[\s\S]*?background:\s*var\(--blue-dark\)/, "primary CTA should use action blue");
assert.match(styles, /\.prompt-item\.is-active\s*{[\s\S]*?background:\s*var\(--blue-dark\)/, "active prompt should use action blue");
assert.match(styles, /\.course-boundary\s*{[\s\S]*?var\(--blue-dark\)[\s\S]*?var\(--blue\)/, "course boundary should use the blue brand gradient");
assert.match(styles, /\.schedule-section\s*{[\s\S]*?var\(--blue-soft\)/, "schedule should use the light-blue surface");
assert.match(styles, /\.yaml-section\s*{[\s\S]*?var\(--paper-deep\)/, "YAML section should use the cool brand surface");
assert.match(styles, /\.reference-strip\s*{[\s\S]*?background:\s*var\(--blue-dark\)/, "reference strip should use action blue");
assert.match(styles, /\.reference-strip div div\s*{[^}]*flex-wrap:\s*wrap/, "reference links should wrap on narrow screens");
assert.match(styles, /footer\s*{[\s\S]*?background:\s*var\(--ink\)/, "footer should use brand navy");
assert.match(styles, /:focus-visible\s*{[\s\S]*?outline:\s*3px solid var\(--focus\)/, "focus ring should use the accessible focus token");
assert.match(styles, /\.immersion-board\s*{[\s\S]*?grid-template-columns:\s*minmax\(220px, \.72fr\) minmax\(0, 1\.15fr\) minmax\(240px, \.72fr\)/, "immersive studio needs a three-column desktop layout");
assert.match(styles, /@media \(max-width: 860px\)[\s\S]*?\.immersion-board\s*{\s*grid-template-columns:\s*1fr/, "immersive studio must collapse on mobile");

assertContrast(palette.white, palette.blueDark, 4.5, "white on action blue");
assertContrast(palette.white, palette.red, 4.5, "white on action red");
assertContrast(palette.ink, palette.orange, 4.5, "navy on orange");
assertContrast(palette.ink, palette.paper, 7, "primary text on paper");
assertContrast(palette.inkSoft, palette.paper, 4.5, "secondary text on paper");
assertContrast(palette.controlBorder, palette.white, 3, "control border on white");

for (const id of ["workflow", "prompts", "yaml", "example", "gates", "downloads"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `missing section #${id}`);
}
assert.doesNotMatch(html, /3-HOUR ROUTE|三小時，先求走完整條線|查看完整 12 段時間表|本頁屬於北市府四堂/u, "internal schedule or boundary copy must not be public");
assert.match(html, /IMMERSIVE STUDIO/, "course page should lead with immersive studio framing");
for (const label of ["故事室", "角色室", "美術室", "分鏡桌", "生圖室", "出版桌"]) {
  assert.match(html, new RegExp(label), `missing immersive studio step ${label}`);
}
assert.match(html, /4-6 頁小繪本/, "course page should use the single-class 4-6 page target");
assert.match(html, /materials\/docs\/immersive-practice-plan\.md/, "immersive practice plan download is missing");

assert.match(html, /<section class="practice-cta"[^>]+aria-labelledby="practice-cta-title">/, "course page needs a practice CTA after YAML");
assert.match(html, /href="practice\/">開啟 AI 繪本工作室<\/a>/, "practice CTA link is missing");
assert(html.indexOf('id="yaml"') < html.indexOf('class="practice-cta"'), "practice CTA must follow the YAML lab");
assert(html.indexOf('class="practice-cta"') < html.indexOf('id="example"'), "practice CTA must precede the classroom example");
assert.match(styles, /\.practice-cta\s*{[\s\S]*?background:\s*var\(--blue-dark\)/, "practice CTA must use the course action color");
assert.match(styles, /@media \(max-width: 620px\)[\s\S]*?\.practice-cta \.button\s*{\s*width:\s*100%/, "practice CTA must fit mobile width");
for (const relative of ["index.html", "styles.css", "core.js", "app.js"]) {
  assert(fs.existsSync(path.join(route, "practice", relative)), `missing practice/${relative}`);
}

assert.doesNotMatch(html, /Captain|來源透明|原資料庫|實體 schema/i, "student page must not expose internal source notes");
assert.doesNotMatch(promptLibrary, /Captain/i, "downloadable prompt library must not expose internal source notes");

const promptHeadings = Array.from(promptLibrary.matchAll(/^##\s+(N-CLASS|N\d{2}|T\d{2}|C\d{2})｜([^\r\n]+)$/gm));
const promptCodes = promptHeadings.map((match) => match[1]);
assert.equal(promptCodes.length, 40, "prompt library should expose 40 task prompts");
assert.equal(new Set(promptCodes).size, 40, "prompt codes must be unique");
for (const code of ["N-CLASS", "N00", "N08", "T01", "T10", "T11", "T20", "C00", "C09"]) {
  assert(promptCodes.includes(code), `missing prompt ${code}`);
}
assert.match(html, /data-prompt-group="teacher">教師教材<\/button>/, "teacher prompt tab is missing");
assert.match(html, /id="teacher-example-select"/, "teacher quick picker is missing");
assert.match(html, /<option value="T01">/, "teacher quick picker is missing T01");
assert.match(html, /<option value="T10">/, "teacher quick picker is missing T10");
assert.match(html, /<option value="T20">/, "teacher quick picker is missing T20");
assert.match(html, /<optgroup label="教學簡報｜貼到工作室的簡報">/, "teacher picker should lead with slide decks");
assert.match(html, /<optgroup label="資訊圖表｜貼到工作室的資訊圖表">/, "teacher picker should group infographics");
assert.match(styles, /\.prompt-tabs\s*{[\s\S]*?grid-template-columns:\s*repeat\(3, minmax\(0, 1fr\)\)/, "prompt tabs should fit three groups");
assert.match(app, /requiredCodes\s*=\s*\["N-CLASS", "N00", "N08", "T01", "T10", "T11", "T20", "C00", "C09"\]/, "prompt loader should validate teacher prompts");
assert.match(teacherExamples, /教學簡報｜六種直接套用情境/, "teacher slide-deck examples are incomplete");
assert.match(teacherExamples, /資訊圖表｜四種直接套用情境/, "teacher infographic examples are incomplete");
assert.match(teacherExamples, /工作室 → 簡報／資訊圖表 → 鉛筆 → 自訂提示詞/, "teacher guide should show where to paste visual prompts");
assert.match(teacherExamples, /answer\/16757456/, "teacher guide should cite official slide-deck guidance");
assert.match(teacherExamples, /answer\/16758265/, "teacher guide should cite official infographic guidance");
assert.match(teacherExamples, /support\.google\.com\/gemininotebook\/answer\/16179559/, "teacher guide should cite official source-grounded chat guidance");
assert.doesNotMatch(teacherExamples, /Captain|來源透明|原資料庫|實體 schema/i, "teacher guide must not expose internal source notes");
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
assert.match(html, /rel="preload"[^>]+iansui-course-display\.woff2/, "display font should be preloaded");
assert.match(styles, /@font-face\s*{[\s\S]*?font-family:\s*"Iansui"/, "Iansui font-face is missing");
assert.match(styles, /\.hero h1\s*{[\s\S]*?font-family:\s*var\(--font-display\)/, "hero should use the display font");
assert.match(styles, /\.section-heading h2\s*{[\s\S]*?font-family:\s*var\(--font-display\)/, "section headings should use the display font");
assert.doesNotMatch(styles, /DFKai-SB|BiauKai/, "legacy Kai font fallback should be removed");

assert.match(workbench, /blobToDataUrl/, "workbench should embed images in downloaded HTML");
assert.match(workbench, /\.\.\/assets\/images\/page-cover\.png/, "workbench cover path is invalid");
assert.match(workbench, /href="\.\.\/"/, "workbench needs a return link");

const courseZip = path.join(route, "downloads", "taipei-0904-picture-book-course-pack.zip");
assert(fs.existsSync(courseZip), "missing downloadable course ZIP");
assert(fs.statSync(courseZip).size > 10_000_000, "course ZIP is unexpectedly small");

assert.equal((classIndex.match(/<!doctype html>/gi) || []).length, 1, "class index must contain one HTML document");
assert.match(classIndex, /href="\/class\/taipei-ai\/"/, "class index should lead to the Taipei four-course hub");
assert.match(classIndex, /2026 秋季四堂課/, "class index must label the Taipei series");
assert.match(html, /href="\/class\/taipei-ai\/" aria-label="回到北市府四堂課首頁"/, "lesson page should return to the Taipei series hub");

assert.equal((seriesIndex.match(/class="course-card(?:\s|")/g) || []).length, 4, "Taipei series hub must show exactly four courses");
for (const date of ["2026/9/4", "2026/9/11", "2026/9/18", "2026/10/2"]) {
  assert.match(seriesIndex, new RegExp(date.replaceAll("/", "\\/")), `Taipei series hub is missing ${date}`);
}
assert.match(seriesIndex, /自己的繪本自己生！用 AI 生成專屬部落故事/, "first Taipei course title is missing");
assert.equal((seriesIndex.match(/遊戲化教學術：把靜態教材變成超好玩的互動闖關/g) || []).length, 2, "the two game-based teaching sessions are missing");
assert.match(seriesIndex, /拒絕加班！把 Gemini 訓練成最懂你的 AI 備課助理/, "fourth Taipei course title is missing");
assert.equal((seriesIndex.match(/<button[^>]+class="course-status"[^>]+disabled/g) || []).length, 3, "future Taipei sessions must use three disabled building-state buttons");
assert.doesNotMatch(seriesIndex, /2026-0911|2026-0918|2026-1002/, "building sessions must not link to nonexistent routes");
assert.match(seriesStyles, /@media \(max-width: 480px\)[\s\S]*?\.course-card\s*{/, "Taipei series hub needs a 390px card layout");
assert.doesNotMatch(`${seriesIndex}\n${seriesStyles}`, /Captain|船長|—|–/, "Taipei series hub must not expose internal labels or long dash characters");

console.log("Taipei course tests passed: four-course hub, 9/4 immersive lesson, palette, contrast, 40 prompts, teacher examples, YAML files, assets, responsive tools, practice CTA and ZIP.");
