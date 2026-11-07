const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const load = () => import("../../web3d/src/reception.js");
const rec = JSON.parse(fs.readFileSync(path.join(__dirname, "../../static/building/pixel/floors.json"), "utf8")).reception;

// A seeded random source, so the run is the same every time.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Ten hours of the desk at 60 frames a second: each receptionist's runs, every pose they take and when it ends.
async function simulate(seed) {
  const { reception } = await load();
  const desk = reception(rec, seeded(seed)), dt = 1000 / 60;
  const runs = Object.fromEntries(desk.all.map((p) => [p.name, [{ pose: p.pose, from: 0, until: p.until }]]));
  for (let k = 0; k < 10 * 60 * 60 * 60; k++) {
    desk.step(dt);
    assert.ok(desk.next() > 0, "the next change is still to come");
    for (const p of desk.all) {
      const last = runs[p.name].at(-1);
      if (p.until !== last.until) runs[p.name].push({ pose: p.pose, from: last.until, until: p.until });
      assert.ok(p.until - desk.clock() <= rec.times[p.pose][1], "never further from a change than its pose lasts");
    }
  }
  return runs;
}

test("each rests between everything else, for as long as its pose's times allow", async () => {
  const runs = await simulate(7);
  for (const name of rec.people) {
    const [first, ...rest] = runs[name];
    assert.ok(first.until >= rec.times.start[0] && first.until <= rec.times.start[1], `${name} first rests 1 to 4 s`);
    assert.ok(rest.length > 2000, `${name} keeps busy`);
    for (const [i, r] of rest.entries()) {
      if (r.pose !== "idle") assert.equal(rest[i + 1]?.pose ?? "idle", "idle", `${name} rests after ${r.pose}`);
      const [lo, hi] = rec.times[r.pose], len = r.until - r.from;
      assert.ok(len >= lo && len <= hi, `${name}'s ${r.pose} lasts ${len} ms`);
    }
  }
});

test("what each turns to follows their own weights, on their own clock", async () => {
  const runs = await simulate(11);
  const share = (name, pose) => {
    const after = runs[name].filter((r, i) => i && runs[name][i - 1].pose === "idle");   // what each rest led to
    return after.filter((r) => r.pose === pose).length / after.length;
  };
  for (const name of rec.people) {
    const w = rec.weights[name], all = Object.values(w).reduce((a, b) => a + b, 0);
    for (const pose of rec.poses) {
      assert.ok(Math.abs(share(name, pose) - w[pose] / all) < 0.03, `${name}: ${pose} ${share(name, pose).toFixed(3)} of the time, not ${(w[pose] / all).toFixed(3)}`);
    }
  }
  assert.ok(share("ana", "write") > 2 * share("ben", "write"), "she writes far more than he does");
  const changes = (name) => runs[name].map((r) => r.until).join();
  assert.notEqual(changes("ana"), changes("ben"), "they do not change together");
});
