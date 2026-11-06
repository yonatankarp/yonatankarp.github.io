// The Radio Mast's studio (/podcast/) and the Post Office's hall (/contact/), their own bundle: the header's room is
// opened on its middle where a phone pans it, and comes alive over its picture (scene-fx.js). The studio's on-air lamp
// breathes, its tape reels turn, its VU needles bounce and the mast's beacon blinks out of the window; the hall's clock
// ticks the real seconds, its lamps' warmth breathes and dust drifts in the grille window's light. Where, from
// ROOM-fx.json, written by web3d/pixel/gen_rooms.py.
import { animate, rnd } from './scene-fx.js';

const hero = document.querySelector('.room-hero');
const canvas = hero?.querySelector('.room-fx');
if (hero) {
  // Where the room is wider than the screen, it opens at its data-open (0 the left edge, 1 the right).
  const open = () => { hero.scrollLeft = (hero.scrollWidth - hero.clientWidth) * Number(hero.dataset.open); };
  const img = hero.querySelector('img');
  if (img.complete) open(); else img.addEventListener('load', open);
  animate(canvas, { data: canvas.dataset.fx }, canvas.dataset.room === 'radio' ? radio : post);
}

const disc = (ctx, cx, cy, r) => {
  for (let y = -r; y <= r; y++) { const h = Math.round(Math.sqrt(r * r - y * y)); ctx.fillRect(cx - h, cy + y, h * 2 + 1, 1); }
};
const ray = (ctx, cx, cy, a, from, to, size = 1) => {
  for (let k = from; k < to; k++) ctx.fillRect(Math.round(cx + Math.cos(a) * k), Math.round(cy + Math.sin(a) * k), size, size);
};

function radio(ctx, fx) {
  const [lx, ly] = fx.lamp, [bx, by] = fx.beacon;
  return (now) => {
    const p = 0.55 + 0.45 * Math.sin(now / 520);   // the on-air lamp, its glow spilling on the wall
    for (const [r, c] of [[22, `rgba(255,70,50,${0.12 * p})`], [15, `rgba(255,90,60,${0.18 * p})`], [8, `rgba(255,150,120,${0.35 * p})`]]) {
      ctx.fillStyle = c; disc(ctx, lx, ly, r);
    }
    ctx.fillStyle = 'rgba(40,30,25,.75)';   // three spokes go round over each painted hub
    for (const [cx, cy, r, dir] of fx.reels) for (let s = 0; s < 3; s++) ray(ctx, cx, cy, now / 700 * dir + s * 2.094, 4, r - 3, 2);
    ctx.fillStyle = 'rgba(30,20,15,.9)';
    for (const [cx, cy] of fx.needles) ray(ctx, cx, cy, -2.4 + 1.6 * (0.35 + 0.45 * Math.abs(Math.sin(now / 130 + cx) * Math.sin(now / 410))), 0, 7);
    if ((now / 900 | 0) % 2) {
      ctx.fillStyle = 'rgba(255,80,60,.3)'; ctx.fillRect(bx - 2, by - 2, 6, 6);
      ctx.fillStyle = 'rgb(255,60,40)'; ctx.fillRect(bx, by, 2, 2);
    }
  };
}

function post(ctx, fx) {
  const [cx, cy] = fx.clock, [x0, y0, x1, y1] = fx.dust;
  const dust = Array.from({ length: 30 }, () => ({ x: rnd(x0, x1), y: rnd(y0, y1), v: rnd(0.5, 1.5), ph: rnd(0, 6.3) }));
  return (now, dt) => {
    ctx.fillStyle = 'rgba(150,30,25,.95)';   // the second hand, at the visitor's own seconds
    ray(ctx, cx, cy, (Math.floor(Date.now() / 1000) % 60) / 60 * 2 * Math.PI - Math.PI / 2, -3, 21);
    ctx.fillStyle = `rgba(255,210,140,${0.06 + 0.03 * Math.sin(now / 900)})`;
    for (const [x, y] of fx.lamps) disc(ctx, x, y, 18);
    for (const d of dust) {
      d.y -= 0.004 * dt * d.v; d.x += Math.sin(now / 1500 + d.ph) * 0.05;
      if (d.y < y0) Object.assign(d, { y: y1, x: rnd(x0, x1) });
      ctx.fillStyle = `rgba(255,240,200,${0.3 + 0.25 * Math.sin(now / 400 + d.ph)})`; ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 1);
    }
  };
}
