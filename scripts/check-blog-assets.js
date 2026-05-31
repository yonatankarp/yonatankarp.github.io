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

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitFrontMatter(content) {
  const normalizedContent = content.replace(/^\uFEFF/, "");
  const openerMatch = normalizedContent.match(/^(---|\+\+\+)[^\r\n]*(?:\r?\n|$)/);

  if (!openerMatch) {
    return { frontMatter: "", body: content };
  }

  const marker = openerMatch[1];
  const bodyStart = openerMatch[0].length;
  const closingPattern = new RegExp(`(?:^|\\r?\\n)${escapeRegex(marker)}\\s*(?:\\r?\\n|$)`);
  const closingMatch = normalizedContent.slice(bodyStart).match(closingPattern);

  if (!closingMatch || closingMatch.index === undefined) {
    return { frontMatter: "", body: content };
  }

  const frontMatterEnd = bodyStart + closingMatch.index;
  const bodyOffset = frontMatterEnd + closingMatch[0].length;

  return {
    frontMatter: normalizedContent.slice(bodyStart, frontMatterEnd),
    body: normalizedContent.slice(bodyOffset),
  };
}

function stripFencedCodeBlocks(markdown) {
  const lines = markdown.split(/(\r?\n)/);
  const stripped = [];
  let fenceMarker = null;
  let fenceLength = 0;

  for (let index = 0; index < lines.length; index += 2) {
    const line = lines[index];
    const newline = lines[index + 1] || "";
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/);

    if (!fenceMarker && fenceMatch) {
      fenceMarker = fenceMatch[1][0];
      fenceLength = fenceMatch[1].length;
      stripped.push(newline);
      continue;
    }

    if (fenceMarker) {
      const closingPattern = new RegExp(`^\\s*${escapeRegex(fenceMarker)}{${fenceLength},}\\s*$`);

      if (closingPattern.test(line)) {
        fenceMarker = null;
        fenceLength = 0;
      }

      stripped.push(newline);
      continue;
    }

    stripped.push(line, newline);
  }

  return stripped.join("");
}

function collectBlogAssetRefs(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const { frontMatter, body } = splitFrontMatter(content);
  const markdownBody = stripFencedCodeBlocks(body);
  const refs = new Set();

  const markdownImagePattern = /!\[[^\]]*]\(\s*(["']?)(\/images\/blog\/[^"')\s]+)\1(?:\s+["'][^"']*["'])?\s*\)/g;
  const featuredImagePattern = /^\s*featured_image\s*[:=]\s*(["']?)(\/images\/blog\/[^"'\s]+)\1\s*$/gm;

  for (const match of markdownBody.matchAll(markdownImagePattern)) {
    refs.add(normalizeAssetRef(match[2]));
  }

  for (const match of frontMatter.matchAll(featuredImagePattern)) {
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
