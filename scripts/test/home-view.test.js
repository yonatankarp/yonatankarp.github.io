// assets/js/home-view.js: where the city map sits, which web3d/src/city.js and the homepage's pre-paint (home-city.js,
// inlined by layouts/index.html) both place it by, so the first paint is where the city then is.
const test = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../../assets/js/home-view.js");

test("the free view's middle is right of a floating panel, else the scene's", async () => {
  const { freeMid } = await load();
  assert.equal(freeMid(1280, null), 640);
  assert.equal(freeMid(1280, 400), 840);
});

test("the whole city opens on the tower, moved right until the Library's label clears the panel, but no further than the tower's stays whole", async () => {
  const { cityView } = await load();
  const tag = (offsetLeft, offsetWidth) => ({ offsetLeft, offsetWidth });   // a label's middle x in the map, and its width
  assert.deepEqual(cityView(640, 1280, tag(1600, 100), tag(1100, 80), null), [-960, 0, 1]);   // on the tower
  assert.deepEqual(cityView(840, 1280, tag(1600, 100), tag(1300, 80), 400), [-760, 0, 1]);    // on the tower: the Library's label is clear
  assert.deepEqual(cityView(840, 1280, tag(1600, 100), tag(1000, 80), 400), [-552, 0, 1]);    // the Library's label 8 px right of the panel
  assert.deepEqual(cityView(840, 1280, tag(1300, 100), tag(500, 80), 400), [-78, 0, 1]);      // but the tower's 8 px inside the right edge
});

test("a district zooms to whole device px an art px, up to maxPx screen px and never under the whole city's", async () => {
  const { districtView } = await load();
  // 694 px tall for 347 art px at dpr 1: 2 device px an art px. A zoom of 1.5 is 3.
  assert.deepEqual(districtView([50, 50, 1.5], 840, 900, 2880, 694, 347, 1, 4, true), [840 - 1440 * 1.5, 900 * 0.46 - 347 * 1.5, 1.5]);
  assert.equal(districtView([50, 50, 1.6], 640, 900, 2880, 694, 347, 1, 4, false)[1], 450 - 347 * 1.5, "3.2 rounds to 3; the scene's middle, with no panel beside it");
  assert.equal(districtView([50, 50, 3], 640, 900, 2880, 694, 347, 1, 4, false)[2], 2, "6 would pass 4 screen px an art px");
  assert.equal(districtView([50, 50, 3], 640, 900, 2880, 694, 347, 1, 1, false)[2], 1, "never under the whole city's 2");
  assert.ok(Math.abs(districtView([50, 50, 1.6], 195, 844, 1440, 347 * 1.2, 347, 3, 4, false)[2] - 6 / 3.6) < 1e-12, "at 3 device px a CSS px: 3.6 device px an art px, 5.76 rounds to 6");
});

test("a view is clamped so no edge of the map shows", async () => {
  const { clampView } = await load();
  assert.deepEqual(clampView([100, 50, 1], 1280, 900, 2880, 694), [0, 0, 1]);
  assert.deepEqual(clampView([-5000, -900, 2], 1280, 900, 2880, 694), [1280 - 5760, 900 - 1388, 2]);
  assert.deepEqual(clampView([-300, -100, 2], 1280, 900, 2880, 694), [-300, -100, 2]);
});
