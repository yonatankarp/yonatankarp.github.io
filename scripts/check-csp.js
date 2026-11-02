#!/usr/bin/env node

// Loads every built page in Chromium with its Content-Security-Policy meta enforced and fails on any
// securitypolicyviolation, CSP console error or page error (#149). It also runs the paths that load
// late: the diagram zoom, video, search, the homepage lift and a floor panel, the arrival at the homepage from
// another page, and the 404's GoatCounter setup.
//
// GoatCounter is made to fire on localhost (allow_local) so its CSP is exercised, but no hit reaches it:
// every goatcounter.com request is answered by a stub, and Chromium cannot resolve the host anyway.
// count.js itself still loads from gc.zgo.at, as on the live site.
//
// The same pass runs axe-core on each page as it loads, before anything is clicked, and fails on any
// serious or critical violation (#193).
//
// Every navigation stays on the local server: one to another origin is answered with 204 No Content, which leaves the
// page where it is, so nothing here depends on the network or on what the live site has deployed. A redirect page (a
// Hugo alias or an old address, a meta refresh) is held the same way, its refresh stopped, and checked for its own CSP
// meta tag where it has one and for a target on yonatankarp.com or this server. Axe and the exercises skip it.
//
// A page that fails on a known transient error (its context destroyed by a navigation, or a timeout under 8 workers)
// is loaded once more, and the retry is logged; any other failure fails at once.
//
// Usage: node scripts/check-csp.js [--only /blog/some-post/] [--base http://127.0.0.1:1313]
// Without --base it serves public/ itself, answering missing paths with 404.html like GitHub Pages.

const fs = require("fs");
const path = require("path");
const { publicDir, fail, walk } = require("./lib");
const { serve } = require("./serve-public");
const phases = require("../data/phases.json");

const missingRoute = "/this-page-does-not-exist/";
const arrivalRoute = "/projects/?arrive";   // leaves for the homepage, under the view transition that page's styles animate
const workers = Number(process.env.CSP_WORKERS || 4);   // pages mostly wait on the network, so CI runs 8
if (!Number.isInteger(workers) || workers < 1) {
  console.error(`CSP_WORKERS must be a positive integer, got "${process.env.CSP_WORKERS}"`);
  process.exit(1);
}
const pixel = Buffer.from("R0lGODlhAQABAAAAACw=", "base64");
const blockingImpacts = new Set(["serious", "critical"]);
const transient = /Execution context was destroyed|Timeout \d+ms exceeded/;
let AxeBuilder;

// A built page that only sends the reader on: Hugo's alias pages and layouts/_default/redirect.html.
function isRedirect(route) {
  const file = path.join(publicDir, route.split("?")[0], "index.html");
  return fs.existsSync(file) && /<meta\b[^>]*http-equiv=["']?refresh/i.test(fs.readFileSync(file, "utf8"));
}

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1];
}

function builtRoutes() {
  const routes = walk(publicDir, ".html").map((file) => `/${path.relative(publicDir, file).split(path.sep).join("/").replace(/index\.html$/, "")}`);

  // The homepage at every hour: this script runs at wall-clock time, so "/" alone would only ever see one (#151).
  return routes.sort().concat(missingRoute, arrivalRoute, ...Object.keys(phases).map((time) => `/?time=${time}`));
}

// Runs in every page before its own scripts.
function recordViolations() {
  window.__csp = [];
  addEventListener("pagereveal", (event) => event.viewTransition?.ready.then(() => {
    window.__transition = document.getAnimations().map((animation) => animation.animationName);
  }));
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

// Axe's serious and critical findings, one line per rule.
async function accessibility(page) {
  const { violations } = await new AxeBuilder({ page }).analyze();

  return violations
    .filter((violation) => blockingImpacts.has(violation.impact))
    .map((violation) => {
      const targets = violation.nodes.slice(0, 3).map((node) => node.target.join(" ")).join(", ");
      const more = violation.nodes.length > 3 ? ` and ${violation.nodes.length - 3} more` : "";
      return `axe ${violation.impact} ${violation.id}: ${violation.help} (${targets}${more})`;
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
    // Drawn at build time (#250): every block ships its svg, named by aria-roledescription (sequence, flowchart-v2, ...),
    // and diagram-zoom.js gives each its Zoom in.
    const undrawn = await page.evaluate(() => [...document.querySelectorAll(".mermaid")].filter((block) => !block.querySelector(":scope > svg[aria-roledescription]")).length);
    if (undrawn) throw new Error(`${undrawn} diagrams were not drawn at build time`);
    await page.locator(".mermaid").first().scrollIntoViewIfNeeded();
    await page.waitForFunction(() => [...document.querySelectorAll(".mermaid")].every((block) => block.querySelector(":scope > button")), null, { timeout: 30000 });
    did.push(`mermaid ${await page.locator(".mermaid > svg[aria-roledescription]").count()}/${await page.locator(".mermaid").count()}`);
    const wide = await page.evaluate(() => [...document.querySelectorAll(".mermaid")].filter((block) => block.scrollWidth > block.clientWidth).length);
    if (wide) throw new Error(`${wide} diagrams do not fit the column`);
    await page.locator(".mermaid > button").first().click();
    const natural = await page.evaluate(() => {
      const svg = document.querySelector("dialog[open] svg");
      return svg && Math.abs(svg.getBoundingClientRect().width - Number(svg.getAttribute("width"))) < 1;
    });
    if (!natural) throw new Error("the zoom dialog did not open with the diagram at its natural size");
    await page.keyboard.press("Escape");
    // Waited for: a dialog fires close a task after it shuts, and that is when the diagram and the focus come back
    await page.waitForFunction(() => {
      const button = document.querySelector(".mermaid > button");
      return document.activeElement === button && !document.querySelector("dialog[open]") && button.previousElementSibling?.localName === "svg";
    }, null, { timeout: 5000 }).catch(() => {
      throw new Error("Escape did not close the zoom dialog and return the diagram and the focus");
    });
    did.push("zoomed");
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

  if (route === arrivalRoute) {
    await page.click(".px-bar__name");
    await page.waitForFunction(() => window.__transition, null, { timeout: 5000 });
    const ran = await page.evaluate(() => window.__transition);
    if (!ran.includes("px-rise")) {
      throw new Error(`the arrival at the homepage did not run: ${ran.join(", ")}`);
    }
    await page.waitForFunction(() => !document.documentElement.classList.contains("px-arrive"), null, { timeout: 5000 });
    did.push("arrived at the homepage");
  }

  if (route === "/" || route.startsWith("/?time=")) {
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
  const result = { route, csp: false, violations: [], errors: [], a11y: [], goatcounter: 0, did: [] };
  const redirect = isRedirect(route);

  page.on("console", (message) => {
    if (/Content.Security.Policy|Refused to|integrity/i.test(message.text())) {
      result.violations.push(`console: ${message.text().slice(0, 300)}`);
    }
  });
  page.on("pageerror", (error) => result.errors.push(String(error.message || error)));
  await page.route(/goatcounter\.com/, (request) => {
    result.goatcounter += 1;
    request.fulfill({ status: 200, contentType: "image/gif", body: pixel });
  });

  let first = true;
  await page.route("**/*", (request) => {
    const asked = request.request();
    if (asked.isNavigationRequest() && asked.frame() === page.mainFrame()) {
      const away = new URL(asked.url()).origin !== new URL(baseUrl).origin;
      if (away || (redirect && !first)) {
        result.did.push(redirect ? "refresh held" : `held a navigation to ${asked.url()}`);
        return request.fulfill({ status: 204 });   // No Content: the browser stays on the page; an abort would show an error page
      }
      first = false;
    }
    return request.fallback();
  });

  try {
    await page.goto(baseUrl + route, { waitUntil: "load" });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    result.csp = (await page.$('meta[http-equiv="Content-Security-Policy"]')) !== null;
    result.violations.push(...(await page.evaluate(() => window.__csp.splice(0))));
    if (redirect) {
      await page.waitForTimeout(500);
      result.violations.push(...(await page.evaluate(() => window.__csp)));
      const target = (await page.getAttribute('meta[http-equiv="refresh"]', "content"))?.match(/url=(\S+)/i)?.[1] ?? "";
      // A removed post may send its readers to its copy on dev.to; nothing else leaves the site.
      if (!target.startsWith("https://yonatankarp.com/") && !target.startsWith("/") && !target.startsWith("https://dev.to/yonatankarp/")) {
        result.errors.push(`redirects to "${target}", not to a page of yonatankarp.com or a post on dev.to`);
      }
      await page.close();
      return result;
    }
    result.a11y = await accessibility(page);
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
    ({ AxeBuilder } = require("@axe-core/playwright"));
  } catch {
    fail("The CSP check requires Playwright and @axe-core/playwright.", ["Install local dependencies with npm install.", "Install a browser with npx playwright install chromium."]);
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
      const route = queue.shift();
      let result = await check(context, baseUrl, route);
      const flake = result.errors.find((error) => transient.test(error));
      if (flake) {
        console.log(`retry ${route}: ${flake}`);
        result = await check(context, baseUrl, route);
      }
      results.push(result);
    }
  }));

  await browser.close();
  if (own) {
    own.server.close();
  }

  results.sort((left, right) => left.route.localeCompare(right.route));
  const problems = (result) => [...result.violations, ...result.errors, ...result.a11y];
  const failed = results.filter((result) => problems(result).length);

  for (const result of results) {
    const flag = problems(result).length ? "FAIL" : "ok  ";
    const did = result.did.length ? ` [${result.did.join("; ")}]` : "";
    console.log(`${flag} ${result.route} csp=${result.csp} goatcounter=${result.goatcounter}${did}`);
    for (const line of problems(result)) {
      console.log(`     ${line}`);
    }
  }

  const seconds = ((Date.now() - started) / 1000).toFixed(0);
  const summary = `${results.length} pages (${results.filter((result) => result.csp).length} with a CSP meta) in ${seconds}s, `
    + `${results.reduce((sum, result) => sum + result.goatcounter, 0)} GoatCounter hits stubbed`;

  if (failed.length) {
    fail(`CSP and accessibility check failed on ${failed.length} of ${summary}.`, failed.map((result) => result.route));
  }
  console.log(`CSP and accessibility check passed: ${summary}.`);
})();
