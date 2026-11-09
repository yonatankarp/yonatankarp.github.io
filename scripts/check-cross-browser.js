#!/usr/bin/env node

// Loads the main routes of the built site in Firefox and WebKit (the CSP check covers Chromium), on a 1440 screen and a
// 390 phone, and fails on a page error, a console error or any of the site's own requests answered with 400 or more.
// Then it tries what has broken in one engine before: "Whole city" handing its focus to the picked chip on a mouse
// click (Safari does not focus a clicked button), the tower's arrow keys (never a key that neither scrolls the card nor
// rides), and a ride in the lift. Run by .github/workflows/cross-browser.yml on GitHub's Linux runners.
//
// Usage: node scripts/check-cross-browser.js [--browsers firefox,webkit] [--base http://127.0.0.1:1313]
// Without --base it serves public/ itself, as check-csp.js does.

const fs = require("fs");
const path = require("path");
const { publicDir, fail, loadPlaywright } = require("./lib");
const { serve } = require("./serve-public");
const { isFailedResponse } = require("./check-csp");

const routes = [
  "/", "/?time=night&season=winter&holiday=hanukkah:3,christmas", "/#floor-L", "/#floor-5", "/#floor-R",
  "/blog/", "/blog/how-hashmap-works-java/", "/projects/", "/podcast/", "/contact/", "/cv/", "/404.html",
];
const sizes = [
  ["1440", { viewport: { width: 1440, height: 900 } }],
  ["390", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true }],   // Firefox has no isMobile
];
const pixel = Buffer.from("R0lGODlhAQABAAAAACw=", "base64");

function option(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index === -1 ? null : process.argv[index + 1];
}

// A page with its problems recorded as they happen: page errors, console errors and the site's failed requests.
async function open(context, baseUrl, problems) {
  const page = await context.newPage();
  page.on("pageerror", (error) => problems.push(`page error: ${error.message}`));
  page.on("console", (message) => message.type() === "error" && problems.push(`console: ${message.text().slice(0, 300)}`));
  page.on("response", (response) => isFailedResponse(response.url(), response.status(), baseUrl) && problems.push(`${response.status()} ${response.url().slice(baseUrl.length)}`));
  await page.route(/goatcounter\.com/, (request) => request.fulfill({ status: 200, contentType: "image/gif", body: pixel }));
  return page;
}

async function load(page, url) {
  await page.goto(url, { waitUntil: "load" });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1000);   // the scenes start after load
}

const floor = (page) => page.evaluate(() => document.querySelector(".building-floor-btn[aria-current=true]")?.dataset.goto);

// Picks the library's chip, clicks "Whole city" with the mouse, and expects the focus on that chip.
async function wholeCity(page, baseUrl) {
  await load(page, `${baseUrl}/`);
  await page.click(".city-chips button[data-pick='library']");
  await page.locator("[data-city-out]:visible").first().click();
  await page.waitForSelector(".city:not(.zoomed)", { timeout: 5000 });
  const focused = await page.evaluate(() => document.activeElement?.matches(".city-chips [data-pick='library']"));
  if (!focused) throw new Error(`Whole city left the focus on ${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 80))}`);
}

// From floor 5, ArrowDown rides down to 4, then ArrowUp scrolls a long card or rides back up to 5: every press must do one.
async function arrows(page, baseUrl) {
  await load(page, `${baseUrl}/#floor-5`);
  const state = () => page.evaluate(() => [
    document.querySelector(".building-floor-btn[aria-current=true]")?.dataset.goto,
    document.activeElement?.closest(".floor-card, .floor-panel")?.scrollTop ?? null,
  ].join(" "));
  const press = async (key) => {
    const before = await state();
    await page.keyboard.press(key);
    for (let waited = 0; await state() === before; waited += 100) {
      if (waited > 4000) throw new Error(`${key} did nothing on floor ${before.split(" ")[0]} (floor and card scroll: ${before})`);
      await page.waitForTimeout(100);
    }
    await page.waitForTimeout(1500);   // the ride or the smooth scroll ends
  };
  await page.evaluate(() => document.activeElement?.blur());   // off the card, which would scroll down first
  await press("ArrowDown");
  if (await floor(page) !== "4") throw new Error(`ArrowDown from floor 5 went to ${await floor(page)}`);
  for (let i = 0; i < 10 && await floor(page) !== "5"; i++) await press("ArrowUp");
  if (await floor(page) !== "5") throw new Error(`ArrowUp never rode back from floor 4 to 5 (on ${await floor(page)})`);
}

// From the lobby, the lift's floor 5 button rides there.
async function ride(page, baseUrl) {
  await load(page, `${baseUrl}/#floor-L`);
  await page.click(".building-floor-btn[data-goto='5']");
  await page.waitForFunction(() => document.querySelector(".building-floor-btn[aria-current=true]")?.dataset.goto === "5", null, { timeout: 8000 })
    .catch(async () => { throw new Error(`the lift went to ${await floor(page)}, not 5`); });
}

async function main() {
  const base = option("base");
  if (!base && !fs.existsSync(path.join(publicDir, "404.html"))) {
    fail("The cross-browser check requires a built public/ directory.", ["Run npm run build first."]);
  }

  const playwright = loadPlaywright("The cross-browser check");
  const own = base ? null : await serve();
  const baseUrl = (base || own.baseUrl).replace(/\/$/, "");
  const failures = [];

  for (const engine of (option("browsers") || "firefox,webkit").split(",")) {
    const browser = await playwright[engine].launch();
    for (const [size, options] of sizes) {
      const context = await browser.newContext({ ...options, isMobile: engine !== "firefox" && options.isMobile, timezoneId: "Europe/Berlin" });
      const tasks = [
        ...routes.map((route) => [route, (page) => load(page, baseUrl + route)]),
        ["Whole city focus", (page) => wholeCity(page, baseUrl)],
        ["tower arrows", (page) => arrows(page, baseUrl)],
        ...(size === "1440" ? [["lift ride", (page) => ride(page, baseUrl)]] : []),
      ];
      for (const [name, task] of tasks) {
        const problems = [];
        const page = await open(context, baseUrl, problems);
        await task(page).catch((error) => problems.push(error.message.split("\n")[0]));
        await page.close();
        console.log(`${problems.length ? "FAIL" : "ok  "} ${engine} ${size} ${name}`);
        for (const problem of problems) console.log(`     ${problem}`);
        if (problems.length) failures.push(`${engine} ${size} ${name}`);
      }
      await context.close();
    }
    await browser.close();
  }

  own?.server.close();
  if (failures.length) fail(`The cross-browser check failed on ${failures.length} pages or interactions.`, failures);
  console.log("The cross-browser check passed.");
}

main();
