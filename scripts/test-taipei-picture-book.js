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
const workbench = read(path.join("workbench", "index.html"));
const practiceHtml = read(path.join("practice", "index.html"));
const practiceStyles = read(path.join("practice", "styles.css"));
const practiceCore = read(path.join("practice", "core.js"));
const practiceApp = read(path.join("practice", "app.js"));
const classIndex = fs.readFileSync(path.join(root, "class", "index.html"), "utf8");

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
assert.match(html, /styles\.css\?v=20260903c/, "course stylesheet cache key is stale");
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
assert.match(styles, /footer\s*{[\s\S]*?background:\s*var\(--ink\)/, "footer should use brand navy");
assert.match(styles, /:focus-visible\s*{[\s\S]*?outline:\s*3px solid var\(--focus\)/, "focus ring should use the accessible focus token");

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

assert.match(html, /<section class="practice-cta"[^>]+aria-labelledby="practice-cta-title">/, "course page needs a practice CTA after YAML");
assert.match(html, /href="practice\/">開啟 AI 教材練習室<\/a>/, "practice CTA link is missing");
assert(html.indexOf('id="yaml"') < html.indexOf('class="practice-cta"'), "practice CTA must follow the YAML lab");
assert(html.indexOf('class="practice-cta"') < html.indexOf('id="example"'), "practice CTA must precede the classroom example");
assert.match(styles, /\.practice-cta\s*{[\s\S]*?background:\s*var\(--blue-dark\)/, "practice CTA must use the course action color");
assert.match(styles, /@media \(max-width: 620px\)[\s\S]*?\.practice-cta \.button\s*{\s*width:\s*100%/, "practice CTA must fit mobile width");
for (const relative of ["index.html", "styles.css", "core.js", "app.js"]) {
  assert(fs.existsSync(path.join(route, "practice", relative)), `missing practice/${relative}`);
}

assert.doesNotMatch(html, /Captain|來源透明|原資料庫|實體 schema/i, "student page must not expose internal source notes");
assert.doesNotMatch(promptLibrary, /Captain/i, "downloadable prompt library must not expose internal source notes");

const promptHeadings = Array.from(promptLibrary.matchAll(/^##\s+(N-CLASS|N\d{2}|C\d{2})｜([^\r\n]+)$/gm));
const promptCodes = promptHeadings.map((match) => match[1]);
assert.equal(promptCodes.length, 20, "prompt library should expose 20 task prompts");
assert.equal(new Set(promptCodes).size, 20, "prompt codes must be unique");
for (const code of ["N-CLASS", "N00", "N08", "C00", "C09"]) {
  assert(promptCodes.includes(code), `missing prompt ${code}`);
}

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
assert.equal((classIndex.match(/\/class\/taipei-ai\/2026-0904-picture-book\//g) || []).length, 2, "class index should link the route and its preview image once each");
assert.match(classIndex, /北市府四堂課 · 獨立系列/, "class index must label the course as an independent series");

console.log("Taipei 9/4 picture-book course tests passed: palette, contrast, 20 prompts, 16 YAML files, assets, typography, responsive tools, practice CTA, ZIP and class entry.");
