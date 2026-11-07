// The lobby's receptionists (gen_floors.RECEPTION in floors.json): what each is doing, on their own random clock. Each
// rests, then writes in the ledger or looks toward the lift or the door, or rests on, by their weights, and always rests
// again after. Kept apart from their drawing (pixel.js), so a test can run it on a seed.
export function reception({ people, weights, times }, random = Math.random) {
  const span = ([a, b]) => a + random() * (b - a);
  const pick = (w) => {
    let r = random() * Object.values(w).reduce((a, b) => a + b, 0);
    for (const [pose, v] of Object.entries(w)) if ((r -= v) < 0) return pose;
    return 'idle';
  };
  let now = 0;
  const all = people.map((name) => ({ name, pose: 'idle', until: span(times.start) }));
  return {
    all,
    clock: () => now,
    // On by dt ms of their clock, which only runs while the room may move.
    step(dt) {
      now += dt;
      for (const p of all) {
        while (now >= p.until) {
          p.pose = p.pose === 'idle' ? pick(weights[p.name]) : 'idle';
          p.until += span(times[p.pose]);
        }
      }
    },
    // ms of their clock until one of them next changes
    next: () => Math.min(...all.map((p) => p.until)) - now,
  };
}
