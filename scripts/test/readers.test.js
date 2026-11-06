const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const load = () => import("../../web3d/src/readers.js");
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, "../../static/building/pixel/library-fx.json"), "utf8")).readers;

// A seeded random source, so the run is the same every time.
function seeded(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Five minutes of the Library's three readers at 60 frames a second: what each is doing on every frame.
async function run(seed) {
  const { readers } = await load();
  const crowd = readers(cfg, 3, seeded(seed)), dt = 1000 / 60, frames = [];
  const doing = (r) => {
    const s = r.steps[0];
    return "walk" in s ? "walk" : "pose" in s ? ["stand", "reach", "take", "read"][s.pose] : "idle" in s ? "idle" : "away";
  };
  for (let now = 0; now < 5 * 60 * 1000; now += dt) {
    crowd.step(now, dt);
    frames.push(crowd.all.map((r) => ({ doing: doing(r), shelf: r.shelf, left: r.left, ms: r.steps[0].ms })));
  }
  return frames;
}

test("the Library's readers go their own ways, not in step", async () => {
  const frames = await run(277);
  let changes = 0, together = 0, allAlike = 0;
  const pairs = [0, 0, 0];
  frames.forEach((f, i) => {
    if (i) {
      const changed = f.filter((r, k) => r.doing !== frames[i - 1][k].doing).length;
      changes += changed;
      if (changed > 1) together++;
    }
    if (f.every((r) => r.doing === f[0].doing)) allAlike++;
    [[0, 1], [0, 2], [1, 2]].forEach(([a, b], k) => { if (f[a].doing === f[b].doing) pairs[k]++; });
  });
  assert.ok(changes > 60, `the readers barely change what they do: ${changes} changes in five minutes`);
  assert.ok(together <= changes * 0.02, `${together} of ${changes} changes came on the same frame as another reader's`);
  assert.ok(allAlike < frames.length * 0.2, `all three did the same thing ${Math.round(100 * allAlike / frames.length)}% of the time`);
  for (const same of pairs) assert.ok(same < frames.length * 0.5, `two readers did the same thing ${Math.round(100 * same / frames.length)}% of the time`);
});

test("no two readers stop at, or head for, the same shelf", async () => {
  const frames = await run(278);
  frames.forEach((f, i) => {
    const shelves = f.map((r) => r.shelf).filter((s) => s != null);
    assert.equal(new Set(shelves).size, shelves.length, `two readers had shelf ${shelves} at frame ${i}`);
  });
});

test("the readers walk past and leave the room, look, take books and read short and long, facing either way", async () => {
  const frames = (await run(279)).flat();
  for (const doing of ["walk", "stand", "reach", "take", "read", "idle", "away"]) {
    assert.ok(frames.some((r) => r.doing === doing), `nobody was ever ${doing}`);
  }
  assert.ok(frames.some((r) => r.doing === "read" && r.ms >= 10000), "nobody read for long");
  assert.ok(frames.some((r) => r.doing === "read" && r.ms < 10000), "nobody read for a moment");
  const stops = frames.filter((r) => r.doing !== "walk" && r.doing !== "away" && r.shelf != null);
  assert.ok(stops.some((r) => r.left) && stops.some((r) => !r.left), "every stop at a shelf faced the same way");
});
