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
