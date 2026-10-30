// Pixel building: one 480x180 pixel-art strip per floor (web3d/pixel/gen_floors.py), stacked into a tower and
// drawn at a whole-number scale so every pixel stays square. The lift rides between floors in whole art pixels.
// Reads its stops from the page (<section data-floor="KEY">) and emits the same events as the 3D renderer.
import { guide } from './guide.js';
import './styles.css';
import './pixel.css';

const FW = 480, FH = 180, FRAMES = 12, FPS = 8;
const REST_MS = 2600;   // after each action loop the room holds still, so the text keeps the reader's attention
const ORDER = ['P', 'L', '1', '2', '3', '4', '5', '6', '7', '8', 'R'];   // bottom to top
const SKY = '#74228a';                                        // the roof painting's top row
const DOOR = { x0: 51, x1: 97, mid: 74, y0: 69, y1: 153 };      // the painted lift doors; mirrors gen_floors.DOOR
const FOCUS_X = 300;                                            // on narrow screens, keep the room's middle in view
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
const clamp01 = (v) => Math.min(1, Math.max(0, v));

export function mountPixel({ canvas, stops, base = '/building/', windowsBox }) {
  const ctx = canvas.getContext('2d');
  const keys = stops.map((s) => s.dataset.floor);
  const strips = new Map();         // key -> Image (or null while loading / missing)
  const open = new Map();           // key -> 0..1, lift doors
  const street = streetView(base, windowsBox, stops);   // first: the street is the first screen
  for (const key of keys.filter((k) => k !== 'E')) {   // the street is exterior.png, not a strip
    const img = new Image();
    img.onload = () => strips.set(key, img);
    img.onerror = () => strips.set(key, null);
    img.src = `${base}pixel/floor-${key}.png`;
  }

  // ---- the ride ----
  const ride = { from: 0, to: 0, start: 0, dur: 0, fade: false };
  const eAt = keys.indexOf('E');                               // the street view's stop
  const fromHash = keys.indexOf((location.hash.match(/^#floor-(\w+)$/) || [])[1]);
  ride.from = ride.to = Math.max(0, fromHash);
  const rideU = (now) => (ride.dur ? clamp01((now - ride.start) / ride.dur) : 1);
  const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));
  function go(index) {
    const now = performance.now();
    const to = Math.max(0, Math.min(keys.length - 1, index));
    const here = ride.from + (ride.to - ride.from) * easeInOut(rideU(now));
    if (to === ride.to && rideU(now) === 1) return false;
    const fade = eAt >= 0 && (to === eAt || Math.abs(here - eAt) < 1e-3);   // going in or out: a dissolve, not a ride
    const dur = fade ? 900 : Math.min(2600, 1150 + 380 * Math.max(0, Math.abs(to - here) - 1));
    Object.assign(ride, { from: fade ? Math.round(here) : here, to, start: now, fade, dur: reduceMotion ? 1 : dur });
    history.replaceState(null, '', `#floor-${keys[to]}`);
    emit('building:depart', { index: to, key: keys[to], dir: Math.sign(to - here) });
    return true;
  }

  // Floor stop index -> height in the tower, in art pixels (higher floors further up the screen).
  const level = (key) => ORDER.indexOf(key === 'E' ? 'R' : key) * FH;   // the street has no storey: it dissolves
  const levelAt = (p) => {
    const k = Math.min(Math.floor(p), keys.length - 1);
    const a = level(keys[k]), b = level(keys[Math.min(k + 1, keys.length - 1)]);
    return a + (b - a) * (p - k);
  };

  let passing = -1, arrived = -1, last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);   // first, so a frame that throws cannot stop the loop
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.imageSmoothingEnabled = false;
    const wide = w / h > 1.2;
    const s = Math.max(2, Math.floor(wide ? Math.min(w / FW, h / (FH * 1.15)) : h / (FH * 2.2)));
    const x0 = wide ? Math.round((w - FW * s) / 2) : Math.round(w / 2 - FOCUS_X * s);
    const cy = wide ? h / 2 : h * 0.3;                         // phones keep the room above the card

    const u = rideU(now);
    const p = ride.fade ? (u < 0.5 ? ride.from : ride.to) : ride.from + (ride.to - ride.from) * easeInOut(u);
    const inner = ride.fade ? (ride.to === eAt ? ride.from : ride.to) : -1;   // the floor seen through the dissolve
    const camY = Math.round(inner >= 0 ? level(keys[inner]) : levelAt(p));   // whole art pixels: no shimmer
    const near = Math.round(p);
    if (near !== passing) { passing = near; emit('building:floor', { index: near, key: keys[near] }); }
    if (u === 1 && arrived !== ride.to) { arrived = ride.to; emit('building:arrive', { index: ride.to, key: keys[ride.to] }); }

    ctx.fillStyle = '#151923';
    ctx.fillRect(0, 0, w, h);
    const loopMs = (FRAMES * 1000) / FPS;
    const phase = now % (loopMs + REST_MS);
    const f = reduceMotion || phase >= loopMs ? 0 : Math.floor(phase / (1000 / FPS));
    const fallback = [...strips.values()].find(Boolean);       // floors not drawn yet borrow a dimmed neighbour
    const streetA = ride.fade ? (ride.to === eAt ? easeInOut(u) : 1 - easeInOut(u)) : street.alpha(p, eAt);
    if (streetA < 1) for (const key of ORDER) {
      const y = Math.round(cy - FH * s / 2 - (level(key) - camY) * s);
      if (y > h || y + FH * s < 0) continue;
      const img = strips.get(key) ?? (key === 'R' ? null : fallback);   // the roof has no stand-in
      if (!img) continue;
      if (key === 'R' && y > 0) { ctx.fillStyle = SKY; ctx.fillRect(x0, 0, FW * s, y + 1); }   // the sky goes on above the roof
      ctx.drawImage(img, f * FW, 0, FW, FH, x0, y, FW * s, FH * s);
      const here = u === 1 && keys[ride.to] === key;
      const o = Math.min(1, Math.max(0, (open.get(key) ?? 0) + (here ? dt : -dt) * (reduceMotion ? 99 : 2.2)));
      open.set(key, o);
      drawDoors(ctx, img, f, x0, y, s, o);
      if (!strips.get(key)) { ctx.fillStyle = 'rgba(13, 15, 20, 0.6)'; ctx.fillRect(x0, y, FW * s, FH * s); }
    }
    street.draw(ctx, f, w, h, streetA);
  }
  requestAnimationFrame(frame);
  return { go, index: () => ride.to, moving: () => rideU(performance.now()) < 1 };
}

// The painted door halves slide apart over the dark shaft, a whole pixel at a time.
function drawDoors(ctx, img, f, x0, y0, s, open) {
  if (open <= 0) return;                                        // closed: the strip already shows the doors
  const gap = Math.round(open * (DOOR.mid - DOOR.x0 - 2));
  const top = y0 + DOOR.y0 * s, h = DOOR.y1 - DOOR.y0;
  const lw = DOOR.mid - DOOR.x0, rw = DOOR.x1 - DOOR.mid;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0 + DOOR.x0 * s, top, (DOOR.x1 - DOOR.x0) * s, h * s);
  ctx.clip();
  ctx.fillStyle = '#0d0f14';
  ctx.fillRect(x0 + DOOR.x0 * s, top, (DOOR.x1 - DOOR.x0) * s, h * s);
  ctx.fillStyle = '#6a3f0c';                                     // the cab's light strip
  ctx.fillRect(x0 + DOOR.x0 * s, top + 2 * s, (DOOR.x1 - DOOR.x0) * s, s);
  ctx.drawImage(img, f * FW + DOOR.x0, DOOR.y0, lw, h, x0 + (DOOR.x0 - gap) * s, top, lw * s, h * s);
  ctx.drawImage(img, f * FW + DOOR.mid, DOOR.y0, rw, h, x0 + (DOOR.mid + gap) * s, top, rw * s, h * s);
  ctx.restore();
}

// The street view: the whole building at dusk (web3d/pixel/gen_exterior.py), its windows live crops of the rooms.
// Its windows are buttons laid over the canvas; the street left and right of the picture repeats its neighbours.
function streetView(base, box, stops) {
  const view = { img: null, size: [480, 336], windows: {}, top: SKY, bottom: '#1f2532', at: null };
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    c.canvas.width = 1; c.canvas.height = view.size[1];
    c.drawImage(img, 0, 0);
    const px = (y) => `rgb(${[...c.getImageData(0, y, 1, 1).data.slice(0, 3)]})`;
    Object.assign(view, { img, top: px(0), bottom: px(view.size[1] - 1) });
  };
  img.src = `${base}pixel/exterior.png`;
  const buttons = [];
  fetch(`${base}pixel/exterior.json`).then((r) => r.json()).then((j) => {
    Object.assign(view, j);
    for (const [key, rect] of Object.entries(j.windows)) {
      const label = document.querySelector(`.building-floor-btn[data-goto="${key}"]`)?.getAttribute('aria-label');
      if (!box || !label || !stops.some((s) => s.dataset.floor === key)) continue;
      const b = Object.assign(document.createElement('button'), { type: 'button', className: 'building-window' });
      b.dataset.goto = key;
      b.setAttribute('aria-label', label);
      box.append(b);
      buttons.push([b, rect]);
    }
    view.at = null;   // place the new buttons on the next frame, whichever of image and layout came first
  }).catch(() => {});
  document.addEventListener('building:depart', () => box?.classList.remove('is-here'));
  document.addEventListener('building:arrive', (e) => box?.classList.toggle('is-here', e.detail.key === 'E'));

  const SIDE = 84;   // the neighbours (clear of the crane and the parapet)' width either side of the building, repeated down the street
  function layout(w, h) {   // sized by the height; the building centred beside the card, the street running under it
    const [EW, EH] = view.size, wide = w / h > 1.2;
    const s = Math.max(1, Math.floor(wide ? Math.min(h / EH, (w - 440) / 200) : Math.min(h * 0.62 / EH, w / 200)));
    const cx = wide ? 440 + (w - 440) / 2 : w / 2;
    return { s, x: Math.round(cx - (EW / 2) * s), y: Math.round((wide ? h : h * 0.62) - EH * s) };   // the street at the bottom, the crane clear of the top bar
  }
  return {
    alpha: (p, at) => (at < 0 ? 0 : clamp01(1 - Math.abs(p - at))),
    draw(ctx, f, w, h, a) {
      if (a <= 0) return;
      if (!view.img) { ctx.globalAlpha = a; ctx.fillStyle = view.top; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; return; }   // still loading: just the sky
      const [EW, EH] = view.size, { s, x, y } = layout(w, h), src = f * EW;
      ctx.globalAlpha = a;
      ctx.fillStyle = view.top; ctx.fillRect(0, 0, w, y + s);
      ctx.fillStyle = view.bottom; ctx.fillRect(0, y + EH * s - s, w, h);
      ctx.drawImage(view.img, src, 0, EW, EH, x, y, EW * s, EH * s);
      for (let gx = x - SIDE * s; gx > -SIDE * s; gx -= SIDE * s) ctx.drawImage(view.img, src, 0, SIDE, EH, gx, y, SIDE * s, EH * s);
      for (let gx = x + EW * s; gx < w; gx += SIDE * s) ctx.drawImage(view.img, src + EW - SIDE, 0, SIDE, EH, gx, y, SIDE * s, EH * s);
      ctx.globalAlpha = 1;
      const at = `${s},${x},${y}`;
      if (at === view.at) return;
      view.at = at;
      for (const [b, [x0, y0, x1, y1]] of buttons) {
        Object.assign(b.style, { left: `${x + x0 * s}px`, top: `${y + y0 * s}px`, width: `${(x1 - x0) * s}px`, height: `${(y1 - y0) * s}px` });
      }
    },
  };
}

const canvas = document.querySelector('#pixel-canvas');
if (canvas) {
  const stops = [...document.querySelectorAll('section[data-floor]')];
  const api = mountPixel({ canvas, stops, base: canvas.dataset.base || '/building/', windowsBox: document.querySelector('[data-exterior-windows]') });
  guide(api);
  if (import.meta.env?.DEV) window.__building = api;
}
