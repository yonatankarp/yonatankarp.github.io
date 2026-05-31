#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const blogDir = path.join(rootDir, "content", "blog");
const staticDir = path.join(rootDir, "static");

function walkMarkdownFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walkMarkdownFiles(fullPath));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(fullPath);
    }
  }

  return files;
}

function normalizeAssetRef(ref) {
  return ref.split(/[?#]/, 1)[0];
}

function collectBlogAssetRefs(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const refs = new Set();

  const markdownImagePattern = /!\[[^\]]*]\(\s*(["']?)(\/images\/blog\/[^"')\s]+)\1(?:\s+["'][^"']*["'])?\s*\)/g;
  const featuredImagePattern = /^\s*featured_image:\s*(["']?)(\/images\/blog\/[^"'\s]+)\1\s*$/gm;

  for (const match of content.matchAll(markdownImagePattern)) {
    refs.add(normalizeAssetRef(match[2]));
  }

  for (const match of content.matchAll(featuredImagePattern)) {
    refs.add(normalizeAssetRef(match[2]));
  }

  return refs;
}

function assetExists(ref) {
  const relativePath = ref.replace(/^\/+/, "");
  const assetPath = path.resolve(staticDir, relativePath);

  if (!assetPath.startsWith(staticDir + path.sep)) {
    return false;
  }

  return fs.existsSync(assetPath) && fs.statSync(assetPath).isFile();
}

const markdownFiles = walkMarkdownFiles(blogDir);
const missingRefs = [];

for (const filePath of markdownFiles) {
  const refs = collectBlogAssetRefs(filePath);
  const relativeFilePath = path.relative(rootDir, filePath);

  for (const ref of refs) {
    if (!assetExists(ref)) {
      missingRefs.push({ file: relativeFilePath, ref });
    }
  }
}

if (missingRefs.length > 0) {
  console.error("Missing blog asset references:");
  for (const missing of missingRefs) {
    console.error(`- ${missing.file}: ${missing.ref}`);
  }
  process.exit(1);
}

console.log(`All blog asset references exist across ${markdownFiles.length} blog markdown files.`);
