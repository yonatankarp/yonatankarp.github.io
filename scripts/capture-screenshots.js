#!/usr/bin/env node

const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const dateStamp = new Date().toISOString().slice(0, 10);
const options = parseArgs(process.argv.slice(2));
const screenshotDir = path.resolve(rootDir, options.out || "screenshots");
const baseUrl = options.base || process.env.SITE_URL || "http://127.0.0.1:1313/";
const shouldStartServer = !options.base && !process.env.SITE_URL;

const viewports = [
  { name: "desktop", width: 1440, height: 1100 },
  { name: "mobile", width: 390, height: 1200 },
];

const routes = [
  { name: "home", path: "/" },
  { name: "projects", path: "/projects/" },
  { name: "blog", path: "/blog/" },
  { name: "cv", path: "/cv/" },
  { name: "post-self-compiling-second-brain", path: "/blog/self-compiling-second-brain/" },
];

function parseArgs(args) {
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const [flag, inlineValue] = arg.split("=", 2);

    if (flag === "--base" || flag === "--out") {
      parsed[flag.slice(2)] = inlineValue || args[index + 1];

      if (!inlineValue) {
        index += 1;
      }
    }
  }

  return parsed;
}

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

function routeUrl(routePath) {
  return new URL(routePath, baseUrl).toString();
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

async function scrollThroughPage(page) {
  await page.evaluate(async () => {
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const originalScrollBehavior = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "auto";
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
    const step = Math.max(300, Math.floor(viewportHeight * 0.75));
    const maxScroll = () => Math.max(0, document.documentElement.scrollHeight - viewportHeight);

    for (let y = 0; y < maxScroll(); y += step) {
      window.scrollTo(0, y);
      await delay(120);
    }

    window.scrollTo(0, maxScroll());
    await delay(250);
    window.scrollTo(0, 0);
    while (window.scrollY !== 0) {
      await delay(50);
    }
    document.documentElement.style.scrollBehavior = originalScrollBehavior;
    await delay(250);
  });
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
    for (const route of routes) {
      for (const viewport of viewports) {
        const page = await browser.newPage({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
        });

        const response = await page.goto(routeUrl(route.path), { waitUntil: "networkidle" });

        if (!response || !response.ok()) {
          const status = response ? response.status() : "no response";
          fail(`Failed to load ${route.path}: ${status}`);
        }

        await scrollThroughPage(page);

        await page.screenshot({
          path: path.join(screenshotDir, `${route.name}-${viewport.name}-${dateStamp}.png`),
          fullPage: true,
        });
        await page.close();
      }
    }
  } finally {
    await browser.close();

    if (server) {
      server.kill("SIGTERM");
    }
  }

  console.log(`Captured ${routes.length * viewports.length} screenshots in ${path.relative(rootDir, screenshotDir)}/`);
}

main().catch((error) => {
  fail(error && error.stack ? error.stack : String(error));
});
