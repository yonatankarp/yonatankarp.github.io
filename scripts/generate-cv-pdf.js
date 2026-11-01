#!/usr/bin/env node

const fs = require("fs");
const http = require("http");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const cvPath = path.join(publicDir, "cv", "index.html");
const pdfPath = path.join(publicDir, "yonatan-karp-rudin-cv.pdf");   // the homepage's Download CV
const CV_FONTS = ["Jersey 15", "Outfit"];   // the faces the printed CV sets its text in; compared lowercased, as the minifier writes them

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

function fail(message, details = []) {
  console.error(message);
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  process.exit(1);
}

async function loadPlaywright() {
  try {
    return require("playwright");
  } catch (error) {
    fail("CV PDF generation requires Playwright.", [
      "Install local dependencies with npm install.",
      "Install a browser with npx playwright install chromium.",
    ]);
  }
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const types = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".woff2": "font/woff2",
  };

  return types[extension] || "application/octet-stream";
}

function createStaticServer() {
  const server = http.createServer((req, res) => {
    const rawPath = decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname);
    const relativePath = rawPath.replace(/^\/+/, "") || "index.html";
    const requestedPath = path.normalize(path.join(publicDir, relativePath));
    const relativeToPublic = path.relative(publicDir, requestedPath);
    const insidePublic = relativeToPublic && !relativeToPublic.startsWith("..") && !path.isAbsolute(relativeToPublic);
    const safePath = insidePublic ? requestedPath : publicDir;
    const filePath = fs.existsSync(safePath) && fs.statSync(safePath).isDirectory()
      ? path.join(safePath, "index.html")
      : safePath;

    if (!insidePublic || !fs.existsSync(filePath)) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, { "content-type": contentType(filePath) });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

(async () => {
  if (!fs.existsSync(cvPath)) {
    fail("CV print check requires a built public/cv/index.html file.", [
      "Run npm run build first.",
    ]);
  }

  const { chromium } = await loadPlaywright();
  const { server, baseUrl } = await createStaticServer();
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {});   // e.g. chrome, where Playwright's own browser is not installed

  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
    await page.goto(`${baseUrl}/cv/?time=dusk`, { waitUntil: "domcontentloaded" });
    try {
      await page.waitForLoadState("networkidle", { timeout: 5000 });
    } catch (error) {
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
