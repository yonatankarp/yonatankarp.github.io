// Workshop Row's life (workshop.js): painted walkers on the pavement, two cats on the wall and the street, a welder's
// sparks, code scrolling on the screens, moths round the street lamps after dark and in winter falling snow, over the picture (scene-fx.js). Where they go is
// workshop-fx.json and what hides them is workshop-depth.png, both written by web3d/pixel/gen_workshop.py; the walkers
// and the cats are walkers.webp and cats.webp with their .json, written by web3d/pixel/gen_walkers.py.
import { cats } from './cats.js';
import { animate, people, rnd, snowfall } from './scene-fx.js';
import PHASES from '../../data/phases.json';   // which hours the lamps are lit at

export function workshopFx(canvas, img) {
  const art = (name) => `${img.dataset.base}-${name}?v=${img.dataset.version}`;
  const sheet = (name) => {
    const url = new URL(name, new URL(img.dataset.base, location.href)).pathname;
    return people((ext) => `${url}.${ext}?v=${img.dataset.version}`, document.documentElement.dataset.time === 'night');
  };
  animate(canvas, { data: art('fx.json'), depth: art('depth.png') }, (ctx, fx, test) => setup(ctx, fx, test, sheet('walkers'), sheet('cats')));
}

function setup(ctx, fx, { footAt, sprite }, sheet, catSheet) {
  const time = document.documentElement.dataset.time, night = time === 'night';
  const snow = document.documentElement.dataset.season === 'winter' && snowfall(ctx, night);

  // Screens: short lines of code scrolling by, and a faint flicker.
  const drawScreens = (now) => {
    for (const [x0, y0, x1, y1] of fx.screens) {
      const big = x1 - x0 > 15, off = (now / (big ? 380 : 600)) | 0;
      ctx.fillStyle = big && x0 < 400 ? 'rgba(60,110,70,.55)' : 'rgba(120,200,160,.55)';
      for (let y = y0 + 1; y < y1 - 1; y += 2) ctx.fillRect(x0 + 2 + ((y + off) % 3), y, Math.min(((y * 7 + off * 13 + x0) % 11) + 3, x1 - x0 - 4), 1);
      ctx.fillStyle = `rgba(255,255,255,${0.04 + 0.04 * Math.sin(now / 90 + x0)})`; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    }
  };

  // Welding at the second workshop's bench: a bright point with a pale halo and a burst of falling sparks, now and then.
  const [wx, wy] = fx.weld;
  let sparks = [], nextWeld = performance.now() + 1500, welding = 0;
  const drawWeld = (now, dt) => {
    if (now > nextWeld) { welding = now + rnd(800, 1800); nextWeld = welding + rnd(2500, 6000); }
    if (now < welding) {
      ctx.fillStyle = `rgba(220,240,255,${0.6 + Math.random() * 0.4})`; ctx.fillRect(wx, wy, 2, 1);
      ctx.fillStyle = 'rgba(200,230,255,.18)'; ctx.fillRect(wx - 7, wy - 5, 16, 8);
      for (let k = 0; k < 3; k++) sparks.push({ x: wx + 1, y: wy, vx: rnd(-14, 14), vy: rnd(-18, -4), life: rnd(400, 900), t0: now });
    }
    sparks = sparks.filter((s) => now - s.t0 < s.life);
    for (const s of sparks) {
      s.vy += 60 * dt / 1000; s.x += s.vx * dt / 1000; s.y += s.vy * dt / 1000;   // gravity, 60 px/s²
      ctx.fillStyle = `rgba(255,${200 + (Math.random() * 55 | 0)},120,${1 - (now - s.t0) / s.life})`; ctx.fillRect(Math.round(s.x), Math.round(s.y), 1, 1);
    }
  };

  // Moths round the street lamps' heads, while the lamps are lit (phases.json's `lit`): at dusk and night.
  const moths = !PHASES[time].lit ? [] : fx.lamps.flatMap(([cx, cy]) => Array.from({ length: 3 }, () => ({ cx, cy, a: rnd(0, 6.3), r: rnd(3, 7), w: rnd(2, 5) * (Math.random() < 0.5 ? 1 : -1) })));
  const drawMoths = (now, dt) => {
    ctx.fillStyle = night ? 'rgba(255,245,210,.9)' : 'rgba(255,240,200,.75)';
    for (const m of moths) {
      m.a += m.w * dt / 1000;
      const j = Math.sin(now / 70 + m.r) * 1.2;
      ctx.fillRect(Math.round(m.cx + Math.cos(m.a) * m.r + j), Math.round(m.cy + Math.sin(m.a * 1.3) * m.r * 0.7), 1, 1);
    }
  };

  // Painted walkers on the pavement's two lanes, the far one first; the lamp posts at the kerb stand in front of them. Each
  // walks off an end of the street and, a few seconds later, someone comes on from either end, in either lane, at their own
  // pace. A step of the cycle per stride of ground, so the feet do not slide; mirrored walking left. Fewer, and dimmed, at
  // night. Past the pavement's end the van stands in front of it, so the feet keep the depth they had there.
  const [px0, px1] = fx.pavement, [e0, e1] = fx.edge, clamp = (x) => Math.round(Math.min(Math.max(x, 8), px1));
  let crowd = null;
  sheet.then((s) => { crowd = s; });
  const walkers = Array.from({ length: night ? 4 : 8 }, (_, i) => ({
    x: rnd(px0 + 10, px1 - 5), dir: Math.random() < 0.5 ? 1 : -1, pace: rnd(0.71, 0.97), lane: fx.lanes[i % 2], who: i, dist: rnd(0, 100), away: 0,
  }));
  const drawWalkers = (now, dt) => {
    if (!crowd) return;
    walkers.sort((a, b) => a.lane - b.lane);
    for (const w of walkers) {
      if (w.away) {
        if (now < w.away) continue;
        Object.assign(w, { away: 0, dir: Math.random() < 0.5 ? 1 : -1, pace: rnd(0.71, 0.97), lane: fx.lanes[Math.random() * 2 | 0], who: Math.random() * crowd.frames.length | 0 });
        w.x = w.dir > 0 ? e0 : e1;
      }
      const v = w.pace * crowd.stride;   // px/s: a pace in strides a second, so speed keeps to the people's size
      w.x += v * w.dir * dt / 1000;
      if (w.x < e0 || w.x > e1) { w.away = now + rnd(1000, 9000); continue; }
      w.dist += v * dt / 1000;
      const cycle = crowd.frames[w.who % crowd.frames.length];
      sprite(crowd, cycle[Math.floor(w.dist / crowd.stride * cycle.length) % cycle.length], w.x, w.lane, w.dir < 0, footAt(clamp(w.x), w.lane));
    }
  };

  // Yonatan's two cats (cats.js): on the wall's top, drawn before the walkers, and on the street, after them.
  let pair = null;
  catSheet.then((s) => {
    if (s) pair = { sheet: s, cats: cats(fx, s.people, Math.random, (x, y) => footAt(y === fx.street ? clamp(x) : Math.round(x), y + 1)) };
  });
  const mid = (fx.wall[1] + fx.street) / 2;
  const drawCats = (dt, front) => {
    if (!pair) return;
    if (!front) pair.cats.step(dt);
    const { sheet: s } = pair;
    pair.cats.all.forEach((c, j) => {
      if (c.on === 'away' || (c.y > mid) !== front) return;
      const k = c.pose === 'walk' ? Math.floor(c.dist / s.stride[j] * 8) % 8 : s.poses.indexOf(c.pose);
      sprite(s, s.frames[j][k], c.x, Math.round(c.y), c.dir < 0, c.f);
    });
  };

  return Object.assign((now, dt) => { drawScreens(now); drawWeld(now, dt); drawMoths(now, dt); drawCats(dt, false); drawWalkers(now, dt); drawCats(dt, true); if (snow) snow(now, dt); },
    { ready: Promise.all([sheet, catSheet]) });
}
