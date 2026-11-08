#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { publicDir, fail, walk, collectAttribute, routeToPublicPath } = require("./lib");

const checkExternal = process.argv.includes("--external") || process.env.CHECK_EXTERNAL_LINKS === "1";
const failures = [];
const externalUrls = new Map();   // URL -> the first page linking to it
const externalConcurrency = Number(process.env.LINK_CHECK_CONCURRENCY || 8);
const wantsOutput = process.argv.includes("--github-output");
// Rate limiting, an overloaded server and LinkedIn's bot wall say nothing about whether the page exists.
const softStatuses = [429, 503, 999];
const retryDelayMs = 3000;
const ignoredSchemes = /^(?:mailto:|tel:|javascript:)/i;
const subresourceTags = /<(?:img|source|video|audio|script|iframe|track|embed|input|link)\b[^>]*>/gi;
const fetchingLinkRels = new Set(["stylesheet", "preload", "modulepreload", "prefetch", "icon", "apple-touch-icon", "mask-icon", "manifest"]);
const localOrigins = new Set(["https://yonatankarp.com", "http://yonatankarp.com"]);
const externallyManagedLocalPrefixes = ["/kotlin-design-patterns/", "/ff4k/", "/mimic/", "/lorekeeper/", "/TaleKeeper/"];
const ignoredExternalHosts = new Set(["localhost", "127.0.0.1"]);
const ignoredExternalPatterns = [
  /^https:\/\/news\.ycombinator\.com\/submitlink\b/i,
  /^https:\/\/x\.com\/intent\//i,
  /^https:\/\/www\.linkedin\.com\/sharing\//i,
  /^https:\/\/bsky\.app\/intent\//i,
  /^https:\/\/www\.getyourguide\.com\//i,
];

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function stripFragment(value) {
  const hashIndex = value.indexOf("#");
  return hashIndex === -1 ? value : value.slice(0, hashIndex);
}

const idCache = new Map();

function idsIn(filePath) {
  if (!idCache.has(filePath)) {
    const html = fs.readFileSync(filePath, "utf8");
    const ids = new Set();

    for (const tagMatch of html.matchAll(/<[a-z][a-z0-9-]*\b[^>]*>/gi)) {
      const id = collectAttribute(tagMatch[0], "id");
      const name = /^<a\b/i.test(tagMatch[0]) ? collectAttribute(tagMatch[0], "name") : null;

      // A city label's key is a target too: the homepage's pre-paint reads /#KEY as "back from that district" (#305).
      const pick = /\bcity-tag\b/.test(collectAttribute(tagMatch[0], "class") ?? "") ? collectAttribute(tagMatch[0], "data-pick") : null;

      if (id) ids.add(decodeHtml(id));
      if (name) ids.add(decodeHtml(name));
      if (pick) ids.add(decodeHtml(pick));
    }

    idCache.set(filePath, ids);
  }

  return idCache.get(filePath);
}

// "#" and "#top" scroll to the top of any page; anything else must name an element in the target.
function hasFragmentTarget(filePath, hash) {
  const fragment = hash.slice(1);

  if (fragment === "" || fragment.toLowerCase() === "top") {
    return true;
  }

  const ids = idsIn(filePath);

  if (ids.has(fragment)) {
    return true;
  }

  try {
    return ids.has(decodeURIComponent(fragment));
  } catch {
    return false;
  }
}

function checkLocalTarget(route, href, url, kind) {
  let targetPath;

  try {
    targetPath = routeToPublicPath(url.pathname);
  } catch {
    failures.push(`${route}: ${kind} link has a malformed path ${href}`);
    return;
  }

  if (!fs.existsSync(targetPath)) {
    failures.push(`${route}: ${kind} link points to missing page ${href}`);
    return;
  }

  if (url.hash && targetPath.endsWith(".html") && !hasFragmentTarget(targetPath, url.hash)) {
    failures.push(`${route}: ${kind} link points to missing anchor ${href}`);
  }
}

function isExternallyManagedLocalUrl(url) {
  return externallyManagedLocalPrefixes.some((prefix) => url.pathname === prefix || url.pathname.startsWith(prefix));
}

// The URLs a tag makes the browser load with the page: src, poster, each srcset candidate, and a <link>'s href when its
// rel fetches something. Canonical, alternate and the like name pages rather than load them.
function subresourceUrls(tag) {
  const name = tag.match(/^<([a-z]+)/i)[1].toLowerCase();

  if (name === "link") {
    const rels = (collectAttribute(tag, "rel") ?? "").toLowerCase().split(/\s+/);
    const href = collectAttribute(tag, "href");
    return href !== null && rels.some((rel) => fetchingLinkRels.has(rel)) ? [["link href", href]] : [];
  }

  const urls = [];

  for (const attribute of ["src", "poster"]) {
    const value = collectAttribute(tag, attribute);
    if (value !== null) urls.push([`${name} ${attribute}`, value]);
  }

  for (const candidate of (collectAttribute(tag, "srcset") ?? "").split(",")) {
    const url = candidate.trim().split(/\s+/)[0];
    if (url) urls.push([`${name} srcset`, url]);
  }

  return urls;
}

function checkSubresource(route, pageUrl, what, rawValue) {
  const value = decodeHtml(rawValue.trim());

  if (value === "" || /^(?:data|blob):/i.test(value)) {
    return;
  }

  let url;
  let targetPath;

  try {
    url = new URL(value, pageUrl);
    targetPath = routeToPublicPath(url.pathname);
  } catch {
    failures.push(`${route}: ${what} has a malformed URL ${value}`);
    return;
  }

  if (!localOrigins.has(url.origin) || isExternallyManagedLocalUrl(url)) {
    return;
  }

  if (!fs.existsSync(targetPath)) {
    failures.push(`${route}: ${what} points to missing file ${value}`);
  }
}

async function requestUrl(url, method) {
  try {
    const response = await fetch(url, {
      method,
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: {
        "User-Agent": "yonatankarp.com-link-check/1.0",
      },
    });

    return { ok: response.status >= 200 && response.status < 400, statusCode: response.status };
  } catch (error) {
    return { ok: false, error: error.message };
  }
}

function addExternalUrl(url, route) {
  if (!externalUrls.has(url)) {
    externalUrls.set(url, route);
  }
}

async function probeExternalUrl(url) {
  let result = await requestUrl(url, "HEAD");

  if (!result.ok && [403, 404, 405, ...softStatuses].includes(result.statusCode)) {
    result = await requestUrl(url, "GET");
  }

  return result;
}

// One retry, a moment later, before a link counts as broken: third-party sites drop the odd request.
async function checkExternalUrl(url) {
  const result = await probeExternalUrl(url);

  if (isPassingExternalResult(result)) {
    return result;
  }

  await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
  return probeExternalUrl(url);
}

function isPassingExternalResult(result) {
  return result.ok || result.statusCode === 401 || result.statusCode === 403;
}

function warn(message) {
  console.warn(process.env.GITHUB_ACTIONS ? `::warning title=External link::${message}` : `warning: ${message}`);
}

// The weekly External links workflow turns failures into one issue, edited in place.
function writeGithubOutput(entries) {
  const delimiter = `EOF_${crypto.randomBytes(8).toString("hex")}`;
  let payload = "";

  for (const [key, value] of Object.entries(entries)) {
    payload += value.includes("\n") ? `${key}<<${delimiter}\n${value}\n${delimiter}\n` : `${key}=${value}\n`;
  }

  fs.appendFileSync(process.env.GITHUB_OUTPUT, payload);
}

function renderIssue(urlCount) {
  const body = [
    `The weekly external link check of ${urlCount} URLs found ${failures.length === 1 ? "a link" : "links"} that failed twice:`,
    "",
    ...failures.map((failure) => `- ${failure}`),
    "",
    `Rate limits and bot blocking (HTTP ${softStatuses.join(", ")}) are left out; they show as warnings on the run.`,
    "Fix or remove each link, and this issue closes itself on the next clean run.",
    "",
    "<!-- opened and updated by .github/workflows/external-links.yml -->",
  ];

  return { title: `${failures.length} external ${failures.length === 1 ? "link is" : "links are"} broken`, body: body.join("\n") };
}

function shouldCheckExternalUrl(value) {
  const url = new URL(value);

  if (ignoredExternalHosts.has(url.hostname)) {
    return false;
  }

  return !ignoredExternalPatterns.some((pattern) => pattern.test(value));
}

async function mapWithConcurrency(values, concurrency, callback) {
  const results = [];
  let cursor = 0;

  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await callback(values[index], index);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

if (!fs.existsSync(publicDir)) {
  fail("Link check requires a built public/ directory.", ["Run npm run build first."]);
}

if (wantsOutput && !process.env.GITHUB_OUTPUT) {
  fail("--github-output needs GITHUB_OUTPUT set; run this without the flag locally.");
}

const htmlFiles = walk(publicDir, ".html");
let subresourceCount = 0;

for (const filePath of htmlFiles) {
  const html = fs.readFileSync(filePath, "utf8");
  const relativePath = path.relative(publicDir, filePath);
  const route = `/${relativePath.replace(/index\.html$/, "").replace(/404\.html$/, "404.html")}`;

  const pageUrl = new URL(route, "https://yonatankarp.com");

  for (const linkMatch of html.matchAll(/<a\b[^>]*>/gi)) {
    const tag = linkMatch[0];
    const rawHref = collectAttribute(tag, "href");

    if (rawHref === null || ignoredSchemes.test(rawHref)) {
      continue;
    }

    const href = decodeHtml(rawHref);
    const absolute = /^https?:\/\//i.test(href);
    let url;

    try {
      url = new URL(href, pageUrl);
    } catch {
      failures.push(`${route}: link has a malformed URL ${href}`);
      continue;
    }

    if (!localOrigins.has(url.origin)) {
      if (/^https?:$/.test(url.protocol) && shouldCheckExternalUrl(url.href)) {
        addExternalUrl(stripFragment(url.href), route);
      }
      continue;
    }

    if (isExternallyManagedLocalUrl(url)) {
      if (shouldCheckExternalUrl(url.href)) {
        addExternalUrl(stripFragment(url.href), route);
      }
      continue;
    }

    const kind = absolute ? "local absolute" : href.startsWith("/") ? "root-relative" : href.startsWith("#") ? "same-page" : "relative";
    checkLocalTarget(route, href, url, kind);
  }

  // An inline script's text is code, not markup, so its tag-like strings are left out.
  const markup = html.replace(/(<script\b[^>]*>)[\s\S]*?<\/script>/gi, "$1</script>");

  for (const tagMatch of markup.matchAll(subresourceTags)) {
    for (const [what, value] of subresourceUrls(tagMatch[0])) {
      checkSubresource(route, pageUrl, what, value);
      subresourceCount += 1;
    }
  }
}

if (checkExternal) {
  (async () => {
    const urls = Array.from(externalUrls.keys()).sort();
    const warnings = [];

    await mapWithConcurrency(urls, externalConcurrency, async (url) => {
      const result = await checkExternalUrl(url);

      if (!isPassingExternalResult(result)) {
        const reason = result.statusCode ? `HTTP ${result.statusCode}` : result.error;
        const line = `${externalUrls.get(url)} links to ${url}: ${reason}`;
        (softStatuses.includes(result.statusCode) ? warnings : failures).push(line);
      }
    });

    warnings.sort().forEach(warn);
    failures.sort();

    if (wantsOutput) {
      writeGithubOutput(failures.length ? { status: "broken", ...renderIssue(urls.length) } : { status: "clean" });
    }

    if (failures.length > 0) {
      // With --github-output the issue is the report, so the run itself stays green.
      if (wantsOutput) {
        console.error(["Link check failed:", ...failures.map((failure) => `- ${failure}`)].join("\n"));
        process.exit(0);
      }
      fail("Link check failed:", failures);
    }

    console.log(`Link check passed across ${htmlFiles.length} HTML files, ${subresourceCount} subresources and ${externalUrls.size} external URLs, ${warnings.length} warned.`);
  })();
} else {
  if (failures.length > 0) {
    fail("Link check failed:", failures);
  }

  console.log(`Link check passed across ${htmlFiles.length} HTML files and ${subresourceCount} subresources. External probing skipped.`);
}
