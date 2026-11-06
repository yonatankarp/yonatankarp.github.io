// Workshop Row's life (workshop.js): walkers on the pavement, a cat on the wall, a welder's sparks, code scrolling on the
// screens and moths round the street lamps, over the picture (scene-fx.js). Where they go is workshop-fx.json and what
// hides them is workshop-depth.png, both written by web3d/pixel/gen_workshop.py.
import { animate, rnd } from './scene-fx.js';

export function workshopFx(canvas, img) {
  const art = (name) => `${img.dataset.base}-${name}?v=${img.dataset.version}`;
  animate(canvas, { data: art('fx.json'), depth: art('depth.png') }, (ctx, fx, { dfill, footAt }) => setup(ctx, fx, dfill, footAt));
}

function setup(ctx, fx, dfill, footAt) {
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

  // Walkers pacing the pavement; the lamp posts at the kerb stand in front of them. Dark at night.
  const [px0, py0, px1] = fx.pavement;
  const SHIRTS = ['#c0392b', '#2e86c1', '#f1c40f', '#ecf0f1', '#27ae60', '#8e44ad', '#e67e22'];
  const walkers = SHIRTS.map((shirt, i) => ({ x: rnd(px0 + 10, px1 - 5), v: rnd(5, 9) * (i % 2 ? 1 : -1), y: py0 + (i % 3), shirt, step: rnd(0, 10) }));
  const drawWalkers = (now, dt) => {
    for (const w of walkers) {
      w.x += w.v * dt / 1000;
      if (w.x < px0 || w.x > px1) w.v = -w.v;
      const x = Math.round(w.x), y = w.y, f = footAt(x, y), s = ((now / 230 + w.step) | 0) % 2;
      ctx.fillStyle = night ? 'rgba(40,32,36,.95)' : '#4a3020'; dfill(x + s, y - 1, 1, 2, f); dfill(x + 1 - s, y - 1, 1, 2, f);   // legs
      ctx.fillStyle = night ? 'rgba(70,58,66,.95)' : w.shirt; dfill(x, y - 4, 2, 3, f);                                          // shirt
      ctx.fillStyle = night ? 'rgba(130,108,96,.95)' : '#f0c8a0'; dfill(x, y - 6, 2, 2, f);                                     // head
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

  return (now, dt) => { drawScreens(now); drawWeld(now, dt); drawMoths(now, dt); drawWalkers(now, dt); drawCat(now, dt); };
}
