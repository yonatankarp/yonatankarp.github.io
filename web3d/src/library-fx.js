// The Library's life (layouts/blog/list.html, its own bundle): readers browsing the shelves, the fire flickering with a
// breathing glow and rising embers, dust turning in the window's light, and clouds passing outside, only over the
// window's sky, so behind its frames and the rooftops. Over the header's picture, cropped as it is (scene-fx.js); where
// is library-fx.json, written by web3d/pixel/gen_library.py, and the readers are gen_walkers.py's readers sheet. One
// painting, at dusk, so no hours.
import { animate, people, rnd } from './scene-fx.js';

const canvas = document.querySelector('.library-fx');
if (canvas) {
  const sheet = people((ext) => `${canvas.dataset.readers}.${ext}?v=${canvas.dataset.version}`, false);
  animate(canvas, { data: canvas.dataset.fx, depth: canvas.dataset.depth }, (ctx, fx, test) => setup(ctx, fx, test, sheet));
}

function setup(ctx, fx, { sprite }, sheet) {
  const W = ctx.canvas.width, [x0, y0, x1, y1] = fx.fire, mid = (x0 + x1) / 2, base = y1 - 4;
  const sky = new Uint8Array(W * ctx.canvas.height);
  for (const [y, a, b] of fx.sky) sky.fill(1, y * W + a, y * W + b + 1);

  let embers = [];
  const drawFire = (now, dt) => {
    ctx.fillStyle = `rgba(255,170,80,${0.12 + 0.08 * Math.sin(now / 160) + 0.05 * Math.sin(now / 47)})`;   // the glow breathes
    for (const [a, b, c, d] of fx.glow) ctx.fillRect(a, b, c - a, d - b);
    for (let k = 0; k < 40; k++) {   // flames, tallest in the middle, hottest at their tips
      const x = Math.round(rnd(x0, x1)), y = Math.round(base - rnd(0, (1 - Math.abs(x - mid) / ((x1 - x0) / 2)) * (y1 - y0) * rnd(0.4, 1)));
      ctx.fillStyle = (base - y) / (y1 - y0) > 0.5 ? `rgba(255,250,200,${rnd(0.4, 0.9)})` : `rgba(255,${150 + (Math.random() * 80 | 0)},60,${rnd(0.4, 0.9)})`;
      ctx.fillRect(x, y, 1, 1);
    }
    if (Math.random() < dt / 120) embers.push({ x: rnd(x0 + 6, x1 - 6), y: y0 + 10, vy: rnd(-12, -6), vx: rnd(-3, 3), life: rnd(700, 1400), t0: now });
    embers = embers.filter((e) => now - e.t0 < e.life);
    for (const e of embers) {
      e.x += e.vx * dt / 1000; e.y += e.vy * dt / 1000;
      ctx.fillStyle = `rgba(255,190,90,${1 - (now - e.t0) / e.life})`; ctx.fillRect(Math.round(e.x), Math.round(e.y), 1, 1);
    }
  };

  const [kx0, ky0, kx1, ky1] = fx.clouds;
  const clouds = Array.from({ length: 3 }, () => ({ x: rnd(kx0 - 20, kx1 - 20), y: rnd(ky0, ky1), w: rnd(14, 30), v: rnd(1.2, 2.2) }));
  const drawClouds = (dt) => {
    ctx.fillStyle = 'rgba(255,236,222,.22)';
    for (const c of clouds) {
      c.x += c.v * dt / 1000;
      if (c.x > kx1) Object.assign(c, { x: kx0 - c.w, y: rnd(ky0, ky1), w: rnd(14, 30) });
      for (let yy = -3; yy <= 3; yy++) {
        const half = Math.round(c.w / 2 * Math.sqrt(1 - (yy / 4) ** 2)), Y = Math.round(c.y + yy);
        for (let xx = -half; xx <= half; xx++) { const X = Math.round(c.x + xx); if (sky[Y * W + X]) ctx.fillRect(X, Y, 1, 1); }
      }
    }
  };

  const [dx0, dy0, dx1, dy1] = fx.dust;
  const dust = Array.from({ length: 45 }, () => ({ x: rnd(dx0, dx1), y: rnd(dy0, dy1), vx: rnd(-0.6, 0.6), vy: rnd(-1.2, -0.2), ph: rnd(0, 6.3) }));
  const drawDust = (now, dt) => {
    for (const d of dust) {
      d.x += (d.vx + Math.sin(now / 1700 + d.ph) * 0.5) * dt / 250; d.y += d.vy * dt / 250;
      if (d.y < dy0 - 10) { d.y = dy1; d.x = rnd(dx0, dx1); }
      ctx.fillStyle = `rgba(255,236,200,${0.25 + 0.25 * Math.sin(now / 500 + d.ph)})`; ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 1);
    }
  };

  // Readers walk the floor in front of the bookcases to a shelf, face it, stand, reach up, take a book and read it, some for
  // a long while, then walk on to another. The reading tables in front hide their legs (library-depth.png).
  const { floor, shelves, spread, speed, browse } = fx.readers;
  const shelf = () => shelves[Math.random() * shelves.length | 0] + rnd(-spread, spread);
  let readers = [];
  sheet.then((s) => {
    if (s) readers = s.frames.map((frames) => ({ s, frames, x: rnd(shelves[0] - 60, shelves.at(-1) + 60), v: rnd(...speed), dist: rnd(0, 100), pose: -1, until: 0, to: shelf(), left: false }));
  });
  const drawReaders = (now, dt) => {
    for (const r of readers) {
      if (r.pose < 0) {   // walking to the shelf picked, a step of the cycle per stride of ground
        const step = Math.min(Math.abs(r.to - r.x), r.v * dt / 1000);
        r.left = r.to < r.x;
        r.x += r.left ? -step : step;
        r.dist += step;
        if (Math.abs(r.to - r.x) < 1) { r.pose = 0; r.until = now + rnd(...browse[0]); r.left = false; }   // there: face the shelf
      } else if (now > r.until && ++r.pose < browse.length) r.until = now + rnd(...browse[r.pose]);
      else if (r.pose >= browse.length) { r.pose = -1; r.to = shelf(); }
      sprite(r.s, r.frames[r.pose < 0 ? Math.floor(r.dist / r.s.stride * r.s.walk) % r.s.walk : r.s.walk + r.pose], r.x, floor, r.left);
    }
  };

  return (now, dt) => { drawReaders(now, dt); drawFire(now, dt); drawClouds(dt); drawDust(now, dt); };
}
