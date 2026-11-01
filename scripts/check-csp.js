#!/usr/bin/env node

// Loads every built page in Chromium with its Content-Security-Policy meta enforced and fails on any
// securitypolicyviolation, CSP console error or page error (#149). It also runs the paths that load
// late: Mermaid, video, search, the homepage lift and a floor panel, and the 404's GoatCounter setup.
//
// GoatCounter is made to fire on localhost (allow_local) so its CSP is exercised, but no hit reaches it:
// every goatcounter.com request is answered by a stub, and Chromium cannot resolve the host anyway.
// count.js itself still loads from gc.zgo.at, and Mermaid from jsdelivr, as on the live site.
//
// Usage: node scripts/check-csp.js [--only /blog/some-post/] [--base http://127.0.0.1:1313]
// Without --base it serves public/ itself, answering missing paths with 404.html like GitHub Pages.

const fs = require("fs");
const http = require("http");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const missingRoute = "/this-page-does-not-exist/";
const workers = 4;
const pixel = Buffer.from("R0lGODlhAQABAAAAACw=", "base64");
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".xml": "application/xml",
};

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1];
}

function fail(message, details = []) {
  console.error(message);
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  process.exit(1);
}

function serve() {
  const server = http.createServer((req, res) => {
    let file = path.normalize(path.join(publicDir, decodeURIComponent(new URL(req.url, "http://127.0.0.1").pathname)));

    if (file !== publicDir && !file.startsWith(publicDir + path.sep)) {
      file = publicDir;
    }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
      file = path.join(file, "index.html");
    }

    const found = fs.existsSync(file);
    const served = found ? file : path.join(publicDir, "404.html");
    const body = fs.readFileSync(served);
    const headers = {
      "accept-ranges": "bytes",
      "content-type": types[path.extname(served).toLowerCase()] || "application/octet-stream",
    };
    const range = found && req.headers.range && /bytes=(\d+)-(\d*)/.exec(req.headers.range);   // the videos ask for ranges

    if (range) {
      const start = Number(range[1]);
      const end = range[2] ? Number(range[2]) : body.length - 1;
      res.writeHead(206, { ...headers, "content-range": `bytes ${start}-${end}/${body.length}`, "content-length": end - start + 1 });
      res.end(body.subarray(start, end + 1));
      return;
    }

    res.writeHead(found ? 200 : 404, headers);
    res.end(body);
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve({ server, baseUrl: `http://127.0.0.1:${server.address().port}` }));
  });
}

function builtRoutes() {
  const routes = [];

  (function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        walk(file);
      } else if (entry.name.endsWith(".html")) {
        routes.push(`/${path.relative(publicDir, file).split(path.sep).join("/").replace(/index\.html$/, "")}`);
      }
    }
  })(publicDir);

  return routes.sort().concat(missingRoute);
}

// Runs in every page before its own scripts.
function recordViolations() {
  window.__csp = [];
  document.addEventListener("securitypolicyviolation", (event) => {
    window.__csp.push(`${event.effectiveDirective} blocked ${event.blockedURI} at ${event.sourceFile}:${event.lineNumber} ${event.sample || ""}`.trim());
  });

  // count.js skips localhost without allow_local; the 404 page assigns its own settings object.
  let settings = { allow_local: true };
  Object.defineProperty(window, "goatcounter", {
    configurable: true,
    get: () => settings,
    set: (value) => {
      settings = Object.assign(value || {}, { allow_local: true });
    },
  });
}

async function exercise(page, route) {
  const did = [];

  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
  });

  if (await page.$(".mermaid")) {
    await page.locator(".mermaid").first().scrollIntoViewIfNeeded();
    await page.waitForSelector(".mermaid svg", { timeout: 30000 });
    did.push(`mermaid ${await page.locator(".mermaid svg").count()}/${await page.locator(".mermaid").count()}`);
  }

  if (await page.$("video")) {
    const played = await page.evaluate(async () => {
      const video = document.querySelector("video");
      video.scrollIntoView();
      // Linux builds of Playwright's Chromium may lack H.264; a CSP block would still show as a violation.
      if (!video.canPlayType('video/mp4; codecs="avc1.42E01E"')) {
        return "codec unsupported";
      }
      await video.play();
      await new Promise((resolve) => setTimeout(resolve, 1200));
      return video.currentTime > 0 ? "played" : "did not play";
    });

    if (played === "did not play") {
      throw new Error("video did not play");
    }
    did.push(`video ${played}`);
  }

  if (await page.$("#site-search")) {
    await page.fill("#site-search", "kotlin");
    await page.waitForSelector(".search-result", { timeout: 10000 });
    did.push(`search results ${await page.locator(".search-result").count()}`);
  }

  if (route === "/") {
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(800);
    await page.locator(".building-floor-btn").nth(3).click();
    await page.waitForTimeout(1500);
    const step = page.locator(".building-stop.is-here .step-in, .step-in:visible").first();

    if (await step.count()) {
      await step.click();
      await page.waitForTimeout(800);
      did.push(`floor panel opened ${(await page.locator(".step-in[aria-expanded=true]").count()) > 0}`);
    }
    did.push("lift ridden");
  }

  return did;
}

async function check(context, baseUrl, route) {
  const page = await context.newPage();
  const result = { route, csp: false, violations: [], errors: [], goatcounter: 0, did: [] };

  page.on("console", (message) => {
    if (/Content.Security.Policy|Refused to/i.test(message.text())) {
      result.violations.push(`console: ${message.text().slice(0, 300)}`);
    }
  });
  page.on("pageerror", (error) => result.errors.push(String(error.message || error)));
  await page.route(/goatcounter\.com/, (request) => {
    result.goatcounter += 1;
    request.fulfill({ status: 200, contentType: "image/gif", body: pixel });
  });

  try {
    await page.goto(baseUrl + route, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    result.csp = (await page.$('meta[http-equiv="Content-Security-Policy"]')) !== null;
    result.did = await exercise(page, route).catch((error) => {
      result.errors.push(`exercise: ${error.message.split("\n")[0]}`);
      return [];
    });
    await page.waitForTimeout(500);
    result.violations.push(...(await page.evaluate(() => window.__csp)));
  } catch (error) {
    result.errors.push(error.message.split("\n")[0]);
  }

  await page.close();
  return result;
}

(async () => {
  const base = option("base");

  if (!base && !fs.existsSync(path.join(publicDir, "404.html"))) {
    fail("The CSP check requires a built public/ directory.", ["Run npm run build first."]);
  }

  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch (error) {
    fail("The CSP check requires Playwright.", ["Install local dependencies with npm install.", "Install a browser with npx playwright install chromium."]);
  }

  const started = Date.now();
  const own = base ? null : await serve();
  const baseUrl = (base || own.baseUrl).replace(/\/$/, "");
  const routes = option("only") ? [option("only")] : builtRoutes();
  const browser = await chromium.launch({
    ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}),
    args: ["--host-resolver-rules=MAP *.goatcounter.com ~NOTFOUND"],   // a hit the stub misses goes nowhere
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await context.addInitScript(recordViolations);

  const results = [];
  const queue = [...routes];
  await Promise.all(Array.from({ length: workers }, async () => {
    while (queue.length) {
      results.push(await check(context, baseUrl, queue.shift()));
    }
  }));

  await browser.close();
  if (own) {
    own.server.close();
  }

  results.sort((left, right) => left.route.localeCompare(right.route));
  const failed = results.filter((result) => result.violations.length || result.errors.length);

  for (const result of results) {
    const flag = result.violations.length || result.errors.length ? "FAIL" : "ok  ";
    const did = result.did.length ? ` [${result.did.join("; ")}]` : "";
    console.log(`${flag} ${result.route} csp=${result.csp} goatcounter=${result.goatcounter}${did}`);
    for (const line of [...result.violations, ...result.errors]) {
      console.log(`     ${line}`);
    }
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  const summary = `${results.length} pages (${results.filter((result) => result.csp).length} with a CSP meta) in ${seconds}s, `
    + `${results.reduce((sum, result) => sum + result.goatcounter, 0)} GoatCounter hits stubbed`;

  if (failed.length) {
    fail(`CSP check failed on ${failed.length} of ${summary}.`, failed.map((result) => result.route));
  }
  console.log(`CSP check passed: ${summary}.`);
})();
