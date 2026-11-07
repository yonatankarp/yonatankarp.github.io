// web3d/src/props.js: which of the hanukkiah's candles burn on each night of Hanukkah.
const test = require("node:test");
const assert = require("node:assert/strict");
const art = require("../../static/building/pixel/props.json");

const load = () => import("../../web3d/src/props.js");
// Nine candle tops, left to right as you face it, the shamash raised in the middle (as gen_props.py bakes them).
const FLAMES = [[0, 4], [4, 4], [7, 4], [10, 4], [15, 0], [20, 4], [23, 4], [26, 4], [29, 4]];

test("The first night: the shamash and the rightmost candle", async () => {
  const { candles } = await load();
  assert.deepEqual(candles(FLAMES, 0), [4, 8]);
});

test("Each night adds the next candle to the left, up to all eight on the eighth", async () => {
  const { candles } = await load();
  for (let day = 0; day < 8; day++) {
    const lit = candles(FLAMES, day);
    assert.equal(lit.length, day + 2, `night ${day + 1}: the shamash and ${day + 1} candles`);
    assert.equal(lit[0], 4);
    assert.deepEqual(lit.slice(1).sort((a, b) => a - b), [8, 7, 6, 5, 3, 2, 1, 0].slice(0, day + 1).sort((a, b) => a - b));
  }
  assert.deepEqual(candles(FLAMES, 9).length, 9);   // a pinned day past the eighth lights no more than all of them
});

test("The baked hanukkiah has nine candle tops, left to right, the shamash's the highest", () => {
  const { flames } = art.hanukkiah;
  assert.equal(flames.length, 9);
  assert.deepEqual(flames.map(([x]) => x), [...flames.map(([x]) => x)].sort((a, b) => a - b));
  assert.equal(Math.min(...flames.map(([, y]) => y)), flames[4][1]);
});

const phases = require("../../data/phases.json");
const at = (time, holidays, season = "winter") => ({ holidays, time, season });

test("No holiday, no props: nothing goes up and no candle burns", async () => {
  const { dressing } = await load();
  assert.deepEqual(dressing(art, at("night", {})), { hanukkiah: false, candles: [], tree: null, lit: true, night: true, tint: [0.6, 0.63, 0.78] });
});

test("Hanukkah puts up the hanukkiah, Christmas the tree, and both at once", async () => {
  const { dressing } = await load();
  const up = (holidays) => { const d = dressing(art, at("day", holidays)); return [d.hanukkiah, d.tree]; };
  assert.deepEqual(up({ hanukkah: 2 }), [true, null]);
  assert.deepEqual(up({ christmas: 5 }), [false, "tree"]);
  assert.deepEqual(up({ hanukkah: 2, christmas: 5 }), [true, "tree"]);
});

test("The tree is snowy in winter only: a southern Christmas, in summer, gets the plain one", async () => {
  const { dressing } = await load();
  assert.equal(dressing(art, at("dusk", { christmas: 0 }, "winter")).tree, "tree");
  for (const season of ["spring", "summer", "autumn"]) assert.equal(dressing(art, at("dusk", { christmas: 0 }, season)).tree, "tree-plain");
});

test("The candles and the lights burn at dusk and night only, the day's candles from the baked tops", async () => {
  const { dressing, candles } = await load();
  for (const time of ["dawn", "day"]) {
    assert.equal(dressing(art, at(time, { hanukkah: 3 })).lit, false);
    assert.deepEqual(dressing(art, at(time, { hanukkah: 3 })).candles, []);
  }
  for (const time of ["dusk", "night"]) {
    assert.equal(dressing(art, at(time, { hanukkah: 3 })).lit, true);
    assert.deepEqual(dressing(art, at(time, { hanukkah: 3 })).candles, candles(art.hanukkiah.flames, 3));
  }
  assert.equal(dressing(art, at("dusk", {})).night, false);
});

test("Every phase has a tint, the props painted in dusk's light", async () => {
  const { dressing } = await load();
  for (const time of Object.keys(phases)) assert.equal(dressing(art, at(time, {})).tint.length, 3, `no tint for ${time}`);
  assert.deepEqual(dressing(art, at("dusk", {})).tint, [1, 1, 1]);
});
