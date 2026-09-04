const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const route = path.join(root, "class", "taipei-ai", "2026-0904-picture-book");
const practice = path.join(route, "practice");

function read(relative) {
  return fs.readFileSync(path.join(practice, relative), "utf8");
}

const html = read("index.html");
const styles = read("styles.css");
const app = read("app.js");
const coreSource = read("core.js");
const core = require(path.join(practice, "core.js"));
const combinedStudentSource = `${html}\n${styles}\n${app}\n${coreSource}`;

for (const file of ["index.html", "styles.css", "core.js", "app.js"]) {
  assert(fs.existsSync(path.join(practice, file)), `missing practice/${file}`);
}

assert.match(html, /<html lang="zh-Hant">/, "practice page language is missing");
assert.match(html, /Content-Security-Policy[^>]+default-src 'self'/, "practice page needs a same-origin CSP");
assert.match(html, /connect-src 'self'/, "practice page must only connect to the same origin");
assert.match(html, /styles\.css\?v=20260904c/, "practice stylesheet cache key is stale");
assert.match(html, /app\.js\?v=20260904c/, "practice app cache key is stale");
assert.match(html, /<a class="skip-link" href="#main">/, "practice page needs a skip link");
assert.match(html, /id="claim-form"/, "practice page needs a classroom claim form");
assert.match(html, /id="workspace"[^>]+hidden/, "workspace must stay hidden before a session is claimed");
assert.match(html, /role="tablist"/, "generator switcher must expose tab semantics");
assert.match(html, /id="text-panel" role="tabpanel"/, "text generator tab panel is missing");
assert.match(html, /id="image-panel" role="tabpanel"/, "image generator tab panel is missing");
for (const bookControl of ["book-setup-form", "book-reference-input", "culture-mode", "culture-reviewed", "book-page-count", "book-plan-workspace", "book-page-template", "generate-next-page", "print-book"]) {
  assert.match(html, new RegExp(`(?:id|class)=['\"][^'\"]*${bookControl}[^'\"]*['\"]`), `picture book control ${bookControl} is missing`);
}
for (const workbenchControl of ["studio-workbench", "studio-step-rail", "studio-stage", "studio-preview-rail", "previous-book-page", "book-page-tabs", "next-book-page"]) {
  assert.match(html, new RegExp(`(?:id|class)=['\"][^'\"]*${workbenchControl}[^'\"]*['\"]`), `fixed workbench control ${workbenchControl} is missing`);
}
const studioStepTargets = [...html.matchAll(/data-studio-step-target="(\d+)"/g)].map((match) => Number(match[1]));
assert.deepEqual(studioStepTargets, [1, 2, 3, 4, 5], "studio step rail must expose all five steps in order");
const studioPanelSteps = [...html.matchAll(/data-studio-panel="([\d ]+)"/g)]
  .flatMap((match) => match[1].trim().split(/\s+/).map(Number));
assert.deepEqual([...new Set(studioPanelSteps)].sort(), [1, 2, 3, 4, 5], "studio panels must cover all five workflow steps");
assert.match(html, /data-studio-panel="2"[^>]+hidden/, "the second setup panel must start hidden");
assert.match(html, /data-studio-panel="3"[^>]+hidden/, "the third setup panel must start hidden");
assert.match(html, /AI 繪本工作室/, "practice page should use immersive book-studio framing");
assert.match(html, /先選成品，再讓 AI 幫你拆成可生成的頁面/, "practice page should lead with the guided product workflow");
assert.match(html, /今天可以做繪本、漫畫、班級海報或活動海報/, "practice page should expose the classroom product choices");
assert.match(html, /name="page_count"/, "page count selector is missing");
assert.match(html, /value="4"[\s\S]*?value="5"[\s\S]*?value="6"/, "page count selector should offer 4, 5 and 6 pages");
assert.match(html, /最多 4 張/, "reference image count guidance is missing");
assert.match(html, /每張不超過 4 MB/, "reference image size guidance is missing");
assert.match(html, /傳統服飾與圖紋不是裝飾素材庫/, "cultural reference warning is missing");
assert.match(html, /文字後製，不畫進圖片/, "editable-text policy is missing");
assert.match(html, /value="comic">漫畫｜每頁可調整為 2～4 格/, "comic format must be an explicit learner choice");
assert.match(html, /value="class-poster">班級海報/, "class poster format must be an explicit learner choice");
assert.match(html, /value="event-poster">活動海報/, "event poster format must be an explicit learner choice");
assert.match(html, /每一頁仍可自行改成 2、3 或 4 格/, "comic panel editing guidance is missing");
assert.match(html, /id="text-feedback"[^>]+aria-live="polite"/, "text feedback must be announced");
assert.match(html, /id="book-generation-message"[^>]+aria-live="polite"/, "book feedback must be announced");

for (const fieldName of ["class_code", "nickname", "topic", "audience", "duration_minutes", "objective", "source_notes", "requirements", "book_title", "book_audience", "book_format", "page_count", "story_source", "locked_facts", "culture_mode", "visual_style", "palette", "character_locks"]) {
  assert.match(html, new RegExp(`name=["']${fieldName}["']`), `missing form field ${fieldName}`);
}
for (const requiredField of ["text-source-notes", "text-requirements", "book-title", "book-story-source", "book-locked-facts", "book-character-locks"]) {
  assert.match(html, new RegExp(`id=["']${requiredField}["'][^>]*\\srequired(?:\\s|>)`), `${requiredField} must match the server-required contract`);
}
assert.match(html, /name="duration_minutes"[^>]+min="5"[^>]+max="240"/, "duration range must match the service contract");
for (const [fieldName, maximum] of Object.entries({
  class_code: 128,
  nickname: 40,
  topic: 200,
  audience: 160,
  objective: 1000,
  source_notes: 8000,
  requirements: 3000
})) {
  assert.match(html, new RegExp(`name=["']${fieldName}["'][^>]+maxlength=["']${maximum}["']`), `${fieldName} maximum must match the service contract`);
}

assert.equal(core.SERVICE_BASE, "/api/classroom-ai", "service base must be same-origin");
assert.deepEqual(core.buildClaimPayload({
  class_code: "  CLASS-0904  ",
  nickname: "  小晴  ",
  consent: true
}), {
  class_code: "CLASS-0904",
  nickname: "小晴",
  consent: true
});

const textKey = core.createIdempotencyKey("text", "123e4567-e89b-12d3-a456-426614174000");
const imageKey = core.createIdempotencyKey("image", "123e4567-e89b-12d3-a456-426614174001");
assert.equal(textKey, "classroom-text-123e4567-e89b-12d3-a456-426614174000");
assert.equal(imageKey, "classroom-image-123e4567-e89b-12d3-a456-426614174001");

const textPayload = core.buildTextPayload({
  topic: "  部落地名  ",
  audience: " 國小五年級 ",
  duration_minutes: "40",
  objective: " 說出地名故事 ",
  source_notes: " 已核對的筆記 ",
  requirements: " 繁體中文 "
}, textKey);
assert.deepEqual(textPayload, {
  idempotency_key: textKey,
  topic: "部落地名",
  audience: "國小五年級",
  duration_minutes: 40,
  objective: "說出地名故事",
  source_notes: "已核對的筆記",
  requirements: "繁體中文"
});

const imagePayload = core.buildImagePayload({
  scene: " 雨後公園 ",
  style: " 手繪水彩 ",
  composition: " 小晴在左側 ",
  safe_area: " 右上留白 ",
  avoid: " 不要文字 "
}, imageKey);
assert.deepEqual(imagePayload, {
  idempotency_key: imageKey,
  scene: "雨後公園",
  style: "手繪水彩",
  composition: "小晴在左側",
  safe_area: "右上留白",
  avoid: "不要文字"
});

for (const [pathname, method, body] of [
  ["/session", "GET", undefined],
  ["/session/claim", "POST", { class_code: "A", nickname: "B", consent: true }],
  ["/session/logout", "POST", {}],
  ["/generate/text", "POST", textPayload],
  ["/generate/image", "POST", imagePayload]
]) {
  const request = core.createRequest(pathname, method, body);
  assert.equal(request.url, `/api/classroom-ai${pathname}`);
  assert.equal(request.options.method, method);
  assert.equal(request.options.credentials, "include");
  assert.equal(request.options.headers.Accept, "application/json");
  if (body !== undefined) {
    assert.equal(request.options.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(request.options.body), body);
  } else {
    assert.equal(request.options.body, undefined);
  }
}

const session = core.normalizeSession({
  ok: true,
  session: { nickname: "小晴", mode: "production", expires_at: "2026-09-04T14:00:00Z" },
  classroom: { status: "open", opens_at: "2026-09-04T11:00:00Z", closes_at: "2026-09-04T14:00:00Z" },
  remaining: { text: 3, image: 1 },
  classroom_remaining: { text: 90, image: 30 }
});
assert.equal(session.nickname, "小晴");
assert.equal(session.classroom.status, "open");
assert.deepEqual(session.remaining, { text: 3, image: 1 });
assert.deepEqual(session.classroomRemaining, { text: 90, image: 30 });

const textResult = core.normalizeGenerationResult("text", {
  ok: true,
  request_id: "req-text-1",
  kind: "text",
  content: "# 教材草稿",
  usage: { input_tokens: 37, output_tokens: 82, total_tokens: 119 },
  remaining: { text: 2, image: 1 },
  classroom_remaining: { text: 89, image: 30 }
});
assert.equal(textResult.content, "# 教材草稿");
assert.equal(textResult.usage.totalTokens, 119);

for (const [mimeType, extension] of [["image/png", "png"], ["image/jpeg", "jpg"], ["image/webp", "webp"]]) {
  const imageResult = core.normalizeGenerationResult("image", {
    ok: true,
    request_id: `req-${extension}`,
    kind: "image",
    image: { mime_type: mimeType, data_base64: "YWJjZA==" },
    remaining: { text: 2, image: 0 },
    classroom_remaining: { text: 89, image: 29 }
  });
  const download = core.buildImageDownload(imageResult, "紅雨傘 / 候選圖");
  assert.equal(download.filename, `紅雨傘-候選圖.${extension}`);
  assert.equal(download.mimeType, mimeType);
  assert.equal(download.dataUrl, `data:${mimeType};base64,YWJjZA==`);
}

assert.throws(() => core.normalizeGenerationResult("image", {
  ok: true,
  kind: "image",
  image: { mime_type: "image/svg+xml", data_base64: "PHN2Zz4=" }
}), /格式不支援/);

const serviceError = core.normalizeApiError({
  ok: false,
  request_id: "req-error-1",
  error: { code: "IDEMPOTENCY_CONFLICT", message: "server detail", retryable: false }
}, 409);
assert.deepEqual(serviceError, {
  code: "IDEMPOTENCY_CONFLICT",
  message: "server detail",
  retryable: false,
  requestId: "req-error-1",
  httpStatus: 409
});
assert.equal(core.friendlyError(serviceError), "這筆識別碼已用於其他內容，請重新按下生成。");

let state = core.createGenerationState("text");
state = core.transitionGeneration(state, { type: "start", idempotencyKey: textKey, request: textPayload });
assert.equal(state.phase, "loading");
state = core.transitionGeneration(state, { type: "failure", error: { retryable: true } });
assert.equal(state.phase, "retryable");
const retried = core.transitionGeneration(state, { type: "retry" });
assert.equal(retried.phase, "loading");
assert.equal(retried.idempotencyKey, textKey, "retry must preserve the original idempotency key");
assert.equal(retried.request, textPayload, "retry must preserve the original request body");

for (const endpoint of ["/session", "/session/claim", "/session/logout"]) {
  assert(app.includes(`"${endpoint}"`), `app does not call ${endpoint}`);
}
assert.match(app, /\/api\/classroom-ai\/generate\/book-page/, "book pages must use the authenticated same-origin reference-image route");
assert.match(app, /form\.append\("reference_images", reference\.file/, "reference images are not included in page generation");
assert.match(app, /function buildPlanRequest\(\)/, "AI storyboard request is missing");
assert.match(app, /function plannedPageCount\(\)/, "page-count planning helper is missing");
assert.match(app, /\[4, 5, 6\]\.includes\(value\)/, "storyboard page count must be constrained to 4-6 pages");
assert.match(app, /格式為 \{"pages":\[\$\{pageCount\}個物件\]\}/, "storyboard prompt must request the chosen page count");
assert.match(app, /comic: "漫畫：每頁使用 2～4 格/, "comic selection must instruct the storyboard AI to use panels");
assert.match(app, /"class-poster": "班級海報：把每一頁當成一張不同構圖候選海報/, "class poster selection must use poster candidate planning");
assert.match(app, /"event-poster": "活動海報：把每一頁當成一張不同構圖候選海報/, "event poster selection must use poster candidate planning");
assert.match(app, /bookFormat === "comic"[^\n]+layout = "two-panels"/, "comic plans must not silently fall back to a single illustration");
assert.match(app, /\["class-poster", "event-poster"\]\.includes\(bookFormat\)[^\n]+layout = "single"/, "poster plans should stay single-composition candidates");
assert.match(app, /這是漫畫頁：分格邊界與閱讀順序要清楚/, "comic page generation prompt needs panel-flow guidance");
assert.match(app, /這是海報候選圖：以一個清楚主視覺呈現活動或班級氛圍/, "poster generation prompt needs poster-specific guidance");
assert.match(app, /\/generate\/text/, "app must route text generation through the service contract");
assert.match(app, /performTextGeneration\(false\)/, "text generator submit is not wired");
assert.match(app, /async function generatePage\(pageNo\)/, "per-page image generator is not wired");
assert.match(app, /setTimeout\(\(\) => controller\.abort\(\), 180000\)/, "image generation needs a bounded client timeout");
assert.match(app, /function reportMeaningfulValidity\(container, messageTarget\)/, "required text fields must reject whitespace-only values without browser scrolling");
assert.match(app, /function setStudioStep\(step\)/, "fixed workbench step switching is not wired");
assert.match(app, /if \(activeStudioStep < 3\)[\s\S]*?setStudioStep\(activeStudioStep \+ 1\)/, "pressing Enter in setup must advance one stage instead of skipping ahead");
assert.match(app, /function renderBookPageTabs\(\)/, "storyboard page tabs are not rendered");
assert.match(app, /function setActiveBookPage\(pageNo\)/, "single-page storyboard switching is not wired");
assert.match(app, /bookSetupForm\.hidden = targetStep >= 4/, "setup form must leave the stage when the storyboard panel opens");
assert.match(app, /card\.hidden = Number\(card\.dataset\.pageNo\) !== selectedPageNumber/, "inactive storyboard pages must not stack vertically");
assert.match(app, /focus\(\{ preventScroll: true \}\)/, "focus changes must not move the outer page");
assert.doesNotMatch(app, /\b(?:scrollIntoView|scrollTo)\s*\(/, "practice steps must not force the outer page to scroll");
assert.match(app, /type: "retry"/, "retry state is not wired");
assert.match(app, /clickDownload\(spec\.dataUrl, spec\.filename, false\)/, "image download must preserve the returned media format");
assert.match(app, /page\.attempts >= 3/, "each page needs a three-attempt stop rule");
assert.match(app, /culture-mode[^\n]+verified-traditional[\s\S]*?culture-reviewed/, "traditional cultural images must be gated by human review");
assert.doesNotMatch(app, /localStorage|sessionStorage|indexedDB/i, "classroom credentials must not be persisted in browser storage");
assert.doesNotMatch(app, /innerHTML|insertAdjacentHTML|document\.write/i, "untrusted output must not be inserted as HTML");
assert.doesNotMatch(app, /\.style\.[a-z]/i, "strict CSP should not depend on inline style mutations");
assert.match(styles, /\.clipboard-helper\s*{[\s\S]*?position:\s*fixed/, "clipboard fallback helper style is missing");

assert.match(styles, /@media \(max-width: 920px\)[\s\S]*?\.tool-layout\s*{\s*grid-template-columns:\s*1fr/, "practice workspace must collapse before tablet width");
assert.match(styles, /@media \(max-width: 620px\)[\s\S]*?\.shell\s*{\s*width:\s*min\(100% - 24px, 1180px\)/, "390px shell must remain inside the viewport");
assert.match(styles, /@media \(max-width: 620px\)[\s\S]*?\.form-row\s*{\s*grid-template-columns:\s*1fr/, "mobile form rows must be single-column");
assert.match(styles, /min-width:\s*320px/, "practice page should support narrow mobile viewports");
assert.match(styles, /\.studio-workbench\s*{[\s\S]*?grid-template-columns:\s*\d+px minmax\(0, 1fr\) \d+px[\s\S]*?height:\s*min\([^;]*100dvh/, "desktop practice must use a viewport-stable three-column workbench");
assert.match(styles, /\.studio-stage\s*{[\s\S]*?overflow-y:\s*auto/, "the middle task panel must own its desktop scrolling");
assert.match(styles, /\.studio-workbench\s*{[\s\S]*?overflow-anchor:\s*none;/, "panel changes must not trigger browser scroll anchoring");
assert.match(styles, /\.studio-preview-media img[\s\S]*?aspect-ratio:\s*2 \/ 3/, "fixed book page preview must match the 1024x1536 API ratio");
assert.match(styles, /@media \(max-width: 920px\)[\s\S]*?\.studio-workbench\s*{[\s\S]*?grid-template-columns:\s*1fr;[\s\S]*?height:\s*auto/, "practice workbench must return to natural single-column flow on tablets");
assert.match(styles, /@media \(max-width: 920px\)[\s\S]*?\.studio-step-rail,[\s\S]*?position:\s*static;[\s\S]*?overflow:\s*visible/, "mobile workbench rails must not create a fixed or nested viewport");
assert.match(styles, /@media \(max-width: 620px\)[\s\S]*?\.book-form-grid,[\s\S]*?grid-template-columns:\s*1fr/, "book setup must be single-column on phones");
assert.doesNotMatch(styles, /min-width:\s*(?:4\d\d|[5-9]\d\d|\d{4,})px/, "practice CSS contains a fixed minimum width wider than 390px");

assert.doesNotMatch(combinedStudentSource, /[—–]/, "practice page must use regular hyphens");
assert.doesNotMatch(combinedStudentSource, /\b(?:secret|upstream|model)\b/i, "practice source exposes infrastructure vocabulary");
assert.doesNotMatch(combinedStudentSource, /(?:api[_-]?key|sk-[a-z0-9]|bearer\s+[a-z0-9._-]{8,})/i, "practice source resembles a credential");
assert.doesNotMatch(combinedStudentSource, /https?:\/\//i, "practice page should not contact an external origin");

console.log("Taipei AI practice tests passed: same-origin contract, session flow, 4-6 page book studio, idempotent retry, error states, media downloads, safety and 390px layout.");
