#!/usr/bin/env node

// data/timezones.json, which places a visitor without asking them: the browser tells the page their IANA timezone, and
// this table says roughly where that zone is (its main city's latitude and longitude), to one decimal of a degree. The
// head's time pick (layouts/partials/time-pick.html, and scripts/lib.js for the tests) builds its zone table from it, for
// the sun's elevation and the season there.
// Made from the tz database's zone.tab, and its links (tzdata.zi), as browsers may still report an old name such as
// Asia/Calcutta. Run it again after a tzdata release that adds zones: node scripts/gen-timezones.js [zoneinfo dir]
const fs = require("fs");
const path = require("path");
const { rootDir } = require("./lib");

const dir = process.argv[2] ?? "/usr/share/zoneinfo";
const read = (file) => fs.readFileSync(path.join(dir, file), "utf8");

// ISO 6709 coordinates, +DDMM+DDDMM or +DDMMSS+DDDMMSS, to degrees rounded to 0.1.
function degrees(text, width) {
  const sign = text[0] === "-" ? -1 : 1, d = Number(text.slice(1, 1 + width)), m = Number(text.slice(1 + width, 3 + width)), s = Number(text.slice(3 + width) || 0);
  return Math.round(sign * (d + m / 60 + s / 3600) * 10) / 10;
}

const zones = {};
for (const line of read("zone.tab").split("\n")) {
  if (!line || line.startsWith("#")) continue;
  const [, coords, zone] = line.split("\t");
  const [, lat, lon] = coords.match(/^([+-]\d+)([+-]\d+)$/);
  zones[zone] = [degrees(lat, 2), degrees(lon, 3)];
}
const links = {};
for (const line of read("tzdata.zi").split("\n")) {
  const [kind, target, name] = line.split(" ");
  if (kind === "L" && zones[target] && !zones[name]) links[name] = target;
}
const sorted = (o) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
const out = path.join(rootDir, "data", "timezones.json");
fs.writeFileSync(out, `${JSON.stringify({ zones: sorted(zones), links: sorted(links) })}\n`);
console.log(`${path.relative(rootDir, out)}: ${Object.keys(zones).length} zones, ${Object.keys(links).length} links`);
