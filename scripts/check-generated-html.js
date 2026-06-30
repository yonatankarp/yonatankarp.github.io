#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const htmlFiles = [];
const failures = [];
const placeholderPattern = /\b(?:TODO|FIXME|Lorem ipsum|Coming soon)\b/i;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".html")) {
      htmlFiles.push(fullPath);
    }
  }
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function collectAttribute(tag, attributeName) {
  const pattern = new RegExp(`\\b${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = tag.match(pattern);

  return match ? match[1] ?? match[2] ?? match[3] ?? "" : null;
}

function isRedirectPage(html) {
  return /http-equiv=["']?refresh/i.test(html) && /rel=["']?canonical/i.test(html);
}

if (!fs.existsSync(publicDir)) {
  console.error("Generated HTML check requires a built public/ directory. Run npm run build first.");
  process.exit(1);
}

walk(publicDir);

for (const filePath of htmlFiles) {
  const html = fs.readFileSync(filePath, "utf8");
  const relativePath = path.relative(publicDir, filePath);
  const route = `/${relativePath.replace(/index\.html$/, "").replace(/404\.html$/, "404.html")}`;
  const redirectPage = isRedirectPage(html);

  if (!redirectPage && !/<h1\b/i.test(html)) {
    failures.push(`${route}: missing h1`);
  }

  for (const imageMatch of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = imageMatch[0];
    const alt = collectAttribute(tag, "alt");

    if (alt === null || stripTags(alt) === "") {
      failures.push(`${route}: image missing useful alt text: ${tag.slice(0, 160)}`);
    }
  }

  if (/\bhref=["']#["']/i.test(html)) {
    failures.push(`${route}: contains empty hash link`);
  }

  if (placeholderPattern.test(html)) {
    failures.push(`${route}: contains placeholder text`);
  }
}

if (failures.length > 0) {
  console.error("Generated HTML check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Generated HTML passed accessibility/placeholder checks across ${htmlFiles.length} files.`);
