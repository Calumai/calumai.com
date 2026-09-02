const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const route = path.join(root, "class", "taipei-ai", "2026-0904-picture-book");

function read(relative) {
  return fs.readFileSync(path.join(route, relative), "utf8");
}

const html = read("index.html");
const app = read("app.js");
const promptLibrary = read(path.join("materials", "docs", "prompt-library.md"));
const workbench = read(path.join("workbench", "index.html"));
const classIndex = fs.readFileSync(path.join(root, "class", "index.html"), "utf8");

for (const id of ["workflow", "schedule", "prompts", "yaml", "example", "gates", "downloads"]) {
  assert.match(html, new RegExp(`id=["']${id}["']`), `missing section #${id}`);
}

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

assert.match(workbench, /blobToDataUrl/, "workbench should embed images in downloaded HTML");
assert.match(workbench, /\.\.\/assets\/images\/page-cover\.png/, "workbench cover path is invalid");
assert.match(workbench, /href="\.\.\/"/, "workbench needs a return link");

const courseZip = path.join(route, "downloads", "taipei-0904-picture-book-course-pack.zip");
assert(fs.existsSync(courseZip), "missing downloadable course ZIP");
assert(fs.statSync(courseZip).size > 10_000_000, "course ZIP is unexpectedly small");

assert.equal((classIndex.match(/<!doctype html>/gi) || []).length, 1, "class index must contain one HTML document");
assert.equal((classIndex.match(/\/class\/taipei-ai\/2026-0904-picture-book\//g) || []).length, 2, "class index should link the route and its preview image once each");
assert.match(classIndex, /北市府四堂課 · 獨立系列/, "class index must label the course as an independent series");

console.log("Taipei 9/4 picture-book course tests passed: 20 prompts, 16 YAML files, assets, workbench, ZIP and class entry.");
