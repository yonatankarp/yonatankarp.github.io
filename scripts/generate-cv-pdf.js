#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { rootDir, publicDir, fail, loadPlaywright } = require("./lib");
const { serve } = require("./serve-public");

const cvPath = path.join(publicDir, "cv", "index.html");
const pdfPath = path.join(publicDir, "yonatan-karp-rudin-cv.pdf");   // the homepage's Download CV
const CV_FONTS = ["Jersey 15", "Outfit Print"];   // the faces the printed CV sets its text in; compared lowercased, as the minifier writes them

// Chromium only writes Title, so Author, Subject and the rest are added after printing.
async function setMetadata() {
  const { PDFDocument } = require("pdf-lib");
  const pdf = await PDFDocument.load(fs.readFileSync(pdfPath), { updateMetadata: false });   // keep Chromium's tags and outline, and don't let pdf-lib overwrite our fields
  pdf.setAuthor("Yonatan Karp-Rudin");
  pdf.setSubject("Curriculum vitae of Yonatan Karp-Rudin, Staff Software Engineer");
  pdf.setKeywords(["Kotlin", "Java", "Spring Boot", "Kafka", "OpenAPI", "Backend", "Staff Engineer"]);
  pdf.setCreator("yonatankarp.com");
  fs.writeFileSync(pdfPath, await pdf.save());
}

(async () => {
  if (!fs.existsSync(cvPath)) {
    fail("CV print check requires a built public/cv/index.html file.", [
      "Run npm run build first.",
    ]);
  }

  const { chromium } = loadPlaywright("CV PDF generation");
  const { server, baseUrl } = await serve();
  const browser = await chromium.launch({
    args: ["--font-render-hinting=none"],   // on Linux, where the deploy prints this, hinting rounds glyph advances to whole pixels: "tr ansaction"
    ...(process.env.PLAYWRIGHT_CHANNEL && { channel: process.env.PLAYWRIGHT_CHANNEL }),   // e.g. chrome, where Playwright's own browser is not installed
  });

  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
    await page.goto(`${baseUrl}/cv/?time=dusk`, { waitUntil: "domcontentloaded" });
    try {
      await page.waitForLoadState("networkidle", { timeout: 5000 });
    } catch {
      console.warn("CV PDF generation continuing before networkidle.");
    }
    await page.emulateMedia({ media: "print" });
    // A PDF in fallback fonts would otherwise ship (#146): wait for the print layout's fonts and require them loaded.
    const faces = await page.evaluate(async () => {
      document.body.getBoundingClientRect();   // lay out in print media so its fonts start loading
      await document.fonts.ready;
      return Array.from(document.fonts, (face) => ({ family: face.family.replace(/["']/g, "").toLowerCase(), status: face.status }));
    });
    const broken = faces.filter((face) => face.status === "error").map((face) => `${face.family} failed to load`);
    const missing = CV_FONTS.filter((family) => !faces.some((face) => face.family === family.toLowerCase() && face.status === "loaded"))
      .map((family) => `${family} is not loaded`);
    if (broken.length || missing.length) {
      fail("CV PDF generation stopped: the CV's fonts did not load.", [...broken, ...missing]);
    }
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      tagged: true,    // headings, lists and reading order for screen readers and ATS parsers
      outline: true,   // bookmarks from the headings
    });
  } finally {
    await browser.close();
    server.close();
  }

  await setMetadata();

  console.log(`Wrote ${path.relative(rootDir, pdfPath)}.`);
})();
