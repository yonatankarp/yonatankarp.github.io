// Workshop Row's life (workshop.js): painted walkers on the pavement, a cat on the wall, a welder's sparks, code
// scrolling on the screens and moths round the street lamps, over the picture (scene-fx.js). Where they go is
// workshop-fx.json and what hides them is workshop-depth.png, both written by web3d/pixel/gen_workshop.py; the walkers
// are walkers.webp and walkers.json, written by web3d/pixel/gen_walkers.py.
import { animate, rnd } from './scene-fx.js';

export function workshopFx(canvas, img) {
  const art = (name) => `${img.dataset.base}-${name}?v=${img.dataset.version}`;
  const people = (name) => `${new URL('walkers', new URL(img.dataset.base, location.href)).pathname}.${name}?v=${img.dataset.version}`;
  animate(canvas, { data: art('fx.json'), depth: art('depth.png') }, (ctx, fx, { dfill, footAt }) => setup(ctx, fx, dfill, footAt, walkers(people)));
}

// The walkers' sheet, a row per person and a column per frame, split once into each frame's pixels grouped by colour,
// in the day's colours or dimmed for the night. Resolves to null without it: the street is then just empty.
function walkers(url) {
  const night = document.documentElement.dataset.time === 'night';
  return Promise.all([
    fetch(url('json')).then((r) => r.json()),
    fetch(url('webp')).then((r) => r.blob()).then((b) => createImageBitmap(b, { colorSpaceConversion: 'none' })),
  ]).then(([m, bitmap]) => {
    const pad = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
    pad.drawImage(bitmap, 0, 0);
    const d = pad.getImageData(0, 0, bitmap.width, bitmap.height).data, dim = (v, k) => Math.round(v * 0.45 + [14, 16, 34][k] * 0.55);   // under rgba(14,16,34,.55)
    const frames = m.people.map((_, j) => Array.from({ length: m.frames }, (_, k) => {
      const byColour = new Map();
      for (let y = 0; y < m.h; y++) {
        for (let x = 0; x < m.w; x++) {
          const i = ((j * m.h + y) * bitmap.width + k * m.w + x) * 4;
          if (d[i + 3] < 128) continue;
          const rgb = [d[i], d[i + 1], d[i + 2]].map((v, c) => (night ? dim(v, c) : v)), fill = `rgb(${rgb})`;
          if (!byColour.has(fill)) byColour.set(fill, []);
          byColour.get(fill).push(x, y);
        }
      }
      return [...byColour].map(([fill, px]) => ({ fill, px }));
    }));
    return { ...m, frames };
  }).catch(() => null);
}

function setup(ctx, fx, dfill, footAt, sheet) {
  const time = document.documentElement.dataset.time, night = time === 'night';

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

  // Moths round the street lamps' heads, while the lamps are lit: not by day.
  const moths = time === 'day' ? [] : fx.lamps.flatMap(([cx, cy]) => Array.from({ length: 3 }, () => ({ cx, cy, a: rnd(0, 6.3), r: rnd(3, 7), w: rnd(2, 5) * (Math.random() < 0.5 ? 1 : -1) })));
  const drawMoths = (now, dt) => {
    ctx.fillStyle = night ? 'rgba(255,245,210,.9)' : 'rgba(255,240,200,.75)';
    for (const m of moths) {
      m.a += m.w * dt / 1000;
      const j = Math.sin(now / 70 + m.r) * 1.2;
      ctx.fillRect(Math.round(m.cx + Math.cos(m.a) * m.r + j), Math.round(m.cy + Math.sin(m.a * 1.3) * m.r * 0.7), 1, 1);
    }
  };

  // Painted walkers pacing the pavement's two lanes, the far one first; the lamp posts at the kerb stand in front of them.
  // A step of the cycle per stride of ground, so the feet do not slide; mirrored walking left. Fewer, and dimmed, at night.
  const [px0, px1] = fx.pavement;
  let people = null;
  sheet.then((s) => { people = s; });
  const walkers = Array.from({ length: night ? 4 : 8 }, (_, i) => ({
    x: rnd(px0 + 10, px1 - 5), dir: Math.random() < 0.5 ? 1 : -1, pace: rnd(0.71, 0.97), lane: fx.lanes[i % 2], who: i, dist: rnd(0, 100),
  })).sort((a, b) => a.lane - b.lane);
  const drawWalkers = (dt) => {
    for (const w of walkers) {
      if (!people) continue;
      const v = w.pace * people.stride;   // px/s: a pace in strides a second, so speed keeps to the people's size
      w.x += v * w.dir * dt / 1000;
      if (w.x < px0 || w.x > px1) { w.dir = -w.dir; w.x = Math.min(px1, Math.max(px0, w.x)); }
      w.dist += v * dt / 1000;
      const { frames, w: fw, foot, stride } = people, cycle = frames[w.who % frames.length], k = Math.floor(w.dist / stride * cycle.length) % cycle.length;
      const x = Math.round(w.x), x0 = x - (fw >> 1), y0 = w.lane - foot, f = footAt(x, w.lane);
      for (const { fill, px } of cycle[k]) {
        ctx.fillStyle = fill;
        for (let i = 0; i < px.length; i += 2) dfill(x0 + (w.dir > 0 ? px[i] : fw - 1 - px[i]), y0 + px[i + 1], 1, 1, f);
      }
    }
  };

  // A cat on the wall's top: walks, sits a while now and then, turns round at the ends.
  const [cx0, cy, cx1] = fx.wall, cat = { x: cx0 + 10, v: 4, sit: 0 };
  const drawCat = (now, dt) => {
    if (cat.sit < now) {
      cat.x += cat.v * dt / 1000;
      if (cat.x < cx0 || cat.x > cx1) cat.v = -cat.v;
      if (Math.random() < dt / 9000) cat.sit = now + rnd(2000, 5000);
    }
    const x = Math.round(cat.x), dir = cat.v > 0 ? 1 : -1, f = footAt(x, cy + 1);
    ctx.fillStyle = night ? 'rgba(25,22,28,.95)' : '#2a2220';
    if (cat.sit > now) { dfill(x, cy - 3, 2, 3, f); dfill(x + dir, cy - 4, 1, 1, f); dfill(x - dir, cy, 2, 1, f); }   // sitting, tail out
    else {
      const s = ((now / 200) | 0) % 2;
      dfill(x - 2, cy - 2, 5, 2, f); dfill(x + dir * 3, cy - 3, 1, 2, f); dfill(x - dir * 3, cy - 3 - s, 1, 1, f);   // body, head, tail
      dfill(x - 2 + s, cy, 1, 1, f); dfill(x + 1 - s, cy, 1, 1, f);                                                    // legs
    }
  };

  return (now, dt) => { drawScreens(now); drawWeld(now, dt); drawMoths(now, dt); drawWalkers(dt); drawCat(now, dt); };
}
