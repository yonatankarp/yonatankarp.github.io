#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const expectedOrigin = "https://yonatankarp.com";
const staleOrigin = "http://yonatankarp.com";
const routeFiles = [
  "index.html",
  "blog/index.html",
  "projects/index.html",
  "cv/index.html",
  "llms.txt",
];

function fail(message, details = []) {
  console.error(message);
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  process.exit(1);
}

function readPublicFile(relativePath) {
  const filePath = path.join(publicDir, relativePath);

  if (!fs.existsSync(filePath)) {
    fail("Generated site metadata check requires a built public/ directory.", [
      `Missing ${path.relative(rootDir, filePath)}`,
      "Run npm run build first.",
    ]);
  }

  return fs.readFileSync(filePath, "utf8");
}

function collectMetaContent(html, attributePattern) {
  const values = [];
  const tagPattern = /<(?:meta|link)\b[^>]*>/gi;

  for (const tagMatch of html.matchAll(tagPattern)) {
    const tag = tagMatch[0];

    if (!attributePattern.test(tag)) {
      continue;
    }

    const valueMatch = tag.match(/\b(?:content|href)=["']?([^"'\s>]+)/i);

    if (valueMatch) {
      values.push(valueMatch[1]);
    }
  }

  return values;
}

const failures = [];
const requiredHtmlMetadata = [
  { label: "canonical", pattern: /\brel=["']?canonical\b/i },
  { label: "og:url", pattern: /\bproperty=["']?og:url\b/i },
  { label: "og:image", pattern: /\bproperty=["']?og:image\b/i },
  { label: "twitter:image", pattern: /\bname=["']?twitter:image\b/i },
];

for (const relativePath of routeFiles) {
  const content = readPublicFile(relativePath);

  if (content.includes(staleOrigin)) {
    failures.push(`${relativePath}: contains stale ${staleOrigin} URL`);
  }

  if (relativePath.endsWith(".html")) {
    for (const metadata of requiredHtmlMetadata) {
      const values = collectMetaContent(content, metadata.pattern);

      if (values.length === 0) {
        failures.push(`${relativePath}: missing ${metadata.label} metadata`);
        continue;
      }

      for (const value of values) {
        if (!value.startsWith(expectedOrigin)) {
          failures.push(`${relativePath}: expected production ${metadata.label} URL, got ${value}`);
        }
      }
    }
  } else {
    const absoluteUrlPattern = /https?:\/\/yonatankarp\.com[^\s"'<>)]*/g;
    for (const match of content.matchAll(absoluteUrlPattern)) {
      const value = match[0];

      if (!value.startsWith(expectedOrigin)) {
        failures.push(`${relativePath}: expected production metadata URL, got ${value}`);
      }
    }
  }
}

if (failures.length > 0) {
  fail("Generated site metadata check failed:", failures);
}

console.log(`Generated site metadata uses ${expectedOrigin} across ${routeFiles.length} public files.`);
