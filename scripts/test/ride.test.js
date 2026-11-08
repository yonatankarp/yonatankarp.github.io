// The tower's lift (web3d/src/ride.js): rides that land on their stop, sink past it and back, and carry their speed on
// when retargeted mid-way (#31, #41).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const load = () => import("../../web3d/src/ride.js");
const art = JSON.parse(fs.readFileSync(path.join(__dirname, "../../static/building/pixel/floors.json"), "utf8"));
const fh = art.frame[1], last = art.order.length - 1;
const at = (stop) => ({ from: stop, to: stop, start: 0, dur: 0, v: 0, land: 0, settle: 0, sink: 0, fh, last });
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} is not within ${tol} of ${b}`);

test("a ride starts at its stop and lands on the next, with or without its settle", async () => {
  const { plan, pos, sunk, rideU, SETTLE } = await load();
  for (const paused of [false, true]) {
    const ride = { ...at(8), ...plan(at(8), 0, 3, { closeMs: 0, still: false, paused, rise: 1 }) };
    assert.equal(ride.settle, paused ? 0 : SETTLE);
    near(pos(ride, 0), 8, 1e-9, "at the start");
    near(pos(ride, 1), 3, 1e-9, "at the end");
    near(sunk(ride, 1), 0, 1e-9, "sunk at the end");
    assert.equal(rideU(ride, ride.start + ride.dur + 1), 1);
  }
});

test("it sinks only in its settle, at most OVER art pixels, the way it was going", async () => {
  const { plan, sunk, OVER } = await load();
  for (const rise of [1, -1]) {
    const ride = { ...at(5), ...plan(at(5), 0, rise > 0 ? 3 : 7, { closeMs: 0, still: false, paused: false, rise }) };
    const settleFrom = 1 - ride.settle / ride.dur;
    for (let u = 0; u <= settleFrom; u += 0.01) assert.equal(sunk(ride, u), 0, `before the settle, u ${u}`);
    let deepest = 0;
    for (let u = settleFrom; u <= 1; u += 0.001) { const d = sunk(ride, u); assert.ok(Math.sign(d) !== -rise, "the way it was going"); deepest = Math.max(deepest, Math.abs(d)); }
    near(deepest, OVER, 0.01, "its deepest");
  }
});

test("held, it just goes there; its time grows with the distance, to 1.6 s", async () => {
  const { plan, SETTLE } = await load();
  const held = plan(at(8), 0, 0, { closeMs: 500, still: true, paused: false, rise: 1 });
  assert.deepEqual([held.dur, held.v, held.settle, held.land], [1, 0, 0, 0]);
  assert.equal(plan(at(8), 0, 7, { closeMs: 0, still: false, paused: false, rise: 1 }).dur, 650 + SETTLE);
  assert.equal(plan(at(8), 0, 0, { closeMs: 0, still: false, paused: false, rise: 1 }).dur, 1600 + SETTLE);
  assert.equal(plan(at(8), 1000, 7, { closeMs: 300, still: false, paused: false, rise: 1 }).start > 1000, true, "it waits for the doors");
});

test("retargeted mid-ride, the cab goes on from where it is, at its speed", async () => {
  const { plan, motion, cab, rideU } = await load();
  const first = { ...at(8), ...plan(at(8), 0, 3, { closeMs: 0, still: false, paused: false, rise: 1 }) };
  for (const t of [200, 400, 700]) {
    const now = first.start + t, [here, vel] = motion(first, now);
    assert.ok(Math.abs(vel) > 0, `moving at ${t} ms`);
    for (const to of [0, 6]) {
      const next = { ...first, ...plan(first, now, to, { closeMs: 0, still: false, paused: false, rise: Math.sign(here - to) }) };
      assert.equal(next.start, now, "no wait while it is moving");
      near(cab(next, rideU(next, now)), here, 1e-9, `where it is at ${t} ms, to ${to}`);
      const [, v] = motion(next, now + 16);
      near(v, vel, Math.abs(vel) * 0.15, `its speed at ${t} ms, to ${to}`);
    }
  }
});

test("in the roof's and the lobby's settle a ride starts from the stop itself", async () => {
  const { plan, cab, pos, sunk } = await load();
  for (const [from, to, rise] of [[2, 0, 1], [last - 2, last, -1]]) {
    const ride = { ...at(from), ...plan(at(from), 0, to, { closeMs: 0, still: false, paused: false, rise }) };
    const u = 1 - ride.settle / ride.dur / 2;   // mid-settle
    assert.ok(Math.abs(sunk(ride, u)) > 1);
    assert.equal(cab(ride, u), pos(ride, u));
  }
  const mid = { ...at(5), ...plan(at(5), 0, 3, { closeMs: 0, still: false, paused: false, rise: 1 }) }, u = 1 - mid.settle / mid.dur / 2;
  near(cab(mid, u), pos(mid, u) - sunk(mid, u) / fh, 1e-12, "between storeys, the camera");
});
