// The Library's readers' routine (library-fx.js), apart from their drawing, so a test can run it on a seed. Each reader
// goes its own way: at every turn it picks, by library-fx.json's weights, to walk past (now and then out of the room and
// back), to stop at a shelf and look, or to take a book and read it, perhaps then browsing the shelf next door, and idles
// a while between. Each has its own speed and its own pace on every duration, and starts somewhere in its routine, so no
// two keep step. No two stop at, or head for, the same shelf. Stopped, a reader faces either way, the whole stop long.
export function readers(cfg, count, random = Math.random) {
  const rnd = (a, b) => a + random() * (b - a);
  const weighted = (options) => {   // [[value, weight], ...]
    let left = random() * options.reduce((sum, [, w]) => sum + w, 0);
    return (options.find(([, w]) => (left -= w) < 0) ?? options.at(-1))[0];
  };
  const { shelves, spread, room } = cfg, mid = (room[0] + room[1]) / 2, all = [];
  const free = (me) => shelves.map((_, i) => i).filter((i) => all.every((o) => o === me || o.shelf !== i));
  const time = (r, [a, b]) => rnd(a, b) * r.pace;
  const face = (r) => { if (random() >= cfg.keep) r.left = random() < 0.5; };   // at a stop: on as it walked, or either way

  // A browse at shelf i: walk there, stand, reach, take, and read for short or long; then perhaps the free shelf next door.
  const browse = (r, i, again = true) => {
    const steps = [{ walk: shelves[i] + rnd(-spread, spread), shelf: i }, ...cfg.browse.map((range, k) => ({ pose: k, ms: time(r, range) })),
      { pose: 3, ms: time(r, weighted(cfg.read.map(([a, b, w]) => [[a, b], w]))) }];
    const next = free(r).filter((j) => Math.abs(j - i) === 1);
    return again && random() < cfg.nearby && next.length ? [...steps, ...browse(r, next[random() * next.length | 0], false)] : steps;
  };
  const plan = (r) => {
    const what = weighted(Object.entries(cfg.choose)), open = free(r);
    if (what === 'pass' || !open.length) {   // a stroll far across, without stopping, now and then out of the room for a while
      if (random() < cfg.leave) return [{ walk: r.x < mid ? room[1] : room[0], shelf: null }, { away: time(r, cfg.away) }];
      const far = rnd(room[0] + 80, room[1] - 80);
      return [{ walk: Math.abs(far - r.x) > (room[1] - room[0]) / 3 ? far : r.x < mid ? room[1] - 80 : room[0] + 80, shelf: null }];
    }
    const i = open[random() * open.length | 0];
    const steps = what === 'look' ? [{ walk: shelves[i] + rnd(-spread, spread), shelf: i }, { pose: 0, ms: time(r, cfg.look) }] : browse(r, i);
    return [...steps, { idle: time(r, cfg.idle) }];
  };
  // Starts the next step: a walk claims its shelf, or lets one go (if another took it meanwhile, a fresh plan instead);
  // the rest last their time.
  const begin = (r, now) => {
    if (!r.steps.length) r.steps = plan(r);
    const s = r.steps[0];
    if ('walk' in s) {
      if (s.shelf != null && !free(r).includes(s.shelf)) { r.steps = plan(r); return begin(r, now); }
      r.shelf = s.shelf;
    } else r.until = now + (s.ms ?? s.idle ?? s.away);
    if ('away' in s) r.shown = false;
    r.changed = now;
  };

  for (let k = 0; k < count; k++) {
    all.push({ x: rnd(shelves[0] - 60, shelves.at(-1) + 60), v: rnd(...cfg.speed), pace: rnd(...cfg.pace), dist: rnd(0, 100),
      left: random() < 0.5, shown: true, shelf: null, until: 0, changed: 0, steps: [] });
  }
  for (const r of all) {   // somewhere along a fresh plan, part way through its step
    const steps = plan(r), k = random() * steps.length | 0, walked = steps.slice(0, k).filter((s) => 'walk' in s).at(-1);
    r.steps = steps.slice(k);
    if (walked) { r.x = walked.walk; r.shelf = walked.shelf; if (walked.shelf != null) face(r); }
    begin(r, 0);
    if (!('walk' in r.steps[0])) r.until *= random();
  }

  // Moves every reader dt ms on, to `now`.
  const step = (now, dt) => {
    for (const r of all) {
      const s = r.steps[0];
      if ('walk' in s) {
        const go = Math.min(Math.abs(s.walk - r.x), r.v * dt / 1000);
        r.left = s.walk < r.x;
        r.x += r.left ? -go : go;
        r.dist += go;
        if (Math.abs(s.walk - r.x) >= 1) continue;
        if (s.shelf != null) face(r);
      } else if (now < r.until) continue;
      if ('away' in s) r.shown = true;   // back in, at the edge it left by
      r.steps.shift();
      begin(r, now);
    }
  };
  // What a reader shows: -1 walking, else its pose (0 stand, 1 reach, 2 take, 3 read); idling, it stands.
  const pose = (r) => ('walk' in r.steps[0] ? -1 : r.steps[0].pose ?? 0);
  return { all, step, pose };
}
