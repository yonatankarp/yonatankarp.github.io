// The Radio Mast's studio (/podcast/) and the Post Office's hall (/contact/), their own bundle: the header's room is
// opened on its middle where a phone pans it, and comes alive over its picture (scene-fx.js). The studio's tape reels
// turn, its VU needles bounce and the mast's beacon blinks out of the window (its on-air lamp no longer glows: the show
// is off air, data/rooms.yaml); the hall's clock ticks the real seconds, its lamps' warmth breathes and dust drifts in
// the grille window's light. Where, from ROOM-fx.json, written by web3d/pixel/gen_rooms.py, with the studio's reels from
// radio-reels.webp.
import { arrive } from './iris.js';
import { animate, rnd } from './scene-fx.js';

const hero = document.querySelector('.room-hero');
const canvas = hero?.querySelector('.room-fx');
const sheet = canvas?.dataset.sheet && Object.assign(new Image(), { src: canvas.dataset.sheet });   // the studio's reels
if (hero) {
  // Where the room is wider than the screen, it opens at its data-open (0 the left edge, 1 the right).
  const open = () => { hero.scrollLeft = (hero.scrollWidth - hero.clientWidth) * Number(hero.dataset.open); stop(); };
  // A tab stop (the markup's, for a page without this script) only while there is something to scroll (#305).
  const stop = () => { hero.tabIndex = hero.scrollWidth > hero.clientWidth ? 0 : -1; };
  addEventListener('resize', stop);
  const img = hero.querySelector('img');
  if (img.complete) open(); else img.addEventListener('load', open);
  animate(canvas, { data: canvas.dataset.fx }, canvas.dataset.room === 'radio' ? radio : post);
  // In from the city's push-in: its frame opens from the header's middle, the room settling about it.
  arrive(img, () => {
    open();
    const r = hero.getBoundingClientRect(), map = img.parentElement;
    return { at: [r.left + hero.clientWidth / 2, r.top + r.height / 2], settle: [[map, hero.scrollLeft + hero.clientWidth / 2, hero.clientHeight / 2]] };   // the head's middle: the room's foot is cropped
  });
}

const disc = (ctx, cx, cy, r) => {
  for (let y = -r; y <= r; y++) { const h = Math.round(Math.sqrt(r * r - y * y)); ctx.fillRect(cx - h, cy + y, h * 2 + 1, 1); }
};
const ray = (ctx, cx, cy, a, from, to, size = 1) => {
  for (let k = from; k < to; k++) ctx.fillRect(Math.round(cx + Math.cos(a) * k), Math.round(cy + Math.sin(a) * k), size, size);
};

function radio(ctx, fx) {
  const [bx, by] = fx.beacon;
  // The reels' sheet (gen_rooms.py reels()): a column each, the bare reel over its cutouts, which turn about the hub on
  // the slanted disc, in the art's own pixels.
  const row = Math.max(...fx.reels.map(([, , , ry]) => 2 * ry + 1));
  let left = 0;
  const reels = fx.reels.map(([x, y, rx, ry, dir]) => { const r = { x, y, rx, ry, dir, sx: left }; left += 2 * rx + 1; return r; });
  ctx.imageSmoothingEnabled = false;
  return Object.assign((now) => {
    for (const { x, y, rx, ry, dir, sx } of sheet?.complete && sheet.naturalWidth ? reels : []) {
      const w = 2 * rx + 1, h = 2 * ry + 1;
      ctx.drawImage(sheet, sx, 0, w, h, x - rx, y - ry, w, h);
      ctx.save();
      ctx.translate(x + 0.5, y + 0.5); ctx.scale(rx, ry); ctx.rotate(now / 700 * dir); ctx.scale(1 / rx, 1 / ry);
      ctx.drawImage(sheet, sx, row, w, h, -rx - 0.5, -ry - 0.5, w, h);
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(30,20,15,.9)';
    for (const [cx, cy] of fx.needles) ray(ctx, cx, cy, -2.4 + 1.6 * (0.35 + 0.45 * Math.abs(Math.sin(now / 130 + cx) * Math.sin(now / 410))), 0, 7);
    if ((now / 900 | 0) % 2) {
      ctx.fillStyle = 'rgba(255,80,60,.3)'; ctx.fillRect(bx - 2, by - 2, 6, 6);
      ctx.fillStyle = 'rgb(255,60,40)'; ctx.fillRect(bx, by, 2, 2);
    }
  }, { ready: sheet && sheet.decode().catch(() => {}) });
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
