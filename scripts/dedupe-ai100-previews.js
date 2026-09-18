const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const previewRoot = path.join(root, "admin", "previews", "ai100");
const apply = process.argv.includes("--apply");
const check = process.argv.includes("--check");

function sha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function filesUnder(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? filesUnder(target) : [target];
  });
}

function removeEmptyDirectories(directory) {
  if (!fs.existsSync(directory)) return;
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    removeEmptyDirectories(path.join(directory, entry.name));
  }
  if (directory !== previewRoot && fs.readdirSync(directory).length === 0) {
    fs.rmdirSync(directory);
  }
}

function canonicalFor(previewFile) {
  const relative = path.relative(previewRoot, previewFile).replaceAll(path.sep, "/");
  const coverMatch = relative.match(/^([^/]+)\/covers\/(.+)$/);
  if (coverMatch) return path.join(root, "ai-helper", "covers", coverMatch[2]);

  const assetMatch = relative.match(/^([^/]+)\/assets\/(.+)$/);
  if (assetMatch) return path.join(root, "ai-helper", "handouts", "assets", assetMatch[2]);

  return null;
}

const changes = [];
let reclaimBytes = 0;

if (!fs.existsSync(previewRoot)) {
  console.log("No AI-100 preview directory found.");
  process.exit(0);
}

for (const entry of fs.readdirSync(previewRoot, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const id = entry.name;
  const episodeDir = path.join(previewRoot, id);
  const indexPath = path.join(episodeDir, "index.html");

  if (fs.existsSync(indexPath)) {
    const before = fs.readFileSync(indexPath, "utf8");
    const after = before
      .replaceAll(`covers/${id}`, `/ai-helper/covers/${id}`)
      .replaceAll(`assets/${id}/`, `/ai-helper/handouts/assets/${id}/`)
      .replaceAll("../../assets/calumai-logo-mark.png", "/assets/calumai-logo-mark.png");

    if (after !== before) {
      changes.push({ type: "rewrite", path: path.relative(root, indexPath) });
      if (apply) fs.writeFileSync(indexPath, after);
    }
  }

  for (const previewFile of filesUnder(episodeDir)) {
    if (!previewFile.includes(`${path.sep}covers${path.sep}`) &&
        !previewFile.includes(`${path.sep}assets${path.sep}`)) continue;

    const canonical = canonicalFor(previewFile);
    if (!canonical || !fs.existsSync(canonical)) {
      throw new Error(`No canonical AI-100 asset for ${path.relative(root, previewFile)}`);
    }

    if (sha256(previewFile) !== sha256(canonical)) {
      throw new Error(`Preview asset differs from canonical asset: ${path.relative(root, previewFile)}`);
    }

    const size = fs.statSync(previewFile).size;
    reclaimBytes += size;
    changes.push({
      type: "delete-exact-duplicate",
      path: path.relative(root, previewFile),
      canonical: path.relative(root, canonical),
      bytes: size
    });

    if (apply) fs.unlinkSync(previewFile);
  }
}

if (apply) removeEmptyDirectories(previewRoot);

const reclaimMiB = (reclaimBytes / 1024 / 1024).toFixed(1);
console.log(`AI-100 preview dedupe: ${changes.length} change(s), ${reclaimMiB} MiB exact duplicates reclaimable.`);

for (const change of changes) {
  if (change.type === "rewrite") {
    console.log(`  rewrite  ${change.path}`);
  } else {
    console.log(`  delete   ${change.path} -> ${change.canonical}`);
  }
}

if (!apply && changes.length) {
  console.log("");
  console.log("Dry run only. Re-run with --apply to rewrite paths and delete verified duplicates.");
}

if (check && changes.length) process.exitCode = 1;
