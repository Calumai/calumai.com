const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const read = (relativePath, encoding = 'utf8') =>
  fs.readFileSync(path.join(root, relativePath), encoding);

const page = read('class/lesson-08.html');
const css = read('class/lesson-08-line.css');
const clientJs = read('class/lesson-08-line.js');
const index = read('class/index.html');
const lessonJs = read('class/lesson.js');

assert.match(page, /^<!doctype html>/i, 'Lesson 08 must be a complete HTML document');
assert.match(page, /<html lang="zh-Hant">/, 'Page language must be Traditional Chinese');
assert.match(page, /<meta name="viewport"/, 'Viewport metadata is required');
assert.match(page, /<link rel="canonical" href="https:\/\/calumai\.com\/class\/lesson-08\.html">/);
assert.match(page, /LINE 教學小幫手：行事曆與單詞查詢/);

for (const id of [
  'main',
  'choose',
  'goals',
  'flow',
  'prep',
  'downloads',
  'calendar',
  'word-helper',
  'verify',
  'troubleshooting',
  'safety',
  'homework',
  'prompts',
  'sources'
]) {
  assert.match(page, new RegExp(`id="${id}"`), `Missing Lesson 08 section: ${id}`);
}

assert.equal((page.match(/class="step-card"/g) || []).length, 16, 'Each route must have eight steps');
assert.match(page, /1,094 筆/, 'The published word-list size must be stated');
assert.match(page, /一個 Messaging API Channel 只能設定一個 Webhook URL/);
assert.match(page, /LINE_TOKEN/);
assert.match(page, /WORD_SHEET_ID/);
assert.match(page, /Asia\/Taipei/);
assert.match(page, /確認行事曆/);
assert.match(page, /查詞 kingal/);
assert.match(page, /純 Apps Script Web App 無法可靠讀取 LINE 的簽章標頭/);
assert.match(page, /Messaging API 啟用後不能更換或解除 Provider/);
assert.match(page, /https:\/\/glossary\.ilrdf\.org\.tw\//);
assert.match(page, /for="prompt-calendar"/);
assert.match(page, /for="prompt-word"/);
assert.match(page, /for="prompt-change"/);

assert.doesNotMatch(page, /Padlet/i, 'Old Padlet handout must not appear on the new page');
assert.doesNotMatch(page, /slideshow\.html\?lesson=08/);
assert.doesNotMatch(page, /ppt\/lesson-08\.pptx/);
assert.doesNotMatch(page, /ppt-preview\/08/);

const copyTargets = [...page.matchAll(/data-copy-target="([^"]+)"/g)].map((match) => match[1]);
assert.equal(copyTargets.length, 3, 'Expected three copyable prompts');
for (const target of copyTargets) {
  assert.match(page, new RegExp(`id="${target}"`), `Copy target does not exist: ${target}`);
}

const localReferences = [...page.matchAll(/(?:href|src)="(\/[^"]+)"/g)]
  .map((match) => match[1])
  .filter((reference) => !reference.startsWith('//'));

for (const reference of localReferences) {
  const clean = decodeURIComponent(reference.split('#')[0].split('?')[0]);
  let diskPath = path.join(root, clean.replace(/^\//, ''));
  if (clean.endsWith('/')) diskPath = path.join(diskPath, 'index.html');
  assert.ok(fs.existsSync(diskPath), `Broken local reference: ${reference}`);
}

const assets = [
  'class/examples/lesson-08-line-helper/calendar/Code.gs',
  'class/examples/lesson-08-line-helper/calendar/LineCalendar.gs',
  'class/examples/lesson-08-line-helper/word/Code.gs',
  'class/examples/lesson-08-line-helper/lesson-08-line-helper-materials.zip',
  'class/examples/lesson-08-line-helper/README.txt'
];

for (const asset of assets) {
  const stats = fs.statSync(path.join(root, asset));
  assert.ok(stats.size > 100, `Download is unexpectedly small: ${asset}`);
}

for (const scriptPath of assets.filter((asset) => asset.endsWith('.gs'))) {
  new vm.Script(read(scriptPath), { filename: scriptPath });
}
new vm.Script(clientJs, { filename: 'class/lesson-08-line.js' });

const zip = read('class/examples/lesson-08-line-helper/lesson-08-line-helper-materials.zip', null);
assert.equal(zip.subarray(0, 2).toString('ascii'), 'PK', 'Material bundle must remain a ZIP file');
assert.ok(!fs.existsSync(path.join(root, 'class/examples/lesson-08-line-helper/word/太魯閣語單詞列表.xlsx')), 'The official word list must not be mirrored without an explicit redistribution licence');

const lessonIds = [...index.matchAll(/id="lesson-(\d{2})"/g)].map((match) => match[1]);
assert.equal(lessonIds.length, 12, 'Course overview must retain all 12 lesson cards');
assert.deepEqual(lessonIds, Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')));

const lesson08Card = index.match(/<article class="l teal" id="lesson-08">[\s\S]*?<\/article>/)?.[0] || '';
assert.match(lesson08Card, /LINE 教學小幫手：行事曆與單詞查詢/);
assert.match(lesson08Card, /查看第 8 堂講義、程式與詞表/);
assert.doesNotMatch(lesson08Card, /Padlet|PPT/i);
assert.match(index, /06–10<\/b>遊戲、LINE 小幫手、Vids/);
assert.doesNotMatch(index, /每堂都有完整 PPT|每堂一份 PPT/);

assert.match(lessonJs, /'08':\{title:'LINE 教學小幫手：行事曆與單詞查詢'/);
assert.doesNotMatch(lessonJs, /GEMINI \/ PADLET|製作自己的 Padlet/i);

assert.match(css, /@media\(max-width:780px\)/);
assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);

const publicText = [page, clientJs, ...assets.filter((asset) => asset.endsWith('.gs')).map((asset) => read(asset))].join('\n');
assert.doesNotMatch(publicText, /(?:CHANNEL_ACCESS_TOKEN|LINE_TOKEN)\s*=\s*['"][A-Za-z0-9+\/_=-]{20,}['"]/);

console.log('PASS: Lesson 08 LINE helper page, downloads, navigation, safety checks and scripts');
