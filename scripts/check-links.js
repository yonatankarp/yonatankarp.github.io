#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const checkExternal = process.argv.includes("--external") || process.env.CHECK_EXTERNAL_LINKS === "1";
const htmlFiles = [];
const failures = [];
const externalUrls = new Set();
const externalConcurrency = Number(process.env.LINK_CHECK_CONCURRENCY || 8);
const ignoredSchemes = /^(?:mailto:|tel:|javascript:)/i;
const localOrigins = new Set(["https://yonatankarp.com", "http://yonatankarp.com"]);
const externallyManagedLocalPrefixes = ["/kotlin-design-patterns/"];
const ignoredExternalHosts = new Set(["localhost", "127.0.0.1"]);
const ignoredExternalPatterns = [
  /^https:\/\/news\.ycombinator\.com\/submitlink\b/i,
  /^https:\/\/x\.com\/intent\//i,
  /^https:\/\/www\.linkedin\.com\/sharing\//i,
  /^https:\/\/bsky\.app\/intent\//i,
  /^https:\/\/www\.getyourguide\.com\//i,
];

function fail(message, details = []) {
  console.error(message);
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  process.exit(1);
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".html")) {
      htmlFiles.push(fullPath);
    }
  }
}

function collectAttribute(tag, attributeName) {
  const pattern = new RegExp(`\\b${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = tag.match(pattern);

  return match ? match[1] ?? match[2] ?? match[3] ?? "" : null;
}

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

function routeToPublicPath(pathname) {
  const normalizedPath = decodeURIComponent(pathname);

  if (normalizedPath === "" || normalizedPath === "/") {
    return path.join(publicDir, "index.html");
  }

  const withoutLeadingSlash = normalizedPath.replace(/^\/+/, "");
  const directPath = path.join(publicDir, withoutLeadingSlash);

  if (path.extname(withoutLeadingSlash)) {
    return directPath;
  }

  return path.join(directPath, "index.html");
}

const idCache = new Map();

function idsIn(filePath) {
  if (!idCache.has(filePath)) {
    const html = fs.readFileSync(filePath, "utf8");
    const ids = new Set();

    for (const tagMatch of html.matchAll(/<[a-z][a-z0-9-]*\b[^>]*>/gi)) {
      const id = collectAttribute(tagMatch[0], "id");
      const name = /^<a\b/i.test(tagMatch[0]) ? collectAttribute(tagMatch[0], "name") : null;

      if (id) ids.add(decodeHtml(id));
      if (name) ids.add(decodeHtml(name));
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

async function checkExternalUrl(url) {
  let result = await requestUrl(url, "HEAD");

  if (!result.ok && (result.statusCode === 405 || result.statusCode === 403 || result.statusCode === 404)) {
    result = await requestUrl(url, "GET");
  }

  return result;
}

function isPassingExternalResult(result) {
  return result.ok || result.statusCode === 401 || result.statusCode === 403;
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

walk(publicDir);

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
        externalUrls.add(stripFragment(url.href));
      }
      continue;
    }

    if (isExternallyManagedLocalUrl(url)) {
      if (shouldCheckExternalUrl(url.href)) {
        externalUrls.add(stripFragment(url.href));
      }
      continue;
    }

    const kind = absolute ? "local absolute" : href.startsWith("/") ? "root-relative" : href.startsWith("#") ? "same-page" : "relative";
    checkLocalTarget(route, href, url, kind);
  }
}

if (checkExternal) {
  (async () => {
    const urls = Array.from(externalUrls).sort();

    await mapWithConcurrency(urls, externalConcurrency, async (url) => {
      const result = await checkExternalUrl(url);

      if (!isPassingExternalResult(result)) {
        const reason = result.statusCode ? `HTTP ${result.statusCode}` : result.error;
        failures.push(`external link failed ${url}: ${reason}`);
      }
    });

    if (failures.length > 0) {
      fail("Link check failed:", failures);
    }

    console.log(`Link check passed across ${htmlFiles.length} HTML files and ${externalUrls.size} external URLs.`);
  })();
} else {
  if (failures.length > 0) {
    fail("Link check failed:", failures);
  }

  console.log(`Link check passed across ${htmlFiles.length} HTML files. External probing skipped.`);
}
