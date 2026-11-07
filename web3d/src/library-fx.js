// The Library's life (layouts/blog/list.html, its own bundle): readers browsing the shelves, the fire flickering with a
// breathing glow and rising embers, dust turning in the window's light, and clouds passing outside, only over the
// window's sky, so behind its frames and the rooftops. Over the header's picture, cropped as it is (scene-fx.js); where
// is library-fx.json, written by web3d/pixel/gen_library.py, and the readers are gen_walkers.py's readers sheet. One
// painting, at dusk, so no hours.
import { arrive } from './iris.js';
import { readers } from './readers.js';
import { animate, people, rnd } from './scene-fx.js';

const canvas = document.querySelector('.library-fx');
if (canvas) {
  const sheet = people((ext) => `${canvas.dataset.readers}.${ext}?v=${canvas.dataset.version}`, false);
  animate(canvas, { data: canvas.dataset.fx, depth: canvas.dataset.depth }, (ctx, fx, test) => setup(ctx, fx, test, sheet));
  // In from the city's push-in: its frame opens from the header's middle, the room and its life settling about it.
  const img = canvas.previousElementSibling;
  arrive(img, () => {
    const r = img.getBoundingClientRect(), o = [r.width / 2, r.height / 2];
    return { at: [r.left + o[0], r.top + o[1]], settle: [[img, ...o], [canvas, ...o]] };
  });
}

function setup(ctx, fx, { dfill, sprite }, sheet) {
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
        let run = 0, from = 0;   // a rect for each run of sky pixels in a row
        for (let xx = -half; xx <= half + 1; xx++) {
          const X = Math.round(c.x + xx), on = xx <= half && sky[Y * W + X];
          if (on && run && X === from + run) { run++; continue; }
          if (run) ctx.fillRect(from, Y, run, 1);
          [from, run] = on ? [X, 1] : [0, 0];
        }
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

  // Readers walking the floor in front of the bookcases, stopping to look, to take a book and read, each its own way
  // (readers.js), each on a soft shadow the width of its feet. Only the reading lamps and tables hide them: the depth map
  // is made for them (gen_library.py's backdrop), so they are tested from depth 0.
  const crowd = readers(fx.readers, 3), floor = fx.readers.floor;
  let looks = null;
  sheet.then((s) => { looks = s; });
  const feet = (fr) => {   // the columns its feet cover: its pixels in the 4 rows down to its sole
    if (!fr.feet) {
      const xs = fr.cells.flatMap(({ px }) => px.filter((_, i) => i % 2 === 0 && px[i + 1] >= fr.foot - 3));
      fr.feet = [Math.min(...xs), Math.max(...xs)];
    }
    return fr.feet;
  };
  const shadow = (fr, x, left) => {   // a wider faint ellipse and a darker core, in the room's own shadow brown
    let [a, b] = feet(fr);
    if (left) [a, b] = [looks.w - 1 - b, looks.w - 1 - a];
    const cx = Math.round(x) - (looks.w >> 1) + (a + b) / 2, w = (b - a) / 2 + 6;
    for (const [alpha, across, down] of [[0.3, 1, 2.6], [0.35, 0.7, 1.6]]) {
      ctx.fillStyle = `rgba(24,10,6,${alpha})`;
      for (let y = -2; y <= 2; y++) {
        const t = 1 - (y / down) ** 2, half = Math.round(w * across * Math.sqrt(t));
        if (t > 0) dfill(Math.round(cx - half), floor + y, 2 * half + 1, 1, 0);
      }
    }
  };
  const drawReaders = (now, dt) => {
    crowd.step(now, dt);
    if (!looks) return;
    crowd.all.forEach((r, i) => {
      if (!r.shown) return;
      const frames = looks.frames[i % looks.frames.length], p = crowd.pose(r);
      const fr = frames[p < 0 ? Math.floor(r.dist / looks.stride * looks.walk) % looks.walk : looks.walk + p];
      shadow(fr, r.x, r.left);
      sprite(looks, fr, r.x, floor, r.left, 0);
    });
  };

  return Object.assign((now, dt) => { drawReaders(now, dt); drawFire(now, dt); drawClouds(dt); drawDust(now, dt); }, { ready: sheet });
}
