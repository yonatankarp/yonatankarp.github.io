const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const load = () => import("../../web3d/src/capsule.js");
const cap = JSON.parse(fs.readFileSync(path.join(__dirname, "../../static/building/pixel/floors.json"), "utf8")).capsule;

test("the capsule rides from the feed pipe's end to the counter, then is gone", async () => {
  const { capsuleAt } = await load();
  const [x0, y0, a0] = capsuleAt(cap, 0);
  assert.deepEqual([x0, y0], cap.path[0]);
  assert.ok(Math.abs(Math.cos(a0)) > 0.999, "it starts lying along the feed pipe");
  const [x1, y1, a1] = capsuleAt(cap, cap.ride + cap.hold - 1);
  assert.deepEqual([x1, y1], cap.path.at(-1));
  assert.ok(Math.abs(Math.sin(a1)) > 0.999, "it ends upright, in the counter's pipe");
  for (const t of [-1, cap.ride + cap.hold, 4000, NaN]) assert.equal(capsuleAt(cap, t), null, `at ${t} ms`);
});

test("it glides and turns, never jumps or snaps at a bend", async () => {
  const { capsuleAt } = await load();
  let last = capsuleAt(cap, 0);
  for (let t = 1; t < cap.ride + cap.hold; t++) {
    const now = capsuleAt(cap, t);
    assert.ok(Math.hypot(now[0] - last[0], now[1] - last[1]) < 0.5, `moves under half a pixel a ms at ${t} ms`);
    assert.ok(Math.abs(now[2] - last[2]) < 0.05, `turns smoothly at ${t} ms`);
    last = now;
  }
});
