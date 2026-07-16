const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const errors = [];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name === ".git" || entry.name === "node_modules") return [];
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

function localTarget(documentPath, reference) {
  if (
    !reference ||
    reference.startsWith("#") ||
    reference.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(reference) ||
    reference.includes("${")
  ) {
    return null;
  }

  const clean = reference.split("#")[0].split("?")[0];
  if (!clean) return path.join(root, "index.html");

  const resolved = clean.startsWith("/")
    ? path.join(root, clean.slice(1))
    : path.resolve(path.dirname(documentPath), clean);

  return clean.endsWith("/") ? path.join(resolved, "index.html") : resolved;
}

const htmlFiles = walk(root).filter((file) => file.endsWith(".html"));

for (const file of htmlFiles) {
  const source = fs.readFileSync(file, "utf8");
  const relative = path.relative(root, file);

  for (const match of source.matchAll(/<(?:a|img|link|script|source)\b[^>]*?\b(?:href|src)=["']([^"']+)["'][^>]*>/gi)) {
    const target = localTarget(file, match[1]);
    if (target && !fs.existsSync(target)) {
      errors.push(`${relative}: missing local reference ${match[1]}`);
    }
  }

  for (const match of source.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc=/i.test(match[1])) continue;
    try {
      new Function(match[2]);
    } catch (error) {
      errors.push(`${relative}: inline script syntax error: ${error.message}`);
    }
  }
}

const redesignedFiles = [
  "index.html",
  "styles.css",
  "app.js",
  "blog/index.html",
  "blog/why-small-tools.html",
];

for (const relative of redesignedFiles) {
  const source = fs.readFileSync(path.join(root, relative), "utf8");
  if (source.includes("\u2014")) {
    errors.push(`${relative}: contains an em dash`);
  }
}

if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Checked ${htmlFiles.length} HTML files: scripts and local references are valid.`);
}
