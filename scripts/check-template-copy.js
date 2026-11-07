#!/usr/bin/env node

// Keeps the site's words out of its templates (CONTENT.md): fails when a file in layouts/ has visible prose outside
// {{ }}, in a text node or an alt, aria-label, title or placeholder attribute, or in a <meta> title, description or
// alt. Prose is a run of two letters or more, so arrows, "·", punctuation, entities and the tower's one-character floor
// badges (R, L, 1, and the 404) pass. Words inside {{ }} are not checked: put them in data/ too.

const fs = require("fs");
const path = require("path");
const { rootDir } = require("./lib");

const layoutsDir = path.join(rootDir, "layouts");
const allowed = new Set(["Hugo"]);   // the feed's <generator>, a name the feed readers read, not copy
const blank = (s) => s.replace(/[^\n]/g, " ");   // keeps the newlines, so the line numbers still hold

function isProse(text) {
  const words = text.replace(/&[#\w]+;/g, " ").trim();
  return /\p{L}{2,}/u.test(words) && !allowed.has(words);
}

// [{ line, text }] for each piece of prose in one template's source.
function findCopy(source) {
  const found = [];
  const lineAt = (s, i) => s.slice(0, i).split("\n").length;
  let src = source
    .replace(/\{\{-?\s*\/\*[\s\S]*?\*\/\s*-?\}\}/g, blank)
    .replace(/\{\{[\s\S]*?\}\}/g, blank)
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/<(script|style|svg)\b[\s\S]*?<\/\1>/gi, blank);
  for (const tag of src.matchAll(/<[a-zA-Z][^>]*>/g)) {
    const meta = /^<meta\b/i.test(tag[0]) && /\b(?:name|property)="[^"]*(?:title|description|alt)"/.test(tag[0]);
    for (const attr of tag[0].matchAll(/\s(alt|aria-label|title|placeholder|content)="([^"]*)"/g)) {
      if ((attr[1] !== "content" || meta) && isProse(attr[2])) {
        found.push({ line: lineAt(src, tag.index), text: `${attr[1]}="${attr[2].replace(/\s+/g, " ").trim()}"` });
      }
    }
  }
  src = src.replace(/<[^>]*>/g, blank);
  src.split("\n").forEach((text, i) => { if (isProse(text)) found.push({ line: i + 1, text: text.trim() }); });
  return found.sort((a, b) => a.line - b.line);
}

function templates(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? templates(file) : /\.(html|xml|txt|json)$/.test(entry.name) ? [file] : [];
  });
}

if (require.main === module) {
  const failures = templates(layoutsDir).flatMap((file) =>
    findCopy(fs.readFileSync(file, "utf8")).map(({ line, text }) => `${path.relative(rootDir, file)}:${line}: ${text}`));
  if (failures.length) {
    console.error("Template copy check failed: move these words into data/ (CONTENT.md says where).");
    for (const failure of failures) console.error(`  ${failure}`);
    process.exitCode = 1;
  } else {
    console.log("Template copy check passed: no words in layouts/ outside {{ }}.");
  }
}

module.exports = { findCopy };
