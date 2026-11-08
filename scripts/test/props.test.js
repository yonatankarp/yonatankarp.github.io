// web3d/src/props.js: which of the hanukkiah's candles burn on each night of Hanukkah, what each holiday puts up and
// when, and how a firework burst runs through its frames.
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
const at = (time, holidays, season = "winter", more = {}) => ({ holidays, time, season, ...more });

test("No holiday, nothing up", async () => {
  const { dressing } = await load();
  assert.deepEqual(dressing(at("night", {})), { hanukkiah: false, tree: null, pumpkins: false, ghosts: false, bats: false, fireworks: false,
    lit: true, night: true, tint: [0.6, 0.63, 0.78] });
});

test("Hanukkah puts up the hanukkiah, Christmas the tree, and both at once", async () => {
  const { dressing } = await load();
  const up = (holidays) => { const d = dressing(at("day", holidays)); return [d.hanukkiah, d.tree]; };
  assert.deepEqual(up({ hanukkah: 2 }), [true, null]);
  assert.deepEqual(up({ christmas: 5 }), [false, "tree"]);
  assert.deepEqual(up({ hanukkah: 2, christmas: 5 }), [true, "tree"]);
});

test("The tree is snowy in winter only: a southern Christmas, in summer, gets the plain one", async () => {
  const { dressing } = await load();
  assert.equal(dressing(at("dusk", { christmas: 0 }, "winter")).tree, "tree");
  for (const season of ["spring", "summer", "autumn"]) assert.equal(dressing(at("dusk", { christmas: 0 }, season)).tree, "tree-plain");
});

test("The candles, the lights and the lanterns burn at dusk and night only", async () => {
  const { dressing } = await load();
  for (const time of ["dawn", "day"]) assert.equal(dressing(at(time, { hanukkah: 3 })).lit, false);
  for (const time of ["dusk", "night"]) assert.equal(dressing(at(time, { hanukkah: 3 })).lit, true);
  assert.equal(dressing(at("dusk", {})).night, false);
});

test("Halloween: the lanterns all day, the ghosts and the bats at dusk and night, in any season", async () => {
  const { dressing } = await load();
  const up = (time, season) => { const d = dressing(at(time, { halloween: 7 }, season)); return [d.pumpkins, d.ghosts, d.bats]; };
  assert.deepEqual(up("day", "autumn"), [true, false, false]);
  assert.deepEqual(up("dawn", "autumn"), [true, false, false]);
  assert.deepEqual(up("dusk", "autumn"), [true, true, true]);
  assert.deepEqual(up("night", "spring"), [true, true, true]);   // the south's late October
  assert.deepEqual(up("night", "winter"), [true, true, true]);   // only pinned (?season=winter&holiday=halloween): nothing of its own, nothing breaks
  assert.deepEqual(dressing(at("night", { halloween: 0, hanukkah: 0, christmas: 0 })).pumpkins, true);   // a pin can put all three up
});

test("Fireworks on the night of 31 December only: past its sunset, and before noon on 1 January, in the dark", async () => {
  const { dressing } = await load();
  const fw = (day, time, evening, afternoon) => dressing(at(time, { "new-year": day }, "winter", { evening, afternoon })).fireworks;
  assert.equal(fw(0, "dusk", true, true), true);      // 31 December, the sun just set
  assert.equal(fw(0, "night", true, true), true);
  assert.equal(fw(0, "dusk", false, true), false);    // the afternoon's dusk, the sun still up
  assert.equal(fw(0, "night", false, false), false);  // the small hours of 31 December: the night before
  assert.equal(fw(1, "night", false, false), true);   // the small hours of 1 January: the same night, its peak
  assert.equal(fw(1, "dawn", false, false), false);   // dark enough no longer
  assert.equal(fw(1, "night", true, true), false);    // 1 January's own evening
  assert.equal(fw(0, "day", true, false), false);
  assert.equal(dressing(at("night", {})).fireworks, false);
});

test("A pin is that night at any hour: outside.js gives it evening and no afternoon", async () => {
  const { dressing } = await load();
  const pinned = (day, time) => dressing(at(time, { "new-year": day }, "winter", { evening: true, afternoon: false })).fireworks;
  assert.deepEqual(["dusk", "night"].map((time) => pinned(0, time)), [true, true]);
  assert.equal(pinned(1, "night"), true);
  assert.equal(pinned(0, "day"), false);   // ?time= still rules: no fireworks by day
});

test("A burst grows fast, then fades slowly, then is gone; and no frame is too short for the city's slowest draws", async () => {
  const { burstFrame, BURST } = await load();
  assert.deepEqual([0, 69, 70, 349].map((ms) => burstFrame(ms, 5, 9)), [0, 0, 1, 4]);
  assert.equal(burstFrame(350, 5, 9), 5);
  assert.equal(burstFrame(350 + 4 * BURST.fade - 1, 5, 9), 8);
  assert.equal(burstFrame(350 + 4 * BURST.fade, 5, 9), -1);
  assert.ok(Math.min(BURST.grow, BURST.fade) >= 1000 / 15, "a frame shorter than the city's 15 draws a second would be skipped");
});

test("Every phase has a tint, the props painted in dusk's light", async () => {
  const { dressing } = await load();
  for (const time of Object.keys(phases)) assert.equal(dressing(at(time, {})).tint.length, 3, `no tint for ${time}`);
  assert.deepEqual(dressing(at("dusk", {})).tint, [1, 1, 1]);
});

test("Missing art leaves the plaza bare, and art that is there but broken is a page error (#311)", async (t) => {
  const { props } = await load();
  const url = (name) => (ext) => `${name}.${ext}`;
  t.mock.method(globalThis, "fetch", async () => new Response("", { status: 404 }));
  assert.deepEqual(await props(url, at("night", { hanukkah: 2, halloween: 1, "new-year": 0 }, "winter", { evening: true })), []);
  assert.deepEqual(await props(url, at("night", {})), []);
  t.mock.method(globalThis, "fetch", async (u) => (u === "props.json" ? new Response("{not json") : new Response("", { status: 404 })));
  await assert.rejects(props(url, at("night", { hanukkah: 2 })), SyntaxError);
  t.mock.method(globalThis, "fetch", async (u) => (u === "halloween.json" ? new Response("{not json") : new Response("", { status: 404 })));
  await assert.rejects(props(url, at("day", { halloween: 2 })), SyntaxError);
});

test("The fireworks: none in a still frame, then bursts whose middles keep to the sky box, each gone after its frames", async (t) => {
  const { props, BURST } = await load();
  const F = { bursts: [{ sx: 0, w: 30, h: 30 }, { sx: 270, w: 26, h: 26 }], frames: 9, grow: 5, sky: [26, 22, 176, 44] };
  t.mock.method(globalThis, "fetch", async (u) => (u === "fireworks.json" ? Response.json(F) : u === "fireworks.webp" ? new Response("x") : new Response("", { status: 404 })));
  globalThis.createImageBitmap = async () => ({});
  t.after(() => delete globalThis.createImageBitmap);
  const items = await props((name) => (ext) => `${name}.${ext}`, at("night", { "new-year": 0 }, "winter", { evening: true, afternoon: true }));
  assert.equal(items.length, 1);
  const calls = [], ctx = { drawImage: (...a) => calls.push(a), set globalCompositeOperation(v) { this.op = v; } };
  items[0].draw(ctx, null);
  assert.equal(calls.length, 0, "a still frame has no fireworks");
  const life = (F.grow * BURST.grow + (F.frames - F.grow) * BURST.fade) / 1000;
  for (let s = 0; s < 60; s += 0.05) items[0].draw(ctx, s);
  assert.ok(calls.length > 100, "bursts went up");
  for (const [, sx, , w, h, x, y] of calls) {
    const k = (sx % 270) / w;
    assert.ok(Number.isInteger(k) && k < F.frames, `frame ${k}`);
    assert.ok(x + (w >> 1) >= 26 && x + (w >> 1) <= 176 && y + (h >> 1) >= 22 && y + (h >> 1) <= 44, `a burst at ${x}, ${y}`);
  }
  calls.length = 0;
  items[0].draw(ctx, 60 + life + 0.01);   // long after: only a new one, on its first frame, can show
  assert.ok(calls.every(([, sx, , w]) => (sx % 270) / w === 0));
  assert.equal(ctx.op, "source-over");
});
