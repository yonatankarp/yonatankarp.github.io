// The city's push-in (web3d/src/city.js's `next`) ends where the district's page puts its room header, so the frame it
// hands on lines up: the Library's head and the Radio Mast's and the Post Office's room, whose sizes are custom.css's,
// and Workshop Row's Apps door, whose label is the first workshop's. city.js cannot read the CSS, so its copies of those
// numbers are held to it here.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const read = (file) => fs.readFileSync(path.join(__dirname, "../..", file), "utf8");
const css = read("assets/css/custom.css"), city = read("web3d/src/city.js");
const numbers = (src, re, what) => {
  const m = src.match(re);
  assert.ok(m, `${what} not found: update this test with it`);
  return m.slice(1).map(Number);
};

test("the Library's head: 720x173 art px to 52vh, at least 3 CSS px an art px on a wide screen, and 38vh on a phone", () => {
  const [m, vh, h, w] = numbers(css, /\.library-hero \{ --m: (\d+)px;[^}]*min-height: min\((\d+)vh, (\d+) \* max\(round\(up, 100vw \/ (\d+),/, "custom.css's .library-hero");
  assert.match(css, /@media \(max-width: 760px\), \(max-aspect-ratio: 6\/5\) \{ \.library-hero \{ --m: 0px;/, "custom.css's narrow .library-hero: art.js's narrow, which city.js reads");
  const [phone, phoneVh] = numbers(css, /@media \(max-width: (\d+)px\) \{[^@]*?\.library-hero \{ min-height: (\d+)vh; \}/, "custom.css's phone .library-hero");
  const js = numbers(city, /library: \(\) => \(\{ x: innerWidth \/ 2, y: \(innerWidth <= (\d+) \? innerHeight \* 0\.(\d+) : Math\.min\(innerHeight \* 0\.(\d+), (\d+) \* Math\.max\(Math\.ceil\(devicePixelRatio \* innerWidth \/ (\d+)\) \/ devicePixelRatio, narrow\.matches \? 0 : (\d+)\)/, "city.js's next.library");
  assert.deepEqual(js, [phone, phoneVh, vh, h, w, m]);
});

test("the Radio Mast's and the Post Office's room: 1440:347, to 52vh at 1.5 CSS px an art px (the Radio Mast's 1 under 1400px) on a wide screen, else 230 to 480 px", () => {
  const [m, min, vh, h, w] = numbers(css, /\.room-hero \{[^}]*--m: round\(down, ([\d.]+)px, 0\.5px \/ var\(--dpr, 1\)\);[^}]*height: calc\(clamp\((\d+)px, (\d+)vh, (\d+) \* max\(round\(up, 100vw \/ (\d+), 0\.5px \/ var\(--dpr, 1\)\), var\(--m\)\)\)/, "custom.css's .room-hero");
  const [under, radio] = numbers(css, /@media \(max-width: (\d+)px\) \{ \.room-hero--radio \{ --m: round\(down, ([\d.]+)px, 0\.5px \/ var\(--dpr, 1\)\); \} \}/, "custom.css's narrower Radio Mast");
  const [nMin, nH, nW, nMax] = numbers(css, /@media \(max-width: 760px\), \(max-aspect-ratio: 6\/5\) \{ \.room-hero \{ --m: 0px; --x: 720; height: calc\(clamp\((\d+)px, 100vw \* (\d+) \/ (\d+), (\d+)px\)/, "custom.css's narrow .room-hero");
  const [jsUnder, jsRadio, jsM, jsPost] = numbers(city, /radio: \(\) => roomHead\(innerWidth < (\d+) \? ([\d.]+) : ([\d.]+)\),\s*post: \(\) => roomHead\(([\d.]+)\)/, "city.js's next.radio and next.post");
  assert.deepEqual([jsUnder, jsRadio, jsM, jsPost], [under + 1, radio, m, m]);
  const js = numbers(city, /const roomHead = \(m, k = 2 \* devicePixelRatio\) => \(\{ x: innerWidth \/ 2, y: \(narrow\.matches \? Math\.min\((\d+), Math\.max\((\d+), innerWidth \* (\d+) \/ (\d+)\)\) : Math\.max\((\d+), Math\.min\(innerHeight \* 0\.(\d+), (\d+) \* Math\.max\(Math\.ceil\(k \* innerWidth \/ (\d+)\), Math\.floor\(k \* m\)\) \/ k/, "city.js's roomHead");
  assert.deepEqual(js, [nMax, nMin, nH, nW, min, vh, h, w]);
});

test("Workshop Row opens on the workshop whose label city.js lands by", () => {
  // The first chip is the first of data/rooms.yaml's groups, in bay-1 (layouts/projects/list.html).
  assert.match(read("web3d/src/workshop.js"), /panning\(row, row\.querySelector\('\[data-pick\]'\)\.dataset\.pick,/);
  assert.match(city, /ROW\.labels\['bay-1'\]/);
});
