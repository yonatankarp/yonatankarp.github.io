const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const load = () => import("../../web3d/src/cats.js");
const fx = JSON.parse(fs.readFileSync(path.join(__dirname, "../../static/building/pixel/workshop-fx.json"), "utf8"));
const names = JSON.parse(fs.readFileSync(path.join(__dirname, "../../static/building/pixel/cats.json"), "utf8")).people;

// A seeded random source, so the run is the same every time.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Half an hour of the two cats at 60 frames a second: where each is and what it does on every frame. Once per seed.
const runs = new Map();
const run = (seed) => runs.get(seed) ?? runs.set(seed, simulate(seed)).get(seed);
async function simulate(seed) {
  const { cats } = await load();
  const pair = cats(fx, names, seeded(seed)), dt = 1000 / 60, frames = [];
  for (let k = 0; k < 30 * 60 * 60; k++) {
    pair.step(dt);
    frames.push({ now: pair.clock(), cats: pair.all.map((c) => ({ on: c.on, x: c.x, y: c.y, pose: c.pose, until: c.until, to: c.to })) });
  }
  return frames;
}

for (const seed of [1, 2, 3]) {
  test(`the cats never overlap on the wall (seed ${seed})`, async () => {
    for (const { now, cats } of await run(seed)) {
      const [a, b] = cats;
      if (a.on === "wall" && b.on === "wall") assert.ok(Math.abs(a.x - b.x) >= 20, `the cats were ${Math.abs(a.x - b.x).toFixed(1)} px apart at ${now} ms`);
    }
  });

  test(`a cat that lands on the street waits before it jumps back up (seed ${seed})`, async () => {
    const frames = await run(seed), landed = [null, null];
    let ups = 0;
    frames.forEach(({ now, cats }, i) => cats.forEach((c, j) => {
      const was = i ? frames[i - 1].cats[j].on : "wall";
      if (was === "hop" && c.on === "street") landed[j] = now;
      if (c.on === "away") landed[j] = null;
      if (was === "street" && c.on === "hop") {
        ups++;
        assert.equal(c.to[1], fx.wall[1], "a cat on the street jumped somewhere but the wall");
        if (landed[j] != null) assert.ok(now - landed[j] >= 6000, `${names[j]} jumped back up ${now - landed[j]} ms after landing`);
      }
    }));
    assert.ok(ups > 0, "no cat ever jumped back up onto the wall");
  });

  test(`both cats go down to the street, off its ends and back, in every pose (seed ${seed})`, async () => {
    const frames = await run(seed), [e0, e1] = fx.edge;
    names.forEach((name, j) => {
      const mine = frames.map((f) => f.cats[j]);
      assert.ok(mine.some((c) => c.on === "street"), `${name} never went down to the street`);
      const back = mine.filter((c, i) => i && mine[i - 1].on === "away" && c.on === "street");
      assert.ok(back.length, `${name} never left the street and came back`);
      for (const c of back) assert.ok(Math.abs(c.x - e0) < 1 || Math.abs(c.x - e1) < 1, `${name} came back at x ${c.x}, not at an edge`);
      assert.ok(mine.some((c, i) => i && mine[i - 1].on === "street" && c.on === "away" && (mine[i - 1].x < e0 + 5 || mine[i - 1].x > e1 - 5)), `${name} never left off an end`);
    });
    const poses = new Set(frames.flatMap((f) => f.cats.map((c) => c.pose)));
    for (const pose of ["walk", "sit", "loaf", "crouch", "leap"]) assert.ok(poses.has(pose), `no cat was ever ${pose}`);
  });
}

// The tower's lobby (floors.json's cats): two perches, the bench and the counter, at the lobby's scale k, one cat starting
// on the bench and one on the floor. An hour on a seed.
const lobby = JSON.parse(fs.readFileSync(path.join(__dirname, "../../static/building/pixel/floors.json"), "utf8")).cats;
const lobbyNames = JSON.parse(fs.readFileSync(path.join(__dirname, "../../static/building/pixel/cats-lobby.json"), "utf8")).people;

test("in the lobby, the cats use both perches, land only on a perch or the floor, and never overlap on one", async () => {
  const { cats } = await load();
  const pair = cats(lobby, lobbyNames, seeded(4)), used = new Set();
  assert.deepEqual(pair.all.map((c) => c.on), ["wall", "street"], "one cat starts on a perch and one on the floor");
  let landings = 0;
  for (let i = 0; i < 60 * 60 * 60; i++) {
    const was = pair.all.map((c) => c.on);
    pair.step(1000 / 60);
    pair.all.forEach((c, j) => {
      if (c.on === "wall") used.add(c.p);
      if (was[j] === "hop" && c.on !== "hop") {
        landings++;
        const [x, y] = c.to;
        if (c.on === "street") assert.equal(y, lobby.street, `${c.name} landed off the floor at y ${y}`);
        else {
          const [x0, py, x1] = lobby.perches[c.p];
          assert.ok(y === py && x >= x0 && x <= x1, `${c.name} landed at ${x}, ${y}, off perch ${c.p}`);
        }
      }
    });
    const [a, b] = pair.all;
    if (a.on === "wall" && b.on === "wall" && a.p === b.p) assert.ok(Math.abs(a.x - b.x) >= 20 * lobby.k, `the cats were ${Math.abs(a.x - b.x).toFixed(1)} px apart on perch ${a.p}`);
  }
  assert.deepEqual([...used].sort(), [0, 1], "the cats never used both perches");
  assert.ok(landings > 10, `only ${landings} leaps in an hour`);
});
