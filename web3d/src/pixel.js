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
const GROUND = ['#33231a', '#1f1610'];                        // under the garage: the earth's top line, then soil
const DOOR = { x0: 51, x1: 96, mid: 74, y0: 72, y1: 153 };      // the painted lift doors; mirrors gen_floors.DOOR
const FOCUS = { 2: 330, 3: 250 };                               // on narrow screens, the art x kept mid-screen (else 300)
const FADE_IN_MS = 300;                                         // a picture that arrives late fades in over its stand-in
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');   // read live: it can change after load
// The phone layout: the same query as every phone rule in pixel.css, so the canvas and the cards always agree (#46).
const narrow = matchMedia('(max-width: 760px), (max-aspect-ratio: 6/5)');
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
// The old one-page site's anchors, still linked from elsewhere, land on the floor that took their place (#29).
const LEGACY = { about: 'L', testimonial: 'L', contact: 'R', experience: '7', proof: '7', 'client-and-work-section': 'P' };
// Hugo lowercases menu URLs, so the site menu's About arrives as #floor-l.
const hashKey = () => { const h = location.hash.slice(1); return LEGACY[h] ?? (h.match(/^floor-(\w+)$/) || [])[1]?.toUpperCase(); };

export function mountPixel({ canvas, stops, base = '/building/', windowsBox, pauseButton }) {
  const ctx = canvas.getContext('2d');
  const keys = stops.map((s) => s.dataset.floor);
  const strips = new Map();         // key -> Image (or null while loading / missing)
  const open = new Map();           // key -> 0..1, lift doors
  let loads = 0, fading = 0;        // bumped by every image or file that arrives: the picture changes (and fades in)
  const loaded = () => { loads++; fading = performance.now() + FADE_IN_MS; wake(); };
  const street = streetView(base, windowsBox, stops, loaded);   // first: the street is the first screen
  for (const key of keys.filter((k) => k !== 'E')) {   // the street is exterior.png, not a strip
    const img = new Image();
    img.onload = () => { img.since = performance.now(); strips.set(key, img); loaded(); };
    img.onerror = () => { strips.set(key, null); loaded(); };
    img.src = `${base}pixel/floor-${key}.png`;
  }

  // ---- the ride ----
  // v: the speed carried over from a ride retargeted mid-way (floors per unit of u), so the cab never stops dead.
  const ride = { from: 0, to: 0, start: 0, dur: 0, fade: false, v: 0 };
  const eAt = keys.indexOf('E');                               // the street view's stop
  const fromHash = keys.indexOf(hashKey());
  ride.from = ride.to = Math.max(0, fromHash);
  if (fromHash >= 0 && location.hash !== `#floor-${keys[fromHash]}`) {   // a legacy or lowercased anchor: show the floor's own
    history.replaceState(null, '', `#floor-${keys[fromHash]}`);
    requestAnimationFrame(() => document.documentElement.classList.contains('building--guided') || stops[fromHash].scrollIntoView());
  }
  const rideU = (now) => (ride.dur ? clamp01((now - ride.start) / ride.dur) : 1);
  // A carried speed rides a cubic Hermite (smoothstep plus the speed's term), which lands without overshooting.
  const pos = (u) => ride.from + (ride.to - ride.from) * (ride.v ? u * u * (3 - 2 * u) : easeInOut(u)) + ride.v * u * (1 - u) ** 2;
  const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));
  function go(index) {
    const now = performance.now(), u = rideU(now);
    const to = Math.max(0, Math.min(keys.length - 1, index));
    if (to === ride.to || (ride.fade && u < 1)) return false;   // already on its way there; a dissolve runs to its end
    const here = pos(u), vel = u < 1 ? (here - pos(rideU(now - 16))) / 16 : 0;   // floors per ms
    const fade = eAt >= 0 && (to === eAt || Math.abs(here - eAt) < 1e-3);   // going in or out: a dissolve, not a ride
    const still = reduceMotion.matches;
    const dur = fade ? 900 : Math.min(2600, 1150 + 380 * Math.max(0, Math.abs(to - here) - 1));
    const closeMs = still ? 0 : ((open.get(keys[Math.round(here)]) ?? 0) / 2.2) * 1000;   // the doors shut, then it moves
    Object.assign(ride, { from: here, to, start: now + closeMs, fade, dur: still ? 1 : dur, v: fade || still ? 0 : vel * dur });
    history.replaceState(null, '', `#floor-${keys[to]}`);
    arrived = -1;   // a ride redirected back to the floor it left still arrives there (#31)
    emit('building:depart', { index: to, key: keys[to], dir: fade ? 0 : Math.sign(to - here) });
    wake();
    return true;
  }

  // Floor stop index -> height in the tower, in art pixels (higher floors further up the screen).
  const level = (key) => ORDER.indexOf(key === 'E' ? 'R' : key) * FH;   // the street has no storey: it dissolves
  const lerpAt = (p, of) => {
    const k = Math.min(Math.floor(p), keys.length - 1);
    const a = of(keys[k]), b = of(keys[Math.min(k + 1, keys.length - 1)]);
    return a + (b - a) * (p - k);
  };

  // The room loops only while it is allowed to move: the pause button (WCAG 2.2.2) and reduced motion hold it on
  // its rest frame. A frame that would draw the same picture is skipped, and once nothing is moving the loop
  // sleeps: until the next frame of the loop, or for good while held, until a ride, a resize or a load wakes it (#36).
  let paused = false, raf = 0, timer = 0, drawn = '';
  function wake() { clearTimeout(timer); raf ||= requestAnimationFrame(frame); }
  // Reduced motion has nothing to pause: the button hides, and shows again if it is turned off after load (#128).
  const label = () => {
    if (!pauseButton) return;
    pauseButton.hidden = reduceMotion.matches;
    pauseButton.dataset.paused = paused;
    pauseButton.setAttribute('aria-label', paused ? 'Play the animation' : 'Pause the animation');
    pauseButton.title = pauseButton.getAttribute('aria-label');
    pauseButton.querySelector('[data-building-pause-label]').textContent = paused ? 'Play' : 'Pause';
  };
  label();
  pauseButton?.addEventListener('click', () => { paused = !paused; label(); wake(); });
  addEventListener('resize', wake);
  reduceMotion.addEventListener('change', () => { label(); wake(); });

  let passing = -1, arrived = -1, last = performance.now();
  function frame(now) {
    raf = requestAnimationFrame(frame);   // first, so a frame that throws cannot stop the loop
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // Drawn in device pixels, so every art pixel is the same whole number of them; laid out in CSS pixels.
    const dpr = devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
    const w = Math.round(W * dpr), h = Math.round(H * dpr);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; drawn = ''; }
    ctx.imageSmoothingEnabled = false;
    const wide = !narrow.matches, still = reduceMotion.matches;

    const u = rideU(now);
    const p = ride.fade ? (u < 0.5 ? ride.from : ride.to) : Math.min(keys.length - 1, Math.max(0, pos(u)));
    const inner = ride.fade ? (ride.to === eAt ? ride.from : ride.to) : -1;   // the floor seen through the dissolve
    const at = inner >= 0 ? inner : p;                                        // held still through a dissolve
    const s = Math.round(dpr * Math.max(2, Math.floor(wide ? Math.min(W / FW, H / (FH * 1.15)) : H / (FH * 2.2))));
    const focus = Math.round(lerpAt(at, (k) => FOCUS[k] ?? 300));
    const x0 = wide ? Math.round((w - FW * s) / 2) : Math.min(0, Math.max(w - FW * s, Math.round(w / 2 - focus * s)));
    const cy = wide ? h / 2 : h * 0.3;                         // phones keep the room above the card
    const camY = Math.round(lerpAt(at, level));                // whole art pixels: no shimmer
    const near = Math.round(p);
    if (near !== passing) { passing = near; emit('building:floor', { index: near, key: keys[near] }); }
    if (u === 1 && arrived !== ride.to) { arrived = ride.to; emit('building:arrive', { index: ride.to, key: keys[ride.to] }); }

    const loopMs = (FRAMES * 1000) / FPS;
    const phase = now % (loopMs + REST_MS);
    const f = paused || still || phase >= loopMs ? 0 : Math.floor(phase / (1000 / FPS));
    for (const key of ORDER) {
      const here = u === 1 && keys[ride.to] === key;
      open.set(key, clamp01((open.get(key) ?? 0) + (here ? dt : -dt) * (still ? 99 : 2.2)));
    }
    const streetA = ride.fade ? (ride.to === eAt ? easeInOut(u) : 1 - easeInOut(u)) : street.alpha(p, eAt);
    const sig = [f, camY, streetA, loads, now < fading && now, ...open.values()].join();
    if (sig === drawn) {
      if (u === 1) {   // still: sleep until the loop's next frame, or until woken
        cancelAnimationFrame(raf); raf = 0;
        if (!paused && !still) timer = setTimeout(wake, phase < loopMs ? 1000 / FPS - (phase % (1000 / FPS)) : loopMs + REST_MS - phase);
      }
      return;
    }
    drawn = sig;

    ctx.fillStyle = '#151923';
    ctx.fillRect(0, 0, w, h);
    if (streetA < 1) for (const key of ORDER) {
      const y = Math.round(cy - FH * s / 2 - (level(key) - camY) * s);
      if (key === 'R' && y > 0) { ctx.fillStyle = SKY; ctx.fillRect(0, 0, w, y + 1); }   // the sky goes on above the roof
      if (key === 'P' && y + FH * s < h) {                                                // and the ground under the garage
        ctx.fillStyle = GROUND[1]; ctx.fillRect(0, y + FH * s, w, h);
        ctx.fillStyle = GROUND[0]; ctx.fillRect(0, y + FH * s, w, s);
      }
      if (y > h || y + FH * s < 0) continue;
      const img = strips.get(key);
      ctx.fillStyle = '#1f2532';   // a plain storey until its picture arrives (or if it never does)
      if (!img || now - img.since < FADE_IN_MS) ctx.fillRect(0, y, w, FH * s);
      if (!img) continue;
      ctx.globalAlpha = clamp01((now - img.since) / FADE_IN_MS);
      ctx.drawImage(img, f * FW, 0, FW, FH, x0, y, FW * s, FH * s);
      // The room runs on to the screen's edges over the facade posts: after its frames the strip holds a run of t
      // columns that carries on left of art x 8 and another right of 472 (gen_floors.EDGES), tiled outwards.
      // shortcut: past t art px (a screen over ~4.5:1) a run repeats with a step; give it longer runs if that matters.
      const t = (img.width - FRAMES * FW) / 2;
      if (wide && t > 0) {
        for (let gx = x0 + (8 - t) * s; gx + t * s > 0; gx -= t * s) ctx.drawImage(img, FRAMES * FW, 0, t, FH, gx, y, t * s, FH * s);
        for (let gx = x0 + 472 * s; gx < w; gx += t * s) ctx.drawImage(img, FRAMES * FW + t, 0, t, FH, gx, y, t * s, FH * s);
      } else {   // a strip cached from before the runs: its outermost columns, stretched
        if (x0 > 0) ctx.drawImage(img, f * FW, 0, 1, FH, 0, y, x0, FH * s);
        if (x0 + FW * s < w) ctx.drawImage(img, f * FW + FW - 1, 0, 1, FH, x0 + FW * s, y, w - x0 - FW * s, FH * s);
      }
      drawDoors(ctx, img, f, x0, y, s, open.get(key));
      ctx.globalAlpha = 1;
    }
    street.draw(ctx, f, w, h, streetA, dpr, wide);
  }
  wake();
  // e.g. the site menu's About; a pick the lift ignores (it is already going there, or mid-dissolve) keeps its hash
  addEventListener('hashchange', () => { const i = keys.indexOf(hashKey()); if (i >= 0 && !go(i)) history.replaceState(null, '', `#floor-${keys[ride.to]}`); });
  return { go, index: () => ride.to, moving: () => rideU(performance.now()) < 1 || arrived !== ride.to };
}

// The painted door halves slide apart over a lit cab, a whole pixel at a time.
function drawDoors(ctx, img, f, x0, y0, s, open) {
  if (open <= 0) return;                                        // closed: the strip already shows the doors
  const gap = Math.round(open * (DOOR.mid - DOOR.x0 - 2));
  const top = y0 + DOOR.y0 * s, h = DOOR.y1 - DOOR.y0;
  const lw = DOOR.mid - DOOR.x0, rw = DOOR.x1 - DOOR.mid;
  const left = x0 + DOOR.x0 * s, width = (DOOR.x1 - DOOR.x0) * s;
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, width, h * s);
  ctx.clip();
  ctx.fillStyle = '#30363e'; ctx.fillRect(left, top, width, h * s);              // the cab's back wall
  ctx.fillStyle = '#f2b13b'; ctx.fillRect(left, top, width, s);                  // its ceiling light
  ctx.fillStyle = '#4a525c'; ctx.fillRect(left, top + 44 * s, width, s);         // the handrail
  ctx.fillStyle = '#1c2026'; ctx.fillRect(left, top + (h - 1) * s, width, s);    // the floor
  ctx.drawImage(img, f * FW + DOOR.x0, DOOR.y0, lw, h, x0 + (DOOR.x0 - gap) * s, top, lw * s, h * s);
  ctx.drawImage(img, f * FW + DOOR.mid, DOOR.y0, rw, h, x0 + (DOOR.mid + gap) * s, top, rw * s, h * s);
  ctx.restore();
}

// The street view: the whole building at dusk (web3d/pixel/gen_exterior.py), its windows live crops of the rooms.
// Its windows are buttons laid over the canvas; the street left and right of the picture repeats its neighbours.
function streetView(base, box, stops, loaded) {
  const view = { img: null, since: 0, size: [480, 336], windows: {}, top: SKY, bottom: '#2a2226', at: null };
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    c.canvas.width = 1; c.canvas.height = view.size[1];
    c.drawImage(img, 0, 0);
    const px = (y) => `rgb(${[...c.getImageData(0, y, 1, 1).data.slice(0, 3)]})`;
    Object.assign(view, { img, since: performance.now(), top: px(0), bottom: px(view.size[1] - 1) });
    loaded();
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
    loaded();
  }).catch(() => {});
  document.addEventListener('building:depart', () => box?.classList.remove('is-here'));
  document.addEventListener('building:arrive', (e) => box?.classList.toggle('is-here', e.detail.key === 'E'));

  // The neighbours repeated down the street, left and right: whole periods of the road's 24 px dashes, so the
  // dashes and joints run on across the seams (art columns 95|0 on the left, 479|408 on the right).
  const SIDE = [96, 72];
  const PAD = 4;     // art pixels around each window that still take its tap: half the gap to the next floor (#45)
  let clear = 0, sized = '';   // CSS --street-top: the bottom of whatever sits over the top of the street, read per size
  function layout(w, h, dpr, wide) {   // in device pixels, sized by the CSS height; the building centred beside the card, the street under it
    const [EW, EH] = view.size, W = w / dpr, H = h / dpr, rects = Object.values(view.windows);
    const top = Math.min(...rects.map((r) => r[1])) - PAD, bottom = Math.max(...rects.map((r) => r[3])) + PAD;   // the roof's window, the ground floor's
    const fit = rects.length ? (H - clear) / (bottom - top) : Infinity;   // every window between the top bar and the bottom edge
    const s = Math.round(dpr * Math.max(1, Math.floor(Math.min(fit, wide ? Math.min(H / EH, (W - 440) / 200) : Math.min(H * 0.62 / EH, W / 200)))));
    const cx = (wide ? 440 + (W - 440) / 2 : W / 2) * dpr;
    // The street at the bottom; on a short screen it sinks until the top window is clear of the top bar.
    return { s, x: Math.round(cx - (EW / 2) * s), y: Math.max(Math.round((wide ? h : h * 0.62) - EH * s), Math.round(clear * dpr) - top * s) };
  }
  return {
    alpha: (p, at) => (at < 0 ? 0 : clamp01(1 - Math.abs(p - at))),
    draw(ctx, f, w, h, a, dpr, wide) {
      if (a <= 0) return;
      if (sized !== `${w},${h}`) { sized = `${w},${h}`; clear = parseFloat(getComputedStyle(ctx.canvas).getPropertyValue('--street-top')) || 0; }
      const [EW, EH] = view.size, { s, x, y } = layout(w, h, dpr, wide), src = f * EW, [L, R] = SIDE;
      ctx.globalAlpha = a;   // the sky and the road's flat colours, all there is until the picture arrives
      ctx.fillStyle = view.top; ctx.fillRect(0, 0, w, y + EH * s - s);
      ctx.fillStyle = view.bottom; ctx.fillRect(0, y + EH * s - s, w, h);
      if (view.img) {
        ctx.globalAlpha = a * clamp01((performance.now() - view.since) / FADE_IN_MS);
        ctx.drawImage(view.img, src, 0, EW, EH, x, y, EW * s, EH * s);
        for (let gx = x - L * s; gx > -L * s; gx -= L * s) ctx.drawImage(view.img, src, 0, L, EH, gx, y, L * s, EH * s);
        for (let gx = x + EW * s; gx < w; gx += R * s) ctx.drawImage(view.img, src + EW - R, 0, R, EH, gx, y, R * s, EH * s);
      }
      ctx.globalAlpha = 1;
      const at = `${s},${x},${y},${dpr}`;
      if (at === view.at) return;
      view.at = at;
      for (const [b, [x0, y0, x1, y1]] of buttons) {
        const css = (v) => `${v / dpr}px`;
        Object.assign(b.style, { left: css(x + (x0 - PAD) * s), top: css(y + (y0 - PAD) * s), width: css((x1 - x0 + 2 * PAD) * s), height: css((y1 - y0 + 2 * PAD) * s) });
      }
    },
  };
}

const canvas = document.querySelector('#pixel-canvas');
if (canvas) {
  const stops = [...document.querySelectorAll('section[data-floor]')];
  const api = mountPixel({ canvas, stops, base: canvas.dataset.base || '/building/', windowsBox: document.querySelector('[data-exterior-windows]'), pauseButton: document.querySelector('[data-building-pause]') });
  guide(api);
  if (import.meta.env?.DEV) window.__building = api;
}
