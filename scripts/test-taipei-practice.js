const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const route = path.join(root, "class", "taipei-ai", "2026-0904-picture-book");
const practice = path.join(route, "practice");

function read(relative) {
  return fs.readFileSync(path.join(practice, relative), "utf8");
}

function sourceBlock(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(start, -1, `missing source marker: ${startMarker}`);
  assert.notEqual(end, -1, `missing source marker: ${endMarker}`);
  return source.slice(start, end);
}

for (const file of ["index.html", "styles.css", "core.js", "app.js"]) {
  assert(fs.existsSync(path.join(practice, file)), `missing practice/${file}`);
}

const html = read("index.html");
const styles = read("styles.css");
const app = read("app.js");
const coreSource = read("core.js");
const core = require(path.join(practice, "core.js"));
const combinedStudentSource = `${html}\n${styles}\n${app}\n${coreSource}`;

// The browser entry must stay same-origin and must not expose long-lived credentials.
assert.match(html, /<html lang="zh-Hant">/, "practice page language is missing");
assert.match(html, /Content-Security-Policy[^>]+default-src 'self'/, "practice page needs a same-origin CSP");
assert.match(html, /connect-src 'self'/, "practice page must only connect to the same origin");
assert.match(html, /<a class="skip-link" href="#main">/, "practice page needs a skip link");
const styleVersion = html.match(/styles\.css\?v=([^"']+)/);
const coreVersion = html.match(/core\.js\?v=([^"']+)/);
const appVersion = html.match(/app\.js\?v=([^"']+)/);
assert(styleVersion && coreVersion && appVersion, "practice assets need cache keys");
assert.equal(coreVersion[1], styleVersion[1], "core and stylesheet cache keys must match");
assert.equal(appVersion[1], styleVersion[1], "app and stylesheet cache keys must match");

// Classroom access and quotas remain outside the five-step exercise.
for (const id of [
  "claim-form", "class-code", "nickname", "consent", "claim-button", "claim-message",
  "workspace", "logout-button", "classroom-status-chip", "classroom-window",
  "personal-text-quota", "personal-image-quota"
]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `missing classroom control #${id}`);
}
assert.match(html, /id="workspace"[^>]+hidden/, "workspace must stay hidden before a session is claimed");
assert.match(html, /name="class_code"[^>]+maxlength="128"/, "class code contract changed");
assert.match(html, /name="nickname"[^>]+maxlength="40"/, "nickname contract changed");

// The learner path is exactly five gates, in order, with one visible panel at launch.
assert.match(html, /跟著五關完成一張圖/, "the page must explain the five-step outcome");
const stepTargets = [...html.matchAll(/data-studio-step-target="(\d+)"/g)].map((match) => Number(match[1]));
assert.deepEqual(stepTargets, [1, 2, 3, 4, 5], "the step rail must expose exactly five steps in order");
const panelSteps = [...html.matchAll(/data-studio-panel="(\d+)"/g)].map((match) => Number(match[1]));
assert.deepEqual(panelSteps, [1, 2, 3, 4, 5], "the workbench must expose exactly five panels in order");
assert.match(html, /data-studio-panel="1"(?![^>]*hidden)/, "the first step must be visible initially");
for (const step of [2, 3, 4, 5]) {
  assert.match(html, new RegExp(`data-studio-panel=["']${step}["'][^>]+hidden`), `step ${step} must start hidden`);
}
for (const label of ["選用途", "寫提示詞", "AI 回饋", "AI 修改", "生成圖片"]) {
  assert.match(html, new RegExp(`>${label}<`), `missing learner-facing step label: ${label}`);
}

// Gate 1: one product choice, not a long setup form.
assert.match(html, /id="purpose-form"/, "purpose selection form is missing");
for (const purpose of ["picture-book", "comic", "class-poster", "event-poster", "teaching-card"]) {
  assert.match(html, new RegExp(`name=["']image_purpose["'][^>]+value=["']${purpose}["']`), `missing image purpose ${purpose}`);
}

// Gate 2: beginners can start with three characters and one prompt field.
assert.match(html, /id="prompt-form"/, "prompt form is missing");
assert.match(html, /id="original-prompt"[^>]+required[^>]+minlength="3"[^>]+maxlength="4000"/, "original prompt limits must be 3-4000 characters");
assert.match(html, /輸入三個字就能開始/, "short prompt guidance is missing");
assert.match(html, /id="prompt-count"/, "original prompt character count is missing");

// Gates 3 and 4 separate genuine AI feedback from the editable AI revision.
for (const id of [
  "feedback-original-prompt", "feedback-loading", "feedback-error", "feedback-success",
  "feedback-output", "feedback-retry", "show-revised-prompt", "revised-prompt",
  "revised-count", "confirm-revised-prompt"
]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `missing prompt-assistant control #${id}`);
}
assert.match(html, /這裡只看回饋，不會改掉你的原文/, "feedback step must promise not to overwrite the original");
assert.match(html, /AI 修改版提示詞/, "the revised prompt must be visible and editable before generation");
assert.doesNotMatch(html, /id="revised-prompt"[^>]+readonly/, "the revised prompt must remain editable");

// Gate 5 shows the exact final prompt, supports retry, preview, and download.
for (const id of [
  "final-prompt-output", "generate-image-button", "image-message", "image-retry",
  "image-preview-empty", "image-loading", "image-error", "image-error-message",
  "image-error-reference", "image-success", "generated-image", "download-image"
]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `missing image-result control #${id}`);
}
assert.match(html, /用 AI 修改版生成圖片/, "generation step must explicitly use the revised prompt");

// Removed multi-page and alternate-tool flows must not leak back into the simple studio.
for (const removedId of [
  "tool-tabs", "text-panel", "text-form", "book-setup-form", "book-page-count",
  "book-reference-input", "culture-mode", "book-visual-style", "create-book-plan",
  "book-plan-workspace", "book-page-tabs", "generate-next-page", "download-book-plan",
  "print-book", "book-page-template", "book-print-area"
]) {
  assert.doesNotMatch(html, new RegExp(`id=["']${removedId}["']`), `obsolete complex control #${removedId} remains`);
}
assert.doesNotMatch(html, /4-6 頁|逐頁生圖|建立分鏡/, "obsolete multi-page copy remains in the practice flow");

// Core request/session helpers retain the authenticated same-origin contract.
assert.equal(core.SERVICE_BASE, "/api/classroom-ai", "classroom service base must remain same-origin");
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
  topic: "  圖片提示詞檢視  ",
  audience: " AI 繪圖初學教師 ",
  duration_minutes: "5",
  objective: " 提供回饋與修改版 ",
  source_notes: " 龜兔賽跑 ",
  requirements: " 只回傳 JSON "
}, textKey);
assert.deepEqual(textPayload, {
  idempotency_key: textKey,
  topic: "圖片提示詞檢視",
  audience: "AI 繪圖初學教師",
  duration_minutes: 5,
  objective: "提供回饋與修改版",
  source_notes: "龜兔賽跑",
  requirements: "只回傳 JSON"
});

for (const [pathname, method, body] of [
  ["/session", "GET", undefined],
  ["/session/claim", "POST", { class_code: "A", nickname: "B", consent: true }],
  ["/session/logout", "POST", {}],
  ["/generate/text", "POST", textPayload]
]) {
  const request = core.createRequest(pathname, method, body);
  assert.equal(request.url, `/api/classroom-ai${pathname}`);
  assert.equal(request.options.method, method);
  assert.equal(request.options.credentials, "include");
  assert.equal(request.options.headers.Accept, "application/json");
  if (body !== undefined) {
    assert.equal(request.options.headers["Content-Type"], "application/json");
    assert.deepEqual(JSON.parse(request.options.body), body);
  }
}

const session = core.normalizeSession({
  ok: true,
  session: { nickname: "小晴", mode: "production", expires_at: "2026-09-04T14:00:00Z" },
  classroom: { status: "open", opens_at: "2026-09-04T11:00:00Z", closes_at: "2026-09-04T14:00:00Z" },
  remaining: { text: 2, image: 1 },
  classroom_remaining: { text: 90, image: 30 }
});
assert.equal(session.nickname, "小晴");
assert.equal(session.classroom.status, "open");
assert.deepEqual(session.remaining, { text: 2, image: 1 });

// The prompt assistant accepts clean or fenced JSON and rejects incomplete AI output.
assert.deepEqual(core.parsePromptAssistantResult(JSON.stringify({
  feedback: "  主體清楚，可以補上場景。  ",
  revised_prompt: "  龜兔在森林跑道上比賽  "
})), {
  feedback: "主體清楚，可以補上場景。",
  revisedPrompt: "龜兔在森林跑道上比賽"
});
assert.deepEqual(core.parsePromptAssistantResult('```json\n{"feedback":"補上動作","revised_prompt":"兔子快速奔跑"}\n```'), {
  feedback: "補上動作",
  revisedPrompt: "兔子快速奔跑"
});
assert.throws(() => core.parsePromptAssistantResult('{"feedback":"只有回饋"}'), /格式不完整/);
assert.throws(() => core.parsePromptAssistantResult('{"feedback":"太短","revised_prompt":"哈"}'), /格式不完整/);
assert.equal(
  core.friendlyError({ code: "INVALID_PROMPT" }),
  "圖片描述至少寫 3 個字，最多 4000 個字即可。"
);
assert.equal(
  core.friendlyError({ code: "AI_RESPONSE_INVALID" }),
  "AI 這次沒有產生可用的建議，請再試一次。"
);
assert.equal(
  core.friendlyError({ code: "UNAUTHENTICATED" }),
  "請先輸入課堂碼，進入練習室。"
);
assert.equal(
  core.friendlyError({ code: "REFERENCE_IMAGE_REQUIRED" }),
  "目前的練習設定有問題，請通知老師。"
);
assert.equal(
  core.friendlyError({ code: "UNMAPPED_FAILURE", message: "upstream secret detail" }),
  "目前無法完成這項操作，請稍後再試。",
  "unknown upstream details must not be shown to learners"
);

// Generation normalisation and download support both base64 and URL responses.
const imageResult = core.normalizeGenerationResult("image", {
  ok: true,
  request_id: "req-image-1",
  kind: "image",
  image: { mime_type: "image/png", data_base64: "YWJjZA==" },
  remaining: { text: 1, image: 0 },
  classroom_remaining: { text: 89, image: 29 }
});
const imageDownload = core.buildImageDownload(imageResult, "活動海報 / 候選圖");
assert.equal(imageDownload.filename, "活動海報-候選圖.png");
assert.equal(imageDownload.dataUrl, "data:image/png;base64,YWJjZA==");
const urlResult = core.normalizeGenerationResult("image", {
  ok: true,
  request_id: "req-image-2",
  kind: "image",
  image: { mime_type: "image/webp", src: "https://example.invalid/result.webp" },
  remaining: { text: 1, image: 0 },
  classroom_remaining: { text: 89, image: 29 }
});
assert.equal(core.buildImageDownload(urlResult, "圖片").dataUrl, "https://example.invalid/result.webp");

// Retrying preserves the original request rather than charging for a new logical request.
let retryState = core.createGenerationState("text");
retryState = core.transitionGeneration(retryState, { type: "start", idempotencyKey: textKey, request: textPayload });
retryState = core.transitionGeneration(retryState, { type: "failure", error: { retryable: true } });
const retried = core.transitionGeneration(retryState, { type: "retry" });
assert.equal(retried.idempotencyKey, textKey);
assert.equal(retried.request, textPayload);

// Behavioural wiring: review returns both fields, but the UI reveals feedback and revision in separate gates.
const assistantRequestBlock = sourceBlock(app, "function buildAssistantRequest", "async function performPromptReview");
assert.match(assistantRequestBlock, /feedback[\s\S]*?revised_prompt/, "prompt assistant must request feedback and a revision together");
assert.match(assistantRequestBlock, /buildTextPayload\(/, "prompt assistant must use the authenticated text payload contract");
assert.match(app, /callJsonService\([\s\S]*?["']\/generate\/text["']/, "prompt assistant must use the authenticated text service");
assert.match(app, /parsePromptAssistantResult\(/, "AI feedback must be parsed from the service response");
assert.match(app, /feedback-output[\s\S]*?\.feedback/, "gate 3 must render the AI feedback");
assert.match(app, /revised-prompt[\s\S]*?\.revisedPrompt/, "gate 4 must receive the AI revised prompt");
assert.match(app, /original-prompt[\s\S]*?resetAssistantAndImage\(\)/, "editing the original prompt must invalidate stale AI results");

// Behavioural wiring: the image request can only be derived from the revised prompt.
const imageGenerationBlock = sourceBlock(app, "async function performImageGeneration", "function clickDownload");
assert.match(imageGenerationBlock, /\.revisedPrompt/, "image generation must read the revised prompt");
assert.doesNotMatch(imageGenerationBlock, /\.originalPrompt/, "image generation must not fall back to the original prompt");
assert.match(imageGenerationBlock, /callImageService\(/, "the revised prompt must be sent to the image service");
assert.match(imageGenerationBlock, /type:\s*["']retry["']/, "image retry must preserve the previous logical request");

const imageServiceBlock = sourceBlock(app, "async function callImageService", "function formatDateTime");
assert.match(imageServiceBlock, /fetch\(["']\/api\/generate-image["']/, "images must use the server-side relay route");
assert.match(imageServiceBlock, /credentials:\s*["']include["']/, "image requests must include the classroom session cookie");
assert.match(imageServiceBlock, /["']Content-Type["']:\s*["']application\/json["']/, "image requests must send JSON");
assert.match(imageServiceBlock, /body:\s*JSON\.stringify\(\{\s*prompt:/, "image request body must contain only the final prompt");
assert.match(imageServiceBlock, /setTimeout\(\(\)\s*=>\s*controller\.abort\(\),\s*180000\)/, "image requests need the 180-second timeout");

for (const endpoint of ["/session", "/session/claim", "/session/logout"]) {
  assert(app.includes(`"${endpoint}"`), `app does not call ${endpoint}`);
}
assert.match(app, /highestStep\s*=\s*Math\.max\(highestStep,\s*2\)/, "purpose selection must unlock gate 2");
assert.match(app, /highestStep\s*=\s*Math\.max\(highestStep,\s*3\)/, "submitting the original prompt must unlock gate 3");
assert.match(app, /highestStep\s*=\s*Math\.max\(highestStep,\s*4\)/, "successful AI feedback must unlock gate 4");
assert.match(app, /highestStep\s*=\s*5[\s\S]*?setStudioStep\(5\)/, "confirming the revised prompt must unlock gate 5");
assert.match(app, /buildImageDownload\(/, "successful images must remain downloadable");

// Learner-facing copy must match the five-gate classroom flow on every viewport.
assert.match(html, /剩餘 AI 建議次數/, "text quota label must say what the number means");
assert.match(html, /剩餘圖片生成次數/, "image quota label must say what the number means");
assert.match(html, /AI 產出先當草稿/, "AI output must be presented as a draft");
assert.match(html, /扣掉 1 次圖片生成次數/, "the image action must explain its quota cost");
assert.match(html, /請 AI 給修改建議/, "the prompt-review button must name its result");
assert.match(app, /錯誤代碼：/, "error details must keep a plain-language code label");
assert.match(app, /查詢編號：/, "error details must keep a plain-language request ID label");
assert.match(app, /HTTP 狀態碼：/, "error details must keep a plain-language HTTP label");
assert.match(app, /結束時間請以老師公告為準/, "a missing classroom end time needs a useful fallback");
assert.doesNotMatch(`${html}\n${app}`, /課堂碼登入|重新登入|工作階段|右側預覽/, "learner copy contains account, system-session, or desktop-only wording");
assert.doesNotMatch(coreSource, /請先上傳至少一張有權使用的參考圖|參考圖只接受 PNG|參考圖總量太大/, "obsolete reference-image instructions must not point to a missing field");

// Client-side safety invariants.
assert.doesNotMatch(app, /localStorage|sessionStorage|indexedDB/i, "classroom credentials must not be stored in browser storage");
assert.doesNotMatch(app, /innerHTML|insertAdjacentHTML|document\.write/i, "untrusted AI output must not be inserted as HTML");
assert.doesNotMatch(app, /\b(?:scrollIntoView|scrollTo)\s*\(/, "step changes must not move the outer page");
assert.doesNotMatch(combinedStudentSource, /OPENAI_API_KEY|VECTORENGINE_API_KEY|Bearer\s+[A-Za-z0-9._-]{8,}/i, "student source resembles a credential");
assert.doesNotMatch(combinedStudentSource, /https?:\/\/(?!example\.invalid)/i, "student page must not contain an external service URL");

// Shared visual system and responsive structure remain testable without fixing implementation details.
assert.match(styles, /--ink:\s*#[0-9a-f]{6}/i, "practice page needs a shared ink token");
assert.match(styles, /--paper:\s*#[0-9a-f]{6}/i, "practice page needs a shared paper token");
assert.match(styles, /--white:\s*#[0-9a-f]{6}/i, "practice page needs a shared surface token");
assert.match(styles, /\.studio-workbench\s*\{/, "five-step workbench styles are missing");
assert.match(styles, /\.studio-stage\s*\{[\s\S]*?overflow-y:\s*auto/, "desktop task panel must own its scrolling");
assert.match(styles, /@media \(max-width:[^)]+\)[\s\S]*?\.studio-workbench\s*\{[\s\S]*?grid-template-columns:\s*1fr/, "workbench must collapse to one column on tablets");
assert.match(styles, /@media \(max-width:\s*620px\)/, "phone breakpoint is missing");
assert.match(styles, /min-width:\s*320px/, "practice page should support narrow mobile viewports");
assert.doesNotMatch(styles, /min-width:\s*(?:4\d\d|[5-9]\d\d|\d{4,})px/, "practice CSS contains a fixed minimum width wider than 390px");

console.log("Taipei AI practice tests passed: classroom session, exact five-gate prompt flow, real AI feedback and revision, revised-prompt-only image request, retry, download, safety and responsive structure.");
