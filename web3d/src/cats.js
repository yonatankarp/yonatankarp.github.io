// Yonatan's two cats, apart from their drawing, so a test can run them on a seed: on Workshop Row (workshop-fx.js) and in
// the tower's lobby (pixel.js). On a perch (the Row's wall; the lobby's bench and counter) each walks, sits a while or
// settles into a loaf, at its own pace; when they meet, the walking one turns back. Now and then a walking cat jumps down
// to the street (a crouch, a leap along an arc, a crouch on landing) and trots along it, off either end and back later from
// either end; after a while on the street it may jump up again when it is under a perch. fx is workshop-fx.json (wall,
// street, edge) or floors.json's lobby cats (perches, street, edge, start, k: their size against the Row's, which scales
// their speed, their room and their leaps); ground(x, y) is the depth of the ground at a cat's feet, which a leap goes
// between; the cats keep their own clock, from the dt of each step.
const SPEED = { ginger: 13, black: 16 };              // px/s
const GATHER = 260, LAND = 200, ROOM = 26;            // ms crouched before the spring and after landing; px kept between cats

export function cats(fx, names, random = Math.random, ground = () => 0) {
  const rnd = (a, b) => a + random() * (b - a);
  const perches = fx.perches ?? [fx.wall], k = fx.k ?? 1, streetY = fx.street, [e0, e1] = fx.edge;
  const [w0, , w1] = perches[0];
  // Where each starts, [x, perch] (null: the street): on the Row, both on its wall.
  const start = fx.start ?? [[w0 + (w1 - w0) * 0.16, 0], [w0 + (w1 - w0) * 0.78, 0]];
  let now = 0;
  const all = names.map((name, j) => {
    const [x, p] = start[j], y = p == null ? streetY : perches[p][1];
    return { name, x, y, dir: j ? -1 : 1, v: (SPEED[name] ?? 14) * k, dist: 0, pose: 'walk', on: p == null ? 'street' : 'wall', p, f: ground(x, y), until: rnd(2000, 6000) };
  });
  // Where a cat holds perch p: on it, or leaping from or onto it (its landing spot kept free while it is in the air).
  const spot = (o, p) => (o.on === 'wall' ? (o.p === p ? o.x : null) : o.on === 'hop' ? (o.q === p ? o.to[0] : o.p === p ? o.from[0] : null) : null);
  const others = (c) => all.filter((o) => o !== c);
  const perchNear = (c, p, x) => others(c).some((o) => spot(o, p) != null && Math.abs(spot(o, p) - x) < ROOM * k);
  const streetNear = (c, x) => others(c).some((o) => o.on === 'street' && Math.abs(o.x - x) < ROOM * k);

  // A leap to x, y: onto perch q, or down to the street (q null).
  const hop = (c, x, y, q = null) => {
    const down = y > c.y;
    Object.assign(c, { on: 'hop', q, t0: now + GATHER, ms: down ? 650 : 750, rise: (down ? 6 : 14) * k, from: [c.x, c.y, c.f], to: [x, y, ground(x, y)], pose: 'crouch' });
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
        Object.assign(c, { on: c.q == null ? 'street' : 'wall', p: c.q, y: hy1, pose: 'walk', until: now + rnd(6000, 20000) });
      }
      return;
    }
    if (c.on === 'wall') {
      const [x0, y, x1] = perches[c.p];
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
        if (random() < dt / 14000 && !streetNear(c, c.x + c.dir * 20 * k)) return hop(c, c.x + c.dir * 20 * k, streetY);
        const ahead = others(c).some((o) => spot(o, c.p) != null && Math.sign(spot(o, c.p) - c.x) === c.dir);
        if ((ahead && perchNear(c, c.p, c.x + c.dir * 2 * k)) || c.x + c.dir < x0 || c.x + c.dir > x1) c.dir = -c.dir;
        c.x += c.v * c.dir * dt / 1000;
        c.dist += c.v * dt / 1000;
      }
      c.y = y;
      c.f = ground(c.x, y);
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
    const q = perches.findIndex(([x0, , x1]) => c.x > x0 + 20 * k && c.x < x1 - 20 * k);   // the perch it is under
    if (now > c.until && q >= 0 && random() < dt / 4000 && !perchNear(c, q, c.x + c.dir * 16 * k)) return hop(c, c.x + c.dir * 16 * k, perches[q][1], q);
    c.y = streetY;
    c.f = ground(c.x, streetY);
  };
  // Moves every cat dt ms on.
  const step = (dt) => {
    now += dt;
    for (const c of all) update(c, dt);
  };
  // ms until one of them next moves: none while one walks or leaps, else until the first rest ends or the first comes back.
  const next = () => Math.min(...all.map((c) => (c.pose === 'walk' && c.on !== 'away') || c.on === 'hop' ? 0 : c.until - now));
  return { all, step, next, clock: () => now };
}
