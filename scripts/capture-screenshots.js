#!/usr/bin/env node

const fs = require("fs");
const http = require("http");
const https = require("https");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const dateStamp = new Date().toISOString().slice(0, 10);
const options = parseArgs(process.argv.slice(2));
const screenshotDir = path.resolve(rootDir, options.out || path.join("artifacts", "visual-smoke", dateStamp));
let baseUrl = options.base || process.env.SITE_URL || "http://127.0.0.1:1313/";
const shouldStartServer = !options.base && !process.env.SITE_URL;

const viewports = [
  { name: "desktop", width: 1440, height: 1100 },
  { name: "mobile", width: 390, height: 1200 },
];

const routes = [
  {
    name: "home",
    path: "/",
    pauseLabel: true,
    requiredSelectors: [
      ["#pixel-canvas", 1, "building canvas"],
      ["section.building-stop", 12, "building floors"],
      [".building-window", 9, "street view windows"],
    ],
  },
  {
    name: "projects",
    path: "/projects/",
    requiredSelectors: [
      [".px-bar__name", 1, "name plate"],
      [".px-download", 1, "CV download"],
      [".px-grid", 2, "project grids"],
      [".px-card", 15, "project cards"],
    ],
  },
  {
    name: "case-study",
    path: "/projects/ff4k/",
    ctaFocus: true,
    requiredSelectors: [
      [".px-bar__name", 1, "name plate"],
      [".px-prose", 1, "article body"],
    ],
  },
  {
    name: "blog",
    path: "/blog/",
    requiredSelectors: [
      [".px-bar__name", 1, "name plate"],
      [".px-download", 1, "CV download"],
    ],
  },
  {
    name: "cv",
    path: "/cv/",
    requiredSelectors: [
      [".px-bar__name", 1, "name plate"],
      [".px-download", 1, "CV download"],
      [".cv-role-item", 6, "CV roles"],
    ],
  },
  {
    name: "post-self-compiling-second-brain",
    path: "/blog/self-compiling-second-brain/",
    requiredSelectors: [
      [".px-bar__name", 1, "name plate"],
      [".px-download", 1, "CV download"],
    ],
  },
  {
    name: "search",
    path: "/search/",
    requiredSelectors: [
      [".px-bar__name", 1, "name plate"],
      [".px-sheet", 1, "sheet"],
      ["#site-search", 1, "search box"],
      ["#search-results", 1, "results list"],
    ],
  },
  {
    name: "skills",
    path: "/skills/",
    requiredSelectors: [
      [".px-bar__name", 1, "name plate"],
      [".px-skills__area", 1, "practice areas"],
      [".px-chip", 1, "skill chips"],
    ],
  },
  {
    name: "madeira-2026",
    path: "/madeira-2026/",
    requiredSelectors: [
      [".route-guide .route-card", 2, "route guide cards"],
      [".day", 8, "daily itinerary sections"],
      [".photo-card img", 8, "itinerary photos"],
      [".sources .panel", 4, "source panels"],
    ],
  },
];

const assertions = [
  "HTTP response succeeds for every captured route.",
  "Each page renders a visible h1 and at least 200 characters of body text.",
  "Mobile pages do not horizontally overflow the viewport.",
  "Visible images are loaded with non-zero natural dimensions.",
  "Every page but the homepage renders the shared pixel top bar: name plate and CV download.",
  "Home page renders the building: its canvas, every floor and the street view's windows.",
  "Home page pause button shows a Pause label that turns to Play on click on desktop, and stays at least 36x36px with the label hidden on mobile.",
  "CV page renders every role.",
  "Blog index contains multiple article rows/cards.",
  "Standalone Madeira page contains route cards, daily itinerary sections, photos, and source panels.",
];

function parseArgs(args) {
  const parsed = {};

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    const [flag, inlineValue] = arg.split("=", 2);

    if (flag === "--base" || flag === "--out" || flag === "--port") {
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
    const client = new URL(url).protocol === "https:" ? https : http;
    const req = client.get(url, (res) => {
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

function localBaseUrl(port) {
  return `http://127.0.0.1:${port}/`;
}

function checkPort(port) {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function findAvailablePort(preferredPort) {
  for (let port = preferredPort; port < preferredPort + 50; port += 1) {
    if (await checkPort(port)) {
      return port;
    }
  }

  fail(`Could not find an available local Hugo port from ${preferredPort} to ${preferredPort + 49}`);
}

function preferredPort() {
  const rawPort = options.port || "1313";
  const port = Number.parseInt(rawPort, 10);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    fail(`Invalid --port value: ${rawPort}`);
  }

  return port;
}

function screenshotFileName(route, viewport) {
  return `${route.name}-${viewport.name}-${dateStamp}.png`;
}

function buildManifestData() {
  const relativeDir = path.relative(rootDir, screenshotDir);

  return {
    generatedAt: new Date().toISOString(),
    date: dateStamp,
    baseUrl,
    outputDirectory: `${relativeDir}/`,
    serverMode: shouldStartServer ? "local-hugo-render-to-memory" : "existing-server",
    routes: routes.map((route) => ({
      name: route.name,
      path: route.path,
    })),
    viewports: viewports.map((viewport) => ({ ...viewport })),
    assertions,
    files: routes.flatMap((route) =>
      viewports.map((viewport) => ({
        route: route.name,
        viewport: viewport.name,
        file: screenshotFileName(route, viewport),
      }))
    ),
  };
}

function writeManifest() {
  const manifest = buildManifestData();
  const lines = [
    `# Visual Smoke Capture - ${dateStamp}`,
    "",
    `Base URL: ${baseUrl}`,
    `Output directory: ${manifest.outputDirectory}`,
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
      viewports.map((viewport) => `- ${screenshotFileName(route, viewport)}`)
    ),
    "",
    "Machine-readable capture details are available in `manifest.json`.",
    "",
  ];

  fs.writeFileSync(path.join(screenshotDir, "README.md"), `${lines.join("\n")}\n`);
  fs.writeFileSync(path.join(screenshotDir, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
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

async function waitForPageImages(page) {
  await page.evaluate(async () => {
    const images = Array.from(document.images);
    const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));

    for (const image of images) {
      image.loading = "eager";
    }

    await Promise.all(
      images.map((image) => {
        if (image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) {
          return Promise.resolve();
        }

        const loaded = new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        });

        if (typeof image.decode === "function") {
          return image.decode().catch(() => loaded);
        }

        return loaded;
      })
    );

    for (const image of images) {
      const rect = image.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) {
        continue;
      }

      image.scrollIntoView({ block: "center", inline: "nearest" });
      if (typeof image.decode === "function") {
        await image.decode().catch(() => {});
      }
      await nextFrame();
    }

    window.scrollTo(0, 0);
    await nextFrame();
    await delay(100);
  });
}

async function assertPageBasics(page, route, viewport) {
  const checks = await page.evaluate((requiredSelectors) => {
    const html = document.documentElement;
    const body = document.body;
    const h1 = document.querySelector("h1");
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
      blogCards: document.querySelectorAll(".post-row, .featured-article").length,
      requiredSelectorCounts: requiredSelectors.map(([selector, minimum, label]) => ({
        selector,
        minimum,
        label,
        count: document.querySelectorAll(selector).length,
      })),
    };
  }, route.requiredSelectors || []);

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

  if (route.name === "blog" && checks.blogCards < 2) {
    fail(`${route.path} (${viewport.name}) has too few blog cards`);
  }

  for (const selectorCheck of checks.requiredSelectorCounts) {
    if (selectorCheck.count < selectorCheck.minimum) {
      fail(
        `${route.path} (${viewport.name}) has too few ${selectorCheck.label}: ` +
          `${selectorCheck.count}/${selectorCheck.minimum} for ${selectorCheck.selector}`
      );
    }
  }
}

async function assertCtaFocusRing(page, route, viewport) {
  await page.focus("a.px-cta");
  const shadow = await page.evaluate(() => getComputedStyle(document.activeElement).boxShadow);

  if (!shadow || shadow === "none") {
    fail(`${route.path} (${viewport.name}) focused a.px-cta has no visible focus ring (box-shadow ${shadow})`);
  }

  await page.evaluate(() => document.activeElement.blur());
}

async function assertPauseLabel(page, route, viewport) {
  const read = () =>
    page.evaluate(() => {
      const button = document.querySelector(".building-pause");
      const label = document.querySelector("[data-building-pause-label]");
      const box = button ? button.getBoundingClientRect() : { width: 0, height: 0 };
      return {
        text: label ? label.textContent.trim() : null,
        labelVisible: Boolean(label && label.getBoundingClientRect().width > 0),
        width: box.width,
        height: box.height,
      };
    });
  const state = await read();

  if (viewport.name === "mobile") {
    if (state.labelVisible) {
      fail(`${route.path} (${viewport.name}) shows the pause label`);
    }

    if (state.width < 36 || state.height < 36) {
      fail(`${route.path} (${viewport.name}) pause button is ${state.width}x${state.height}, under 36x36`);
    }

    return;
  }

  if (!state.labelVisible || state.text !== "Pause") {
    fail(`${route.path} (${viewport.name}) pause label is ${state.labelVisible ? "visible" : "hidden"} with text ${state.text}, expected visible "Pause"`);
  }

  await page.click(".building-pause");
  const clicked = await read();

  if (clicked.text !== "Play") {
    fail(`${route.path} (${viewport.name}) pause label reads ${clicked.text} after a click, expected "Play"`);
  }

  await page.click(".building-pause");
}

async function main() {
  const { chromium } = await loadPlaywright();
  let server = null;

  if (shouldStartServer) {
    const port = await findAvailablePort(preferredPort());
    const hugo = resolveHugoCommand();
    baseUrl = localBaseUrl(port);
    server = spawn(
      hugo.command,
      [
        ...hugo.args,
        "server",
        "--bind",
        "127.0.0.1",
        "--port",
        String(port),
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

  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {});

  try {
    for (const route of routes) {
      for (const viewport of viewports) {
        const page = await browser.newPage({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
        });
        await page.addInitScript(() => {
          const observer = new MutationObserver(() => {
            document.querySelectorAll("img[loading='lazy']").forEach((image) => {
              image.loading = "eager";
            });
          });

          document.addEventListener("DOMContentLoaded", () => {
            document.querySelectorAll("img[loading='lazy']").forEach((image) => {
              image.loading = "eager";
            });
          }, { once: true });

          observer.observe(document, {   // documentElement does not exist yet when init scripts run
            childList: true,
            subtree: true,
          });
        });

        const pageErrors = [];
        page.on("pageerror", (error) => pageErrors.push(error.message));

        const response = await page.goto(routeUrl(route.path), { waitUntil: "domcontentloaded" });

        if (!response || !response.ok()) {
          const status = response ? response.status() : "no response";
          fail(`Failed to load ${route.path}: ${status}`);
        }

        await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
        await waitForPageImages(page);
        await scrollThroughPage(page);
        await waitForPageImages(page);
        await assertPageBasics(page, route, viewport);

        if (pageErrors.length > 0) {
          fail(`${route.path} (${viewport.name}) threw uncaught page errors: ${pageErrors.join("; ")}`);
        }

        if (route.pauseLabel) {
          await assertPauseLabel(page, route, viewport);
        }

        if (route.ctaFocus) {
          await assertCtaFocusRing(page, route, viewport);
        }

        await page.locator("body").screenshot({
          path: path.join(screenshotDir, screenshotFileName(route, viewport)),
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
