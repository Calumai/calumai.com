'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = process.env.TAIPEI_AI_ROOT || (
  path.basename(__dirname) === 'taipei-ai-site-staging'
    ? __dirname
    : path.resolve(__dirname, '..', 'class', 'taipei-ai')
);
const read = (...parts) => fs.readFileSync(path.join(root, ...parts), 'utf8');

const lessonTwo = read('2026-0911-gamified-learning', 'index.html');
const lessonThree = read('2026-0918-gamified-learning', 'index.html');
const sharedJs = read('assets', 'handout.js');
const sharedCss = read('assets', 'handout.css');
const hub = fs.existsSync(path.join(root, 'hub-index.html'))
  ? read('hub-index.html')
  : read('index.html');

assert.match(lessonTwo, /<html lang="zh-Hant">/);
assert.match(lessonThree, /<html lang="zh-Hant">/);
assert.match(lessonTwo, /遊戲化教學術（上）/);
assert.match(lessonThree, /遊戲化教學術（下）/);

for (const id of ['route', 'vibe', 'ability-map', 'make', 'prompt-builder']) {
  assert.match(lessonTwo, new RegExp(`id="${id}"`), `lesson 2 is missing ${id}`);
}
for (const id of ['route', 'debug', 'upgrade', 'gas', 'share', 'release']) {
  assert.match(lessonThree, new RegExp(`id="${id}"`), `lesson 3 is missing ${id}`);
}

assert.equal((lessonTwo.match(/class="route-card/g) || []).length, 3, 'lesson 2 needs three route cards');
assert.equal((lessonThree.match(/class="route-card/g) || []).length, 3, 'lesson 3 needs three route cards');
assert.equal((lessonTwo.match(/class="tool-drawer/g) || []).length, 0, 'lesson 2 must not expose instructor drawers');
assert.equal((lessonThree.match(/class="tool-drawer/g) || []).length, 0, 'lesson 3 must not expose instructor drawers');

assert.match(lessonTwo, /data-cycle/);
assert.match(lessonTwo, /data-prompt-builder/);
assert.match(lessonTwo, /steam\.oxxostudio\.tw\/category\/aigc\/vibe-coding\/about\.html/);
assert.match(lessonTwo, /downloads\/vibe-coding-essentials\.pdf/);
assert.match(lessonTwo, /用自然語言引導 AI 做出作品/);
assert.match(lessonTwo, /做得快，不代表可以不檢查/);
assert.match(lessonTwo, /AI 對話是製作桌/);
assert.match(lessonTwo, /Google 協作平台是整門課的教材入口/);
for (const label of ['記憶', '理解', '應用', '分析', '評鑑', '創造']) {
  assert.match(lessonTwo, new RegExp(label), `lesson 2 is missing ability ${label}`);
}
assert.equal((lessonTwo.match(/<article><b>(?:記憶|理解|應用|分析|評鑑|創造) [012][12]<\/b>/g) || []).length, 12, 'lesson 2 needs twelve game examples');
assert.ok(lessonTwo.indexOf('id="vibe"') < lessonTwo.indexOf('id="ability-map"'), 'lesson 2 must explain Vibe Coding first');
assert.ok(lessonTwo.indexOf('id="ability-map"') < lessonTwo.indexOf('id="make"'), 'lesson 2 must choose a learning ability before building');

assert.match(lessonThree, /data-issue-clinic/);
assert.match(lessonThree, /data-upgrade-builder/);
assert.match(lessonThree, /data-release-gate/);
assert.match(lessonThree, /直接貼 HTML/);
assert.match(lessonThree, /貼 GAS 網址/);
assert.match(lessonThree, /嵌入失敗/);
assert.match(lessonThree, /修改後記得再發布/);
assert.match(lessonThree, /Google Apps Script/);
assert.match(lessonThree, /script\.google\.com/);
assert.match(lessonThree, /function doGet\(\)/);
assert.match(lessonThree, /HtmlService\.createHtmlOutputFromFile\('index'\)/);
assert.match(lessonThree, /data-copy-success="Code\.gs 已複製，現在貼到 Apps Script。"/);
assert.match(lessonThree, /Code\.gs/);
assert.match(lessonThree, /index\.html/);
assert.match(lessonThree, /新增部署作業/);
assert.match(lessonThree, /管理部署作業/);
assert.match(lessonThree, /\/dev/);
assert.match(lessonThree, /\/exec/);
assert.ok(lessonThree.indexOf('id="upgrade"') < lessonThree.indexOf('id="gas"'), 'GAS publishing must follow the game upgrade');
assert.ok(lessonThree.indexOf('id="gas"') < lessonThree.indexOf('id="share"'), 'GAS publishing must happen before Google Sites');
assert.equal((lessonThree.match(/data-switch="gas-/g) || []).length, 5, 'GAS tutorial needs five interactive steps');
assert.equal((lessonThree.match(/class="release-list"[\s\S]*?<\/div>/) || [''])[0].match(/type="checkbox"/g)?.length, 10, 'release gate needs ten checks');
assert.match(lessonThree, /youtube\.com\/watch\?v=9aWaOylZRv0/);
assert.match(lessonThree, /vocus\.cc\/article\/6a7bb6b8fd8978000120cf8b/);
assert.match(lessonThree, /developers\.google\.com\/apps-script\/guides\/web/);
assert.match(lessonThree, /developers\.google\.com\/apps-script\/concepts\/deployments/);
assert.match(lessonThree, /developers\.google\.com\/apps-script\/guides\/html\/restrictions/);
assert.match(lessonThree, /support\.google\.com\/sites\/answer\/90569/);
assert.match(lessonThree, /support\.google\.com\/sites\/answer\/6372880/);

const publicPages = lessonTwo + lessonThree;
assert.doesNotMatch(publicPages, /遊戲化拆解台|起始版與講師流程|作品急診室|講師時間表|帶到哪裡，再打開哪個工具/);
assert.doesNotMatch(publicPages, /Chapter\s*\d/i, 'public pages must not expose chapter handout structure');
assert.doesNotMatch(publicPages, /【建議截圖|附錄\s*[A-Z]|老師先記這一句|Google協作平台-Vibe-Coding-完整講義\.md/);
assert.doesNotMatch(publicPages, /[—–]/, 'visible pages must use regular punctuation');
assert.doesNotMatch(publicPages, /target="_blank"(?![^>]*rel="noopener noreferrer")/, 'new tabs need opener protection');
assert.doesNotMatch(publicPages, /<img(?![^>]*\balt=)/, 'every image needs alt text');

for (const [html, route] of [
  [lessonTwo, '2026-0911-gamified-learning'],
  [lessonThree, '2026-0918-gamified-learning']
]) {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, `${route} must not contain duplicate ids`);

  for (const match of html.matchAll(/(?:href|src)="(\.\.\/[^"#?]+)(?:\?[^"#]*)?"/g)) {
    const localPath = path.resolve(root, route, match[1]);
    if (match[1].startsWith('../2026-0904-picture-book/')) continue;
    assert.ok(fs.existsSync(localPath), `missing local asset: ${localPath}`);
  }
}

for (const functionName of [
  'initSwitchers',
  'initCycle',
  'initPromptBuilder',
  'initStaticCopies',
  'initIssueClinic',
  'initUpgradeBuilder',
  'initReleaseGate',
  'initSectionNavigation'
]) {
  assert.match(sharedJs, new RegExp(`function ${functionName}\\(`), `missing ${functionName}`);
}
assert.doesNotMatch(sharedJs, /function initToolDrawers\(|function initMiniGame\(|function initTimer\(/, 'obsolete instructor widgets must be removed');
assert.match(sharedJs, /IntersectionObserver/);
assert.match(sharedJs, /button\.dataset\.copySuccess/);
assert.doesNotMatch(sharedJs, /addEventListener\(['"]scroll['"]/, 'use IntersectionObserver instead of scroll listeners');
assert.match(sharedCss, /@media \(max-width: 500px\)/);
assert.match(sharedCss, /prefers-reduced-motion/);
assert.match(sharedCss, /\.ability-console/);
assert.match(sharedCss, /\.publish-flow/);
assert.match(sharedCss, /\.vibe-handout/);
assert.match(sharedCss, /\.gas-concept-map/);
assert.match(sharedCss, /\.gas-console/);
assert.match(sharedCss, /\.gas-url-grid/);

assert.ok(fs.existsSync(path.join(root, 'downloads', 'vibe-coding-essentials.pdf')), 'lesson 2 handout PDF is missing');
assert.ok(fs.existsSync(path.join(root, 'assets', 'vibe-coding-essentials-cover.jpg')), 'lesson 2 handout cover is missing');

assert.match(hub, /href="2026-0911-gamified-learning\/">進入第 2 堂課程<\/a>/);
assert.match(hub, /href="2026-0918-gamified-learning\/">進入第 3 堂課程<\/a>/);
assert.doesNotMatch(hub, /第 [23] 堂課程建置中/);

console.log('PASS: Taipei AI lessons 2 and 3 are learner-facing game design studios');
