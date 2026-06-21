#!/usr/bin/env node

const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const screenshotDir = path.join(rootDir, "screenshots");
const dateStamp = new Date().toISOString().slice(0, 10);
const baseUrl = process.env.SITE_URL || "http://127.0.0.1:1313/";
const shouldStartServer = !process.env.SITE_URL;

const viewports = [
  { name: "home-desktop", width: 1440, height: 1100 },
  { name: "home-mobile", width: 390, height: 1200 },
];

function fail(message) {
  console.error(message);
  process.exit(1);
}

function resolveHugoCommand() {
  const localHugo = path.join(rootDir, ".tools", "hugo", "hugo");

  if (fs.existsSync(localHugo)) {
    return { command: localHugo, args: [] };
  }

  return { command: "hugo", args: [] };
}

function requestUrl(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(res.statusCode && res.statusCode >= 200 && res.statusCode < 500);
    });

    req.on("error", () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

async function waitForUrl(url, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await requestUrl(url)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  fail(`Timed out waiting for ${url}`);
}

async function loadPlaywright() {
  try {
    return require("playwright");
  } catch (error) {
    fail(
      [
        "Playwright is required for visual capture but is not installed.",
        "Install it locally with: npm install --save-dev playwright",
        "Then install a browser with: npx playwright install chromium",
      ].join("\n")
    );
  }
}

async function main() {
  const { chromium } = await loadPlaywright();
  let server = null;

  if (shouldStartServer) {
    const hugo = resolveHugoCommand();
    server = spawn(
      hugo.command,
      [
        ...hugo.args,
        "server",
        "--bind",
        "127.0.0.1",
        "--port",
        "1313",
        "--disableFastRender",
      ],
      {
        cwd: rootDir,
        stdio: ["ignore", "pipe", "pipe"],
      }
    );

    server.on("exit", (code) => {
      if (code !== null && code !== 0) {
        fail(`Hugo server exited early with code ${code}`);
      }
    });

    await waitForUrl(baseUrl, 15000);
  } else {
    await waitForUrl(baseUrl, 5000);
  }

  fs.mkdirSync(screenshotDir, { recursive: true });

  const browser = await chromium.launch();

  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({
        viewport: { width: viewport.width, height: viewport.height },
        deviceScaleFactor: 1,
      });

      await page.goto(baseUrl, { waitUntil: "networkidle" });
      await page.screenshot({
        path: path.join(screenshotDir, `${viewport.name}-${dateStamp}.png`),
        fullPage: true,
      });
      await page.close();
    }
  } finally {
    await browser.close();

    if (server) {
      server.kill("SIGTERM");
    }
  }

  console.log(`Captured ${viewports.length} screenshots in ${path.relative(rootDir, screenshotDir)}/`);
}

main().catch((error) => {
  fail(error && error.stack ? error.stack : String(error));
});
