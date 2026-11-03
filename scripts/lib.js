// What the scripts in this folder share: the repository's folders, failing with a reason, walking a folder, reading an
// attribute from a tag, loading Playwright, and finding the Hugo to run.

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
// The pinned release in .tools/hugo/hugo when it is there (gitignored, see CLAUDE.md), else whichever hugo is on the PATH.
const localHugo = path.join(rootDir, ".tools", "hugo", "hugo");
const hugoBinary = fs.existsSync(localHugo) ? localHugo : "hugo";

// Prints the message, then each detail as a list item, and exits with 1.
function fail(message, details = []) {
  console.error(message);
  for (const detail of details) {
    console.error(`- ${detail}`);
  }
  process.exit(1);
}

// Every file under dir whose name ends with ext, folder by folder in the order readdir gives them.
function walk(dir, ext) {
  const files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(fullPath, ext));
    } else if (entry.isFile() && entry.name.endsWith(ext)) {
      files.push(fullPath);
    }
  }

  return files;
}

// An attribute's value in an HTML tag, quoted or not; "" when it is empty, null when the tag has no value for it.
// Reads the tag attribute by attribute, so data-href= or a quoted title="see href=z" is never taken for href (#252).
// The first of a repeated attribute wins, as in a browser.
function collectAttribute(tag, attributeName) {
  const wanted = attributeName.toLowerCase();
  const attribute = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  attribute.lastIndex = tag.match(/^<\/?[^\s>/]*/)[0].length;

  for (let match = attribute.exec(tag); match; match = attribute.exec(tag)) {
    if (match[1].toLowerCase() === wanted) {
      return match[2] ?? match[3] ?? match[4] ?? null;
    }
  }

  return null;
}

// The built file a site path is served from: a folder's index.html, or the file itself when the path has an extension.
// Takes a URL's pathname, so the query and fragment are already gone; percent escapes are decoded.
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

// Playwright, or a failure that says how to install it; what names the script's job in that message.
function loadPlaywright(what) {
  try {
    return require("playwright");
  } catch {
    fail(`${what} requires Playwright.`, [
      "Install local dependencies with npm ci.",
      "Install a browser with npx playwright install chromium.",
    ]);
  }
}

module.exports = { rootDir, publicDir, hugoBinary, fail, walk, collectAttribute, routeToPublicPath, loadPlaywright };
