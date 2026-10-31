#!/usr/bin/env node

// Checks the CV PDF that scripts/generate-cv-pdf.js printed from /cv/ fits on one A4 page.
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const pdfPath = path.join(path.resolve(__dirname, ".."), "public", "yonatan-karp-rudin-cv.pdf");
const maxPages = 1;

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

// The PDF is printed from a local server, so a relative link keeps that origin and is dead for anyone reading it (#113).
let urls;
try {
  urls = execFileSync("pdfinfo", ["-url", pdfPath], { encoding: "utf8" });
} catch (error) {
  fail("CV print check could not list the generated PDF's links.", [error.message]);
}
const localLinks = urls.split("\n").filter((line) => /:\/\/(?:127\.|localhost\b|\[::1\])/i.test(line));
if (localLinks.length > 0) {
  fail("CV print check failed: the PDF links to the local server it was printed from. Use absURL in layouts/_default/cv.html.", localLinks.map((line) => line.trim()));
}
console.log(`CV print check passed: ${pageCount} A4 pages (limit ${maxPages}), no local links.`);
