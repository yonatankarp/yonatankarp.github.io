#!/usr/bin/env node

// Checks the CV PDF that scripts/generate-cv-pdf.js printed from /cv/: it fits on one A4 page, and no link in it points
// at the local server it was printed from. Read with pdf-lib, so the check needs no poppler.
const fs = require("fs");
const path = require("path");
const { PDFDocument, PDFDict, PDFName, PDFString, PDFHexString } = require("pdf-lib");
const { publicDir, fail } = require("./lib");

const pdfPath = path.join(publicDir, "yonatan-karp-rudin-cv.pdf");
const maxPages = 1;

// Every URI a link annotation on the page opens.
function linkUris(page) {
  const annots = page.node.Annots();
  const uris = [];

  for (let index = 0; index < (annots?.size() ?? 0); index++) {
    const annot = annots.lookup(index, PDFDict);
    const action = annot.lookup(PDFName.of("A"));
    const uri = action instanceof PDFDict ? action.lookup(PDFName.of("URI")) : null;

    if (uri instanceof PDFString || uri instanceof PDFHexString) {
      uris.push(uri.decodeText());
    }
  }

  return uris;
}

async function main() {
  if (!fs.existsSync(pdfPath)) {
    fail("CV print check requires public/yonatan-karp-rudin-cv.pdf.", ["Run npm run build, then npm run pdf."]);
  }

  const pdf = await PDFDocument.load(fs.readFileSync(pdfPath), { updateMetadata: false });
  const pageCount = pdf.getPageCount();

  if (pageCount > maxPages) {
    fail(`CV print check failed: expected at most ${maxPages} A4 pages, got ${pageCount}.`);
  }

  // The PDF is printed from a local server, so a relative link keeps that origin and is dead for anyone reading it (#113).
  const uris = pdf.getPages().flatMap(linkUris);
  const localLinks = uris.filter((uri) => /:\/\/(?:127\.|localhost\b|\[::1\])/i.test(uri));

  if (localLinks.length > 0) {
    fail("CV print check failed: the PDF links to the local server it was printed from. Use absURL in layouts/_default/cv.html.", localLinks);
  }
  console.log(`CV print check passed: ${pageCount} A4 pages (limit ${maxPages}), ${uris.length} links, none local.`);
}

main().catch((error) => fail("CV print check could not read the PDF.", [error.message]));
