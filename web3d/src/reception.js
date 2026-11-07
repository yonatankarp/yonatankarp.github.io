// The lobby's receptionist (gen_floors.RECEPTION in floors.json): one of its people, picked at even odds, and what they are
// doing, on a random clock. They rest, then write in the ledger or look toward the lift or the door, or rest on, by their
// own weights, and always rest again after. Kept apart from their drawing (pixel.js), so a test can run it on a seed.
export function reception({ people, weights, times }, random = Math.random) {
  const span = ([a, b]) => a + random() * (b - a);
  const pick = (w) => {
    let r = random() * Object.values(w).reduce((a, b) => a + b, 0);
    for (const [pose, v] of Object.entries(w)) if ((r -= v) < 0) return pose;
    return 'idle';
  };
  let now = 0;
  const name = people[Math.floor(random() * people.length)];
  const person = { name, pose: 'idle', until: span(times.start) };
  return {
    person,
    clock: () => now,
    // On by dt ms of their clock, which only runs while the room may move.
    step(dt) {
      now += dt;
      while (now >= person.until) {
        person.pose = person.pose === 'idle' ? pick(weights[name]) : 'idle';
        person.until += span(times[person.pose]);
      }
    },
    // ms of their clock until they next change
    next: () => person.until - now,
  };
}
