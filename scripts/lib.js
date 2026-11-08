// What the scripts in this folder share: the repository's folders, failing with a reason, walking a folder, reading an
// attribute from a tag and a Markdown file's front matter, loading Playwright, finding the Hugo to run, and running the
// page's time-of-day pick.

const fs = require("fs");
const path = require("path");
const vm = require("vm");

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

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// A Markdown file's front matter (between --- or +++ lines, after an optional BOM) and its body. Without front matter: "" and
// the whole file.
function splitFrontMatter(content) {
  const normalizedContent = content.replace(/^\uFEFF/, "");
  const openerMatch = normalizedContent.match(/^(---|\+\+\+)[^\r\n]*(?:\r?\n|$)/);

  if (!openerMatch) {
    return { frontMatter: "", body: content };
  }

  const marker = openerMatch[1];
  const bodyStart = openerMatch[0].length;
  const closingPattern = new RegExp(`(?:^|\\r?\\n)${escapeRegex(marker)}\\s*(?:\\r?\\n|$)`);
  const closingMatch = normalizedContent.slice(bodyStart).match(closingPattern);

  if (!closingMatch || closingMatch.index === undefined) {
    return { frontMatter: "", body: content };
  }

  const frontMatterEnd = bodyStart + closingMatch.index;
  const bodyOffset = frontMatterEnd + closingMatch[0].length;

  return {
    frontMatter: normalizedContent.slice(bodyStart, frontMatterEnd),
    body: normalizedContent.slice(bodyOffset),
  };
}

// A one-line value from front matter: the first `key:` at any indent (so params.button's btnText is btnText), without its
// quotes or a trailing # comment; undefined when no line sets it.
function frontMatterValue(frontMatter, key) {
  const match = frontMatter.match(new RegExp(`^[ \\t]*${escapeRegex(key)}:[ \\t]*(?:"([^"\\n]*)"|([^\\n]*?))(?:[ \\t]+#[^\\n]*)?[ \\t]*$`, "m"));
  return match ? match[1] ?? match[2] : undefined;
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

// The zone table layouts/partials/time-pick.html builds from data/timezones.json: each zone and link's main city, to whole
// degrees (halves away from zero, as Hugo rounds), grouped by the zone's folder ("Europe/": "... Berlin53,13 ...").
function zoneTable() {
  const round = (x) => Math.sign(x) * Math.round(Math.abs(x)) || 0;
  const { zones, links } = require("../data/timezones.json");
  const table = {};
  for (const [name, [lat, lon]] of Object.entries({ ...zones, ...Object.fromEntries(Object.entries(links).map(([link, to]) => [link, zones[to]])) })) {
    const i = name.lastIndexOf("/") + 1, dir = name.slice(0, i);
    table[dir] = `${table[dir] ? `${table[dir]} ` : ""}${name.slice(i)}${round(lat)},${round(lon)}`;
  }
  return table;
}

// The time-of-day pick (assets/js/time-pick.js) run as a page runs it, for a visitor in zone (undefined: none) at instant
// ms with query (?time=, ?season=): the phase and the season it sets, and its sunPhase(ms, lat, lon). It runs that file with
// zoneTable() written in, then assets/js/sun.js and season.js without their exports, as layouts/partials/time-pick.html puts them.
let defaultPick;
function runTimePick({ zone, ms, query = "" }) {
  const js = (name) => fs.readFileSync(path.join(rootDir, "assets", "js", name), "utf8");
  const script = defaultPick ??= js("time-pick.js").replace("ZONES", JSON.stringify(zoneTable())) + js("sun.js").replace("export ", "") + js("season.js").replace("export ", "");
  const documentElement = { dataset: {} };
  const context = vm.createContext({
    URLSearchParams,
    location: { search: query },
    document: { documentElement },
    Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: zone }) }) },
    Date: class extends Date { constructor(...a) { super(...(a.length ? a : [ms])); } static now() { return ms; } },
  });
  vm.runInContext(script, context);
  return { time: documentElement.dataset.time, season: documentElement.dataset.season, place: documentElement.dataset.place, art: documentElement.dataset.art, sunPhase: context.sunPhase };
}

module.exports = { rootDir, publicDir, hugoBinary, fail, walk, collectAttribute, routeToPublicPath, escapeRegex, splitFrontMatter, frontMatterValue, loadPlaywright, zoneTable, runTimePick };
