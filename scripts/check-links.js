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
const ignoredExternalHosts = new Set(["localhost", "127.0.0.1"]);
const ignoredExternalPatterns = [
  /^https:\/\/news\.ycombinator\.com\/submitlink\b/i,
  /^https:\/\/x\.com\/intent\//i,
  /^https:\/\/www\.linkedin\.com\/sharing\//i,
  /^https:\/\/bsky\.app\/intent\//i,
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

function routeToPublicPath(routePath) {
  const normalizedPath = decodeURIComponent(stripFragment(routePath));

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

  for (const linkMatch of html.matchAll(/<a\b[^>]*>/gi)) {
    const tag = linkMatch[0];
    const rawHref = collectAttribute(tag, "href");

    if (!rawHref || rawHref.startsWith("#") || ignoredSchemes.test(rawHref)) {
      continue;
    }

    const href = decodeHtml(rawHref);

    if (/^https?:\/\//i.test(href)) {
      const url = new URL(href);

      if (localOrigins.has(url.origin)) {
        const targetPath = routeToPublicPath(`${url.pathname}${url.search}`);

        if (!fs.existsSync(targetPath)) {
          failures.push(`${route}: local absolute link points to missing page ${href}`);
        }
      } else if (shouldCheckExternalUrl(href)) {
        externalUrls.add(stripFragment(href));
      }

      continue;
    }

    if (href.startsWith("/")) {
      const targetPath = routeToPublicPath(href);

      if (!fs.existsSync(targetPath)) {
        failures.push(`${route}: root-relative link points to missing page ${href}`);
      }
    }
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
