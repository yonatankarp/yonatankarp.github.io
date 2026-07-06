#!/usr/bin/env node

const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const dateStamp = new Date().toISOString().slice(0, 10);
const options = parseArgs(process.argv.slice(2));
const screenshotDir = path.resolve(rootDir, options.out || path.join("artifacts", "visual-smoke", dateStamp));
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

const assertions = [
  "HTTP response succeeds for every captured route.",
  "Each page renders a visible h1 and at least 200 characters of body text.",
  "Mobile pages do not horizontally overflow the viewport.",
  "Visible images are loaded with non-zero natural dimensions.",
  "Mobile navigation button is visible, at least 36x36px, labeled, closed by default, and wired to #primary-nav.",
  "Home page contains the hero and proof sections.",
  "Blog index contains multiple article rows/cards.",
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

function writeManifest() {
  const relativeDir = path.relative(rootDir, screenshotDir);
  const lines = [
    `# Visual Smoke Capture - ${dateStamp}`,
    "",
    `Base URL: ${baseUrl}`,
    `Output directory: ${relativeDir}/`,
    `Server mode: ${shouldStartServer ? "local Hugo server with --renderToMemory" : "existing server"}`,
    "",
    "## Routes",
    "",
    ...routes.map((route) => `- ${route.name}: ${route.path}`),
    "",
    "## Viewports",
    "",
    ...viewports.map((viewport) => `- ${viewport.name}: ${viewport.width}x${viewport.height}`),
    "",
    "## Assertions",
    "",
    ...assertions.map((assertion) => `- ${assertion}`),
    "",
    "## Files",
    "",
    ...routes.flatMap((route) =>
      viewports.map((viewport) => `- ${route.name}-${viewport.name}-${dateStamp}.png`)
    ),
    "",
  ];

  fs.writeFileSync(path.join(screenshotDir, "README.md"), `${lines.join("\n")}\n`);
}

async function waitForUrl(url, timeoutMs, timeoutMessage) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await requestUrl(url)) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 250));
  }

  fail(timeoutMessage || `Timed out waiting for ${url}`);
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

async function assertPageBasics(page, route, viewport) {
  const checks = await page.evaluate(() => {
    const html = document.documentElement;
    const body = document.body;
    const h1 = document.querySelector("h1");
    const navToggle = document.querySelector(".menu-toggle");
    const visibleImages = Array.from(document.images).filter((image) => {
      const rect = image.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });

    return {
      h1Text: h1 ? h1.textContent.trim() : "",
      horizontalOverflow: Math.ceil(html.scrollWidth) > Math.ceil(window.innerWidth) + 1,
      bodyTextLength: body ? body.innerText.trim().length : 0,
      brokenVisibleImages: visibleImages
        .filter((image) => !image.complete || image.naturalWidth === 0 || image.naturalHeight === 0)
        .map((image) => image.currentSrc || image.src),
      navToggle: navToggle
        ? {
            width: Math.round(navToggle.getBoundingClientRect().width),
            height: Math.round(navToggle.getBoundingClientRect().height),
            visible: getComputedStyle(navToggle).display !== "none",
            ariaControls: navToggle.getAttribute("aria-controls") || "",
            ariaExpanded: navToggle.getAttribute("aria-expanded") || "",
            label: navToggle.getAttribute("aria-label") || "",
          }
        : null,
      homeHero: Boolean(document.querySelector(".hero")),
      homeProof: Boolean(document.querySelector(".proof-grid")),
      blogCards: document.querySelectorAll(".post-row, .featured-article").length,
    };
  });

  if (!checks.h1Text) {
    fail(`${route.path} (${viewport.name}) has no visible h1`);
  }

  if (checks.bodyTextLength < 200) {
    fail(`${route.path} (${viewport.name}) rendered too little text`);
  }

  if (viewport.name === "mobile" && checks.horizontalOverflow) {
    fail(`${route.path} (${viewport.name}) has horizontal overflow`);
  }

  if (checks.brokenVisibleImages.length > 0) {
    fail(`${route.path} (${viewport.name}) has broken visible images: ${checks.brokenVisibleImages.join(", ")}`);
  }

  if (viewport.name === "mobile") {
    if (!checks.navToggle) {
      fail(`${route.path} (${viewport.name}) is missing the mobile menu button`);
    }

    if (!checks.navToggle.visible) {
      fail(`${route.path} (${viewport.name}) has a hidden mobile menu button`);
    }

    if (checks.navToggle.width < 36 || checks.navToggle.height < 36) {
      fail(`${route.path} (${viewport.name}) has an undersized mobile menu button`);
    }

    if (checks.navToggle.ariaControls !== "primary-nav" || !checks.navToggle.label || checks.navToggle.ariaExpanded !== "false") {
      fail(`${route.path} (${viewport.name}) has incomplete mobile menu accessibility attributes`);
    }
  }

  if (route.name === "home" && (!checks.homeHero || !checks.homeProof)) {
    fail(`${route.path} (${viewport.name}) is missing the hero or proof section`);
  }

  if (route.name === "blog" && checks.blogCards < 2) {
    fail(`${route.path} (${viewport.name}) has too few blog cards`);
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
        "--renderToMemory",
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

    await waitForUrl(baseUrl, 15000, `Timed out waiting for local Hugo server at ${baseUrl}`);
  } else {
    await waitForUrl(
      baseUrl,
      5000,
      [
        `Timed out waiting for existing server at ${baseUrl}`,
        "Start Hugo separately before using --base or SITE_URL, or omit them so this helper starts the bundled server.",
      ].join("\n")
    );
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
        await assertPageBasics(page, route, viewport);

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

  writeManifest();
  console.log(`Captured ${routes.length * viewports.length} screenshots in ${path.relative(rootDir, screenshotDir)}/`);
}

main().catch((error) => {
  fail(error && error.stack ? error.stack : String(error));
});
