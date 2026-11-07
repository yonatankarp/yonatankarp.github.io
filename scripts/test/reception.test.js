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

// The first seed from `from` on whose visit `name` is at the desk.
async function seedFor(name, from) {
  const { reception } = await load();
  for (let seed = from; ; seed++) if (reception(rec, seeded(seed)).person.name === name) return seed;
}

// Ten hours of the desk at 60 frames a second: the receptionist's runs, every pose they take and when it ends.
async function simulate(seed) {
  const { reception } = await load();
  const desk = reception(rec, seeded(seed)), dt = 1000 / 60, p = desk.person;
  const runs = [{ pose: p.pose, from: 0, until: p.until }];
  for (let k = 0; k < 10 * 60 * 60 * 60; k++) {
    desk.step(dt);
    assert.ok(desk.next() > 0, "the next change is still to come");
    assert.equal(desk.next(), p.until - desk.clock(), "the clock runs for the one at the desk");
    const last = runs.at(-1);
    if (p.until !== last.until) runs.push({ pose: p.pose, from: last.until, until: p.until });
    assert.ok(p.until - desk.clock() <= rec.times[p.pose][1], "never further from a change than its pose lasts");
  }
  return runs;
}

test("one of them is at the desk, picked at even odds, and only that one", async () => {
  const { reception } = await load();
  assert.equal(typeof rec.spot, "number", "they share one spot");
  const n = 4000, seen = Object.fromEntries(rec.people.map((name) => [name, 0]));
  for (let seed = 1; seed <= n; seed++) {
    const desk = reception(rec, seeded(seed));
    assert.ok(rec.people.includes(desk.person.name), `${desk.person.name} is one of them`);
    assert.deepEqual(Object.keys(desk).sort(), ["clock", "next", "person", "step"], "the desk holds one person");
    seen[desk.person.name]++;
  }
  for (const name of rec.people) assert.ok(Math.abs(seen[name] / n - 1 / rec.people.length) < 0.03, `${name} on ${seen[name]} of ${n} visits`);
});

test("they rest between everything else, for as long as its pose's times allow", async () => {
  for (const name of rec.people) {
    const [first, ...rest] = await simulate(await seedFor(name, 7));
    assert.ok(first.until >= rec.times.start[0] && first.until <= rec.times.start[1], `${name} first rests 1 to 4 s`);
    assert.ok(rest.length > 2000, `${name} keeps busy`);
    for (const [i, r] of rest.entries()) {
      if (r.pose !== "idle") assert.equal(rest[i + 1]?.pose ?? "idle", "idle", `${name} rests after ${r.pose}`);
      const [lo, hi] = rec.times[r.pose], len = r.until - r.from;
      assert.ok(len >= lo && len <= hi, `${name}'s ${r.pose} lasts ${len} ms`);
    }
  }
});

test("what they turn to follows their own weights", async () => {
  const shares = {};
  for (const name of rec.people) {
    const runs = await simulate(await seedFor(name, 11));
    const after = runs.filter((r, i) => i && runs[i - 1].pose === "idle");   // what each rest led to
    shares[name] = (pose) => after.filter((r) => r.pose === pose).length / after.length;
    const w = rec.weights[name], all = Object.values(w).reduce((a, b) => a + b, 0);
    for (const pose of rec.poses) {
      assert.ok(Math.abs(shares[name](pose) - w[pose] / all) < 0.03, `${name}: ${pose} ${shares[name](pose).toFixed(3)} of the time, not ${(w[pose] / all).toFixed(3)}`);
    }
  }
  assert.ok(shares.ana("write") > 2 * shares.ben("write"), "she writes far more than he does");
});
