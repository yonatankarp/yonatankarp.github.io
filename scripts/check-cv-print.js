#!/usr/bin/env node

const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const { execFileSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const cvPath = path.join(publicDir, "cv", "index.html");
const maxPages = 2;

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
    fail("CV print check requires Playwright.", [
      "Install local dependencies with npm install.",
      "Install a browser with npx playwright install chromium.",
    ]);
  }
}

function readPdfPageCount(pdfPath) {
  try {
    const output = execFileSync("pdfinfo", [pdfPath], { encoding: "utf8" });
    const match = output.match(/^Pages:\s+(\d+)/m);

    if (!match) {
      fail("CV print check could not read the generated PDF page count.", [output.trim()]);
    }

    return Number(match[1]);
  } catch (error) {
    fail("CV print check requires pdfinfo to be available on PATH.", [
      error.message,
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "yonatan-cv-print-"));
  const pdfPath = path.join(tmpDir, "cv.pdf");
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({ viewport: { width: 1240, height: 1754 } });
    await page.goto(`${baseUrl}/cv/`, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
    });
  } finally {
    await browser.close();
    server.close();
  }

  const pageCount = readPdfPageCount(pdfPath);
  fs.rmSync(tmpDir, { recursive: true, force: true });

  if (pageCount > maxPages) {
    fail(`CV print check failed: expected at most ${maxPages} A4 pages, got ${pageCount}.`);
  }

  console.log(`CV print check passed: ${pageCount} A4 pages (limit ${maxPages}).`);
})();
