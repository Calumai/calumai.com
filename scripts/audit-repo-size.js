const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const root = path.resolve(__dirname, "..");
const ignoredDirectories = new Set([".git", "node_modules", ".preview"]);
const jsonMode = process.argv.includes("--json");
const limitArg = process.argv.find((arg) => arg.startsWith("--limit="));
const limit = Math.max(1, Number(limitArg && limitArg.split("=")[1]) || 25);

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) return [];
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function sha256(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function mib(bytes) {
  return Number((bytes / 1024 / 1024).toFixed(2));
}

const files = walk(root).map((absolutePath) => {
  const relativePath = path.relative(root, absolutePath).replaceAll(path.sep, "/");
  const size = fs.statSync(absolutePath).size;
  return {
    path: relativePath,
    size,
    sha256: sha256(absolutePath)
  };
});

const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
const byTopLevel = new Map();
for (const file of files) {
  const topLevel = file.path.includes("/") ? file.path.split("/")[0] : "(root)";
  const current = byTopLevel.get(topLevel) || { files: 0, bytes: 0 };
  current.files += 1;
  current.bytes += file.size;
  byTopLevel.set(topLevel, current);
}

const byHash = new Map();
for (const file of files) {
  const group = byHash.get(file.sha256) || [];
  group.push(file);
  byHash.set(file.sha256, group);
}

const duplicateGroups = [...byHash.values()]
  .filter((group) => group.length > 1)
  .map((group) => ({
    size: group[0].size,
    count: group.length,
    wastedBytes: group[0].size * (group.length - 1),
    paths: group.map((file) => file.path).sort()
  }))
  .sort((a, b) => b.wastedBytes - a.wastedBytes);

const duplicateWasteBytes = duplicateGroups.reduce((sum, group) => sum + group.wastedBytes, 0);
const largestFiles = [...files]
  .sort((a, b) => b.size - a.size)
  .slice(0, limit)
  .map((file) => ({ path: file.path, MiB: mib(file.size) }));

const topLevel = [...byTopLevel.entries()]
  .map(([name, value]) => ({
    name,
    files: value.files,
    MiB: mib(value.bytes)
  }))
  .sort((a, b) => b.MiB - a.MiB);

const report = {
  generatedAt: new Date().toISOString(),
  fileCount: files.length,
  totalMiB: mib(totalBytes),
  exactDuplicateWasteMiB: mib(duplicateWasteBytes),
  topLevel,
  largestFiles,
  duplicateGroups: duplicateGroups.slice(0, limit).map((group) => ({
    MiB: mib(group.size),
    copies: group.count,
    wastedMiB: mib(group.wastedBytes),
    paths: group.paths
  }))
};

if (jsonMode) {
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  process.exit(0);
}

console.log("CALUMAI repository asset audit");
console.log("Files: " + report.fileCount);
console.log("Working-tree size: " + report.totalMiB + " MiB");
console.log("Exact duplicate waste: " + report.exactDuplicateWasteMiB + " MiB");
console.log("");

console.log("Top-level folders:");
for (const item of report.topLevel) {
  console.log("  " + item.name.padEnd(16) + String(item.MiB).padStart(8) + " MiB  (" + item.files + " files)");
}
console.log("");

console.log("Largest files:");
for (const item of report.largestFiles) {
  console.log("  " + String(item.MiB).padStart(8) + " MiB  " + item.path);
}
console.log("");

console.log("Largest exact-duplicate groups:");
for (const group of report.duplicateGroups) {
  console.log("  " + String(group.wastedMiB).padStart(8) + " MiB recoverable across " + group.copies + " copies");
  for (const filePath of group.paths) console.log("    - " + filePath);
}
