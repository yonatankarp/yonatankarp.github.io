#!/usr/bin/env node

// Checks the CV PDF that scripts/generate-cv-pdf.js printed from /cv/ stays within two A4 pages.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const pdfPath = path.join(path.resolve(__dirname, ".."), "public", "yonatan-karp-rudin-cv.pdf");
const maxPages = 2;

function fail(message, details = []) {
  console.error(message);
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  process.exit(1);
}

if (!fs.existsSync(pdfPath)) {
  fail("CV print check requires public/yonatan-karp-rudin-cv.pdf.", ["Run npm run build, then npm run pdf."]);
}

let output;
try {
  output = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
} catch (error) {
  fail("CV print check requires pdfinfo to be available on PATH.", [error.message]);
}
const match = output.match(/^Pages:\s+(\d+)/m);
if (!match) {
  fail("CV print check could not read the generated PDF page count.", [output.trim()]);
}
const pageCount = Number(match[1]);
if (pageCount > maxPages) {
  fail(`CV print check failed: expected at most ${maxPages} A4 pages, got ${pageCount}.`);
}
console.log(`CV print check passed: ${pageCount} A4 pages (limit ${maxPages}).`);
