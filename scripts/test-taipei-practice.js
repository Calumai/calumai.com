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
assert.match(html, /styles\.css\?v=20260903e/, "practice stylesheet cache key is stale");
assert.match(html, /app\.js\?v=20260903o/, "practice app cache key is stale");
assert.match(html, /<a class="skip-link" href="#main">/, "practice page needs a skip link");
assert.match(html, /id="claim-form"/, "practice page needs a classroom claim form");
assert.match(html, /id="workspace"[^>]+hidden/, "workspace must stay hidden before a session is claimed");
assert.match(html, /role="tablist"/, "generator switcher must expose tab semantics");
assert.match(html, /id="text-panel" role="tabpanel"/, "text generator tab panel is missing");
assert.match(html, /id="image-panel" role="tabpanel"/, "image generator tab panel is missing");
for (const promptField of ["image-purpose", "image-prompt", "image-prompt-count", "review-prompt-button", "reviewed-prompt", "use-reviewed-prompt", "keep-original-prompt"]) {
  assert.match(html, new RegExp(`(?:id|class)=['\"][^'\"]*${promptField}[^'\"]*['\"]`), `canonical prompt control ${promptField} is missing`);
}
assert.doesNotMatch(html, /id="prompt-template"|id="prompt-preview"|id="image-scene"/, "the public page must not expose parallel prompt flows");
assert.match(html, /name="prompt"[^>]+minlength="3"[^>]+maxlength="4000"/, "canonical image prompt bounds are missing");
assert.match(html, /id="text-feedback"[^>]+aria-live="polite"/, "text feedback must be announced");
assert.match(html, /id="image-feedback"[^>]+aria-live="polite"/, "image feedback must be announced");

for (const fieldName of ["class_code", "nickname", "topic", "audience", "duration_minutes", "objective", "source_notes", "requirements", "purpose", "prompt"]) {
  assert.match(html, new RegExp(`name=["']${fieldName}["']`), `missing form field ${fieldName}`);
}
for (const requiredField of ["text-source-notes", "text-requirements", "image-prompt"]) {
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
  requirements: 3000,
  prompt: 4000
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
assert.match(app, /\/api\/generate-image/, "app must route image generation through the RelayRouter proxy");
assert.match(app, /return \{ prompt \};/, "image generation must send one canonical prompt field");
assert.match(app, /core\.buildTextPayload\([\s\S]*?core\.createIdempotencyKey\("text", makeUuid\(\)\)/, "AI review must use the authenticated text-generation contract");
assert.match(app, /\/generate\/text/, "app must route text generation through the service contract");
assert.match(app, /performGeneration\("text", false\)/, "text generator submit is not wired");
assert.match(app, /performGeneration\("image", false\)/, "image generator submit is not wired");
assert.match(app, /kind === "image" \? 180000 : 120000/, "generation requests need bounded client timeouts");
assert.match(app, /function reportMeaningfulValidity\(form\)/, "required text fields must reject whitespace-only values before submission");
assert.match(app, /type: "retry"/, "retry state is not wired");
assert.match(app, /clickDownload\(spec\.dataUrl, spec\.filename, false\)/, "image download must preserve the returned media format");
assert.doesNotMatch(app, /localStorage|sessionStorage|indexedDB/i, "classroom credentials must not be persisted in browser storage");
assert.doesNotMatch(app, /innerHTML|insertAdjacentHTML|document\.write/i, "untrusted output must not be inserted as HTML");
assert.doesNotMatch(app, /\.style\.[a-z]/i, "strict CSP should not depend on inline style mutations");
assert.match(styles, /\.clipboard-helper\s*{[\s\S]*?position:\s*fixed/, "clipboard fallback helper style is missing");

assert.match(styles, /@media \(max-width: 920px\)[\s\S]*?\.tool-layout\s*{\s*grid-template-columns:\s*1fr/, "practice workspace must collapse before tablet width");
assert.match(styles, /@media \(max-width: 620px\)[\s\S]*?\.shell\s*{\s*width:\s*min\(100% - 24px, 1180px\)/, "390px shell must remain inside the viewport");
assert.match(styles, /@media \(max-width: 620px\)[\s\S]*?\.form-row\s*{\s*grid-template-columns:\s*1fr/, "mobile form rows must be single-column");
assert.match(styles, /min-width:\s*320px/, "practice page should support narrow mobile viewports");
assert.match(styles, /\.image-success img[\s\S]*?aspect-ratio:\s*2 \/ 3/, "image preview must match the 1024x1536 API ratio");
assert.match(styles, /\.review-suggestion textarea\s*\{[^}]*width:\s*100%[^}]*box-sizing:\s*border-box/, "AI revised prompt must fill its responsive container");
assert.doesNotMatch(styles, /min-width:\s*(?:4\d\d|[5-9]\d\d|\d{4,})px/, "practice CSS contains a fixed minimum width wider than 390px");

assert.doesNotMatch(combinedStudentSource, /[—–]/, "practice page must use regular hyphens");
assert.doesNotMatch(combinedStudentSource, /\b(?:secret|upstream|model)\b/i, "practice source exposes infrastructure vocabulary");
assert.doesNotMatch(combinedStudentSource, /(?:api[_-]?key|sk-[a-z0-9]|bearer\s+[a-z0-9._-]{8,})/i, "practice source resembles a credential");
assert.doesNotMatch(combinedStudentSource, /https?:\/\//i, "practice page should not contact an external origin");

console.log("Taipei AI practice tests passed: same-origin contract, session flow, idempotent retry, error states, media downloads, safety and 390px layout.");
