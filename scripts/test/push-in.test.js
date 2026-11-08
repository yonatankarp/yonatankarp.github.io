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

test("the Library's head: 720x173 art px to 52vh, and 38vh on a phone", () => {
  const [vh, h, w] = numbers(css, /\.library-hero \{ min-height: min\((\d+)vh, (\d+) \* round\(up, 100vw \/ (\d+),/, "custom.css's .library-hero");
  const [phone, phoneVh] = numbers(css, /@media \(max-width: (\d+)px\) \{[^@]*?\.library-hero \{ min-height: (\d+)vh; \}/, "custom.css's phone .library-hero");
  const js = numbers(city, /library: \(\) => \(\{ x: innerWidth \/ 2, y: \(innerWidth <= (\d+) \? innerHeight \* 0\.(\d+) : Math\.min\(innerHeight \* 0\.(\d+), (\d+) \* Math\.ceil\(devicePixelRatio \* innerWidth \/ (\d+)\)/, "city.js's next.library");
  assert.deepEqual(js, [phone, phoneVh, vh, h, w]);
});

test("the Radio Mast's and the Post Office's room: 1440:347, from 230 to 480 px tall", () => {
  const [min, h, w, max] = numbers(css, /\.room-hero \{[^}]*height: calc\(clamp\((\d+)px, 100vw \* (\d+) \/ (\d+), (\d+)px\)/, "custom.css's .room-hero");
  const js = numbers(city, /radio: \(\) => \(\{ x: innerWidth \/ 2, y: Math\.min\((\d+), Math\.max\((\d+), innerWidth \* (\d+) \/ (\d+)\)\)/, "city.js's next.radio");
  assert.deepEqual(js, [max, min, h, w]);
});

test("Workshop Row opens on the workshop whose label city.js lands by", () => {
  const first = read("data/rooms.yaml").match(/^ {2}groups:.*\n {4}- key: "(\w+)"/m)[1];   // bay-1's (layouts/projects/list.html)
  assert.equal(read("web3d/src/workshop.js").match(/panning\(row, '(\w+)'/)[1], first);
  assert.match(city, /ROW\.labels\['bay-1'\]/);
});
