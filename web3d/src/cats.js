// Yonatan's two cats on Workshop Row (workshop-fx.js), apart from their drawing, so a test can run them on a seed. On the
// wall's top each walks, sits a while or settles into a loaf, at its own pace; when they meet, the walking one turns back.
// Now and then a walking cat jumps down to the pavement (a crouch, a leap along an arc, a crouch on landing) and trots
// along it, off either end of the street and back later from either end; after a while on the street it may jump up
// again when it is under the wall. fx is workshop-fx.json (wall, street, edge); ground(x, y) is the depth of the ground at
// a cat's feet, which a leap goes between; the cats keep their own clock, from the dt of each step.
const SPEED = { ginger: 13, black: 16 };              // px/s
const GATHER = 260, LAND = 200, ROOM = 26;            // ms crouched before the spring and after landing; px kept between cats

export function cats(fx, names, random = Math.random, ground = () => 0) {
  const rnd = (a, b) => a + random() * (b - a);
  const [x0, wallY, x1] = fx.wall, streetY = fx.street, [e0, e1] = fx.edge;
  let now = 0;
  const all = names.map((name, j) => {
    const x = j ? x0 + (x1 - x0) * 0.78 : x0 + (x1 - x0) * 0.16, y = wallY;
    return { name, x, y, dir: j ? -1 : 1, v: SPEED[name] ?? 14, dist: 0, pose: 'walk', on: 'wall', f: ground(x, y), until: rnd(2000, 6000) };
  });
  // Where a cat holds the wall: on it, or leaping from or onto it (its landing spot kept free while it is in the air).
  const spot = (o) => (o.on === 'wall' ? o.x : o.on === 'hop' ? (o.to[1] === wallY ? o.to[0] : o.from[1] === wallY ? o.from[0] : null) : null);
  const others = (c) => all.filter((o) => o !== c);
  const wallNear = (c, x) => others(c).some((o) => spot(o) != null && Math.abs(spot(o) - x) < ROOM);
  const streetNear = (c, x) => others(c).some((o) => o.on === 'street' && Math.abs(o.x - x) < ROOM);

  const hop = (c, x, y) => {
    const down = y > c.y;
    Object.assign(c, { on: 'hop', t0: now + GATHER, ms: down ? 650 : 750, rise: down ? 6 : 14, from: [c.x, c.y, c.f], to: [x, y, ground(x, y)], pose: 'crouch' });
  };
  const update = (c, dt) => {
    if (c.on === 'away') {
      if (now < c.until) return;
      c.on = 'street';
      c.dir = random() < 0.5 ? 1 : -1;
      c.x = c.dir > 0 ? e0 : e1;
      c.pose = 'walk';
    }
    if (c.on === 'hop') {
      const t = Math.max(0, Math.min(1, (now - c.t0) / c.ms)), [hx0, hy0, f0] = c.from, [hx1, hy1, f1] = c.to;
      c.x = hx0 + (hx1 - hx0) * t;
      c.y = hy0 + (hy1 - hy0) * t - c.rise * 4 * t * (1 - t);
      c.f = f0 + (f1 - f0) * t;
      c.pose = t > 0 && t < 1 ? 'leap' : 'crouch';
      if (now > c.t0 + c.ms + LAND) {   // landed: a while on its feet before it may jump again
        Object.assign(c, { on: hy1 === wallY ? 'wall' : 'street', y: hy1, pose: 'walk', until: now + rnd(6000, 20000) });
      }
      return;
    }
    if (c.on === 'wall') {
      if (now > c.until) {   // what next: walk on after a rest, perhaps the other way, or rest after a walk
        if (c.pose !== 'walk') {
          c.pose = 'walk';
          c.until = now + rnd(4000, 12000);
          if (random() < 0.5) c.dir = -c.dir;
        } else {
          c.pose = random() < 0.55 ? 'sit' : 'loaf';
          c.until = now + (c.pose === 'sit' ? rnd(3000, 8000) : rnd(9000, 22000));
        }
      }
      if (c.pose === 'walk') {
        if (random() < dt / 14000 && !streetNear(c, c.x + c.dir * 20)) return hop(c, c.x + c.dir * 20, streetY);
        const ahead = others(c).some((o) => spot(o) != null && Math.sign(spot(o) - c.x) === c.dir);
        if ((ahead && wallNear(c, c.x + c.dir * 2)) || c.x + c.dir < x0 || c.x + c.dir > x1) c.dir = -c.dir;
        c.x += c.v * c.dir * dt / 1000;
        c.dist += c.v * dt / 1000;
      }
      c.y = wallY;
      c.f = ground(c.x, wallY);
      return;
    }
    c.pose = 'walk';   // on the street
    c.x += c.v * c.dir * dt / 1000;
    c.dist += c.v * dt / 1000;
    if (c.x < e0 || c.x > e1) {
      c.on = 'away';
      c.until = now + rnd(4000, 15000);
      return;
    }
    if (now > c.until && c.x > x0 + 20 && c.x < x1 - 20 && random() < dt / 4000 && !wallNear(c, c.x + c.dir * 16)) return hop(c, c.x + c.dir * 16, wallY);
    c.y = streetY;
    c.f = ground(c.x, streetY);
  };
  // Moves every cat dt ms on.
  const step = (dt) => {
    now += dt;
    for (const c of all) update(c, dt);
  };
  return { all, step, clock: () => now };
}
