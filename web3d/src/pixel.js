// Pixel building: one 480x180 pixel-art strip per floor (web3d/pixel/gen_floors.py), stacked into a tower and
// drawn at a whole-number scale so every pixel stays square. The lift rides between floors in whole art pixels.
// Reads its stops from the page (<section data-floor="KEY">) and emits the building:* events guide.js listens to.
import { guide } from './guide.js';
import '../../assets/js/copy-email.js';
import './styles.css';
import './pixel.css';

const FW = 480, FH = 180, FRAMES = 12, FPS = 8;
const REST_MS = 2600;   // after each action loop the room holds still, so the text keeps the reader's attention
const ORDER = ['P', 'L', '1', '2', '3', '4', '5', '6', '7', 'R'];   // bottom to top
const SKY = '#74228a';                                        // the roof painting's top row
const GROUND = ['#33231a', '#1f1610'];                        // under the garage: the earth's top line, then soil
const DOOR = { x0: 51, x1: 96, mid: 74, y0: 72, y1: 153 };      // the painted lift doors; mirrors gen_floors.DOOR
// Where each street window looks into its room, in strip pixels: mirrors gen_exterior.LOOK. The roof's is painted,
// not a slice, so going up there is the plain dissolve.
const LOOK = { L: [246, 122], 1: [322, 76], 2: [328, 82], 3: [266, 56], 4: [250, 64], 5: [222, 54], 6: [230, 96], 7: [205, 86], P: [166, 78] };
const FOCUS = { 2: 330, 3: 250 };                               // on narrow screens, the art x kept mid-screen (else 300)
const FADE_IN_MS = 300;                                         // a picture that arrives late fades in over its stand-in
const DOORS = 3.3;                                              // the lift doors' speed, in full travels per second
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');   // read live: it can change after load
// The phone layout: the same query as every phone rule in pixel.css, so the canvas and the cards always agree (#46).
const narrow = matchMedia('(max-width: 760px), (max-aspect-ratio: 6/5)');
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
// The old one-page site's anchors, still linked from elsewhere, land on the floor that took their place (#29); the
// closed newsroom's (floor 8) on the lobby, whose newsstand has the writing now.
const LEGACY = { about: 'L', testimonial: 'L', contact: 'R', experience: '7', proof: '7', 'client-and-work-section': 'P', 'floor-8': 'L' };
// Hugo lowercases menu URLs, so the site menu's About arrives as #floor-l.
const hashKey = () => { const h = location.hash.slice(1); return LEGACY[h] ?? (h.match(/^floor-(\w+)$/) || [])[1]?.toUpperCase(); };

export function mountPixel({ canvas, stops, base = '/building/', windowsBox, pauseButton }) {
  const ctx = canvas.getContext('2d');
  const keys = stops.map((s) => s.dataset.floor);
  const strips = new Map();         // key -> Image (or null while loading / missing)
  const open = new Map();           // key -> 0..1, lift doors
  let loads = 0, fading = 0;        // bumped by every image or file that arrives: the picture changes (and fades in)
  const loaded = () => { loads++; fading = performance.now() + FADE_IN_MS; wake(); };
  const started = new Set();
  const load = (key) => {
    if (key === 'E' || started.has(key)) return;   // the street is exterior.png, not a strip
    started.add(key);
    const img = new Image();
    img.onload = () => { img.since = performance.now(); strips.set(key, img); loaded(); };
    img.onerror = () => { strips.set(key, null); loaded(); };
    img.src = `${base}pixel/floor-${key}.png`;
  };
  const loadAll = () => keys.forEach(load);
  // The street is the first screen: the other floors wait until it has arrived (or failed), or the lift moves (#130).
  const street = streetView(base, windowsBox, stops, loaded, loadAll);

  // ---- the ride ----
  // v: the speed carried over from a ride retargeted mid-way (floors per unit of u), so the cab never stops dead.
  const ride = { from: 0, to: 0, start: 0, dur: 0, fade: false, v: 0 };
  const eAt = keys.indexOf('E');                               // the street view's stop
  const fromHash = keys.indexOf(hashKey());
  ride.from = ride.to = Math.max(0, fromHash);
  load(keys[ride.from]);   // a floor's own address shows that floor first, so it loads alongside the street
  if (fromHash >= 0 && location.hash !== `#floor-${keys[fromHash]}`) {   // a legacy or lowercased anchor: show the floor's own
    history.replaceState(null, '', `#floor-${keys[fromHash]}`);
    requestAnimationFrame(() => document.documentElement.classList.contains('building--guided') || stops[fromHash].scrollIntoView());
  }
  const rideU = (now) => (ride.dur ? clamp01((now - ride.start) / ride.dur) : 1);
  // A carried speed rides a cubic Hermite (smoothstep plus the speed's term), which lands without overshooting.
  const pos = (u) => ride.from + (ride.to - ride.from) * (ride.v ? u * u * (3 - 2 * u) : easeInOut(u)) + ride.v * u * (1 - u) ** 2;
  const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));
  function go(index) {
    loadAll();
    const now = performance.now(), u = rideU(now);
    const to = Math.max(0, Math.min(keys.length - 1, index));
    if (to === ride.to || (ride.fade && u < 1)) return false;   // already on its way there; a dissolve runs to its end
    const here = pos(u), vel = u < 1 ? (here - pos(rideU(now - 16))) / 16 : 0;   // floors per ms
    const fade = eAt >= 0 && (to === eAt || Math.abs(here - eAt) < 1e-3);   // going in or out: through a window, not a ride
    const still = reduceMotion.matches;
    const flies = fade && LOOK[keys[to === eAt ? Math.round(here) : to]];   // through a window; else the plain dissolve
    const dist = Math.abs(to - here), dur = fade ? (flies ? 1400 : 900) : Math.min(1600, 550 + 250 * Math.max(0, dist - 1));
    const closeMs = still ? 0 : ((open.get(keys[Math.round(here)]) ?? 0) / DOORS) * 1000;   // the doors shut, then it moves
    // The eased start moves the camera less than half an art pixel at first: that stretch runs as the doors finish.
    const hidden = vel || fade ? 0 : dur * Math.cbrt(1 / (1440 * Math.max(dist, 1e-3)));
    Object.assign(ride, { from: here, to, start: now + Math.max(0, closeMs - hidden), fade, dur: still ? 1 : dur, v: fade || still ? 0 : vel * dur });
    history.replaceState(null, '', `#floor-${keys[to]}`);
    arrived = -1;   // a ride redirected back to the floor it left still arrives there (#31)
    emit('building:depart', { index: to, key: keys[to], dir: fade ? 0 : Math.sign(to - here) });
    wake();
    return true;
  }

  // Floor stop index -> height in the tower, in art pixels (higher floors further up the screen).
  const level = (key) => ORDER.indexOf(key === 'E' ? 'L' : key) * FH;   // the street has no storey: it flies in
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

  let passing = -1, arrived = -1, last = performance.now(), cardTop = 0;
  function frame(now) {
    raf = requestAnimationFrame(frame);   // first, so a frame that throws cannot stop the loop
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    // Drawn in device pixels, so every art pixel is the same whole number of them; laid out in CSS pixels.
    const dpr = devicePixelRatio || 1, W = canvas.clientWidth, H = canvas.clientHeight;
    const w = Math.round(W * dpr), h = Math.round(H * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w; canvas.height = h; drawn = '';
      cardTop = parseFloat(getComputedStyle(canvas).getPropertyValue('--card-top')) || 0;   // CSS px; 0 where it is unset
    }
    ctx.imageSmoothingEnabled = false;
    const wide = !narrow.matches, still = reduceMotion.matches;

    const u = rideU(now);
    const p = ride.fade ? (u < 0.5 ? ride.from : ride.to) : Math.min(keys.length - 1, Math.max(0, pos(u)));
    const inner = ride.fade ? (ride.to === eAt ? ride.from : ride.to) : -1;   // the floor seen through the dissolve
    const at = inner >= 0 ? inner : p;                                        // held still through a dissolve
    let s = Math.round(dpr * Math.max(2, Math.floor(wide ? Math.min(W / FW, H / (FH * 1.15)) : H / (FH * 2.2))));
    // Phones: the room's floor sits behind the elevator, above the card (pixel.css --card-top). On a short phone
    // the room is drawn smaller, down to 4/3 CSS px an art pixel, still a whole number of device pixels (#127).
    const floorAt = cardTop - 28;
    if (!wide && cardTop) s = Math.min(s, Math.max(Math.ceil(dpr * 4 / 3), Math.floor(dpr * floorAt / FH)));
    const focus = Math.round(lerpAt(at, (k) => FOCUS[k] ?? 300));
    const x0 = wide ? Math.round((w - FW * s) / 2) : Math.min(0, Math.max(w - FW * s, Math.round(w / 2 - focus * s)));
    const cy = wide ? h / 2 : cardTop ? floorAt * dpr - FH * s / 2 : h * 0.3;   // phones keep the room above the card
    const ry = Math.round(cy - FH * s / 2);                    // the top of the floor in view
    const camY = Math.round(lerpAt(at, level));                // whole art pixels: no shimmer
    const near = Math.round(p);
    if (near !== passing) { passing = near; emit('building:floor', { index: near, key: keys[near] }); }
    // Arrived on the last pixel the camera moves: the eased tail after it changes nothing on screen.
    const landed = u === 1 || (!ride.fade && u > 0.5 && camY === level(keys[ride.to]));
    if (landed && arrived !== ride.to) { arrived = ride.to; emit('building:arrive', { index: ride.to, key: keys[ride.to] }); }

    const loopMs = (FRAMES * 1000) / FPS;
    const phase = now % (loopMs + REST_MS);
    const f = paused || still || phase >= loopMs ? 0 : Math.floor(phase / (1000 / FPS));
    for (const key of ORDER) {
      const here = arrived === ride.to && keys[ride.to] === key;
      open.set(key, clamp01((open.get(key) ?? 0) + (here ? dt : -dt) * (still ? 99 : DOORS)));
    }
    const inT = ride.fade ? (ride.to === eAt ? 1 - u : u) : 0;   // going in or out: 0 on the street, 1 in the room
    const streetA = ride.fade ? 1 - easeInOut(inT) : street.alpha(p, eAt);
    const fly = ride.fade && inT > 0 && inT < 1 ? street.fly(keys[inner], inT, w, h, dpr, wide, { s, x: x0, y: ry }) : null;
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
    if (fly) {   // the street darkens round the window, then the window opens onto the room
      street.draw(ctx, f, w, h, 1, dpr, wide, fly.street);
      ctx.globalAlpha = fly.dim; ctx.fillStyle = '#151923'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1;
      const [hx0, hy0, hx1, hy1] = fly.hole;
      ctx.save();
      ctx.beginPath(); ctx.rect(hx0, hy0, hx1 - hx0, hy1 - hy0); ctx.clip();
      tower(fly.room.s, fly.room.x, fly.room.y);
      street.draw(ctx, f, w, h, 1 - fly.roomA, dpr, wide, fly.street);   // the window's own pixels, until the room takes over
      ctx.restore();
      return;
    }
    if (streetA < 1) tower(s, x0, ry);
    street.draw(ctx, f, w, h, streetA, dpr, wide);

    // Every storey, the one in view with its top at ry; s and x0 are the frame's own, or the flight's.
    function tower(s, x0, ry) { for (const key of ORDER) {
      const y = ry - (level(key) - camY) * s;
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
    } }
  }
  wake();
  // e.g. the site menu's About; a pick the lift ignores (it is already going there, or mid-dissolve) keeps its hash
  addEventListener('hashchange', () => { const i = keys.indexOf(hashKey()); if (i >= 0 && !go(i)) history.replaceState(null, '', `#floor-${keys[ride.to]}`); });
  return { go, index: () => ride.to, moving: () => arrived !== ride.to };
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

// The street view: the whole building at dusk (web3d/pixel/gen_exterior.py), its windows live crops of the rooms,
// 1-7 dimmed behind each floor's company sign.
// Its windows are buttons laid over the canvas; the street left and right of the picture repeats its neighbours.
function streetView(base, box, stops, loaded, then) {
  const view = { img: null, since: 0, size: [480, 336], windows: {}, top: SKY, bottom: '#2a2226', at: null };
  const img = new Image();
  img.onload = () => {
    then();
    const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    c.canvas.width = 1; c.canvas.height = view.size[1];
    c.drawImage(img, 0, 0);
    const px = (y) => `rgb(${[...c.getImageData(0, y, 1, 1).data.slice(0, 3)]})`;
    Object.assign(view, { img, since: performance.now(), top: px(0), bottom: px(view.size[1] - 1) });
    loaded();
  };
  img.onerror = then;
  img.src = `${base}pixel/exterior.png`;
  const buttons = [];
  // The lift is the keyboard's way between floors, so the windows stay out of the Tab order, except where the lift is
  // hidden at the street (phones, pixel.css): there they are the only way in (#131).
  const tabbable = () => buttons.forEach(([b]) => { b.tabIndex = narrow.matches ? 0 : -1; });
  narrow.addEventListener('change', tabbable);
  fetch(`${base}pixel/exterior.json`).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); }).then((j) => {
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
    tabbable();
    view.at = null;   // place the new buttons on the next frame, whichever of image and layout came first
    loaded();
  }).catch((err) => {   // no windows to tap: the street shows the lift instead, even on phones (pixel.css .no-windows)
    console.error(`The street's windows did not load (${base}pixel/exterior.json):`, err);
    document.body.classList.add('no-windows');
  });
  document.addEventListener('building:depart', () => box?.classList.remove('is-here'));
  document.addEventListener('building:arrive', (e) => box?.classList.toggle('is-here', e.detail.key === 'E'));

  // The neighbours repeated down the street, left and right: whole periods of the road's 24 px dashes, so the
  // dashes and joints run on across the seams (art columns 95|0 on the left, 479|408 on the right).
  const SIDE = [96, 72];
  const PAD = 4;     // art pixels around each window that still take its tap: half the gap to the next floor (#45)
  const TOWER = 160; // on phones, the art width kept in view: the tower (x 170-310) and a sliver of its neighbours
  const hero = stops.find((s) => s.dataset.floor === 'E');
  let clear = 0, card = 0, sized = '';   // CSS --street-top: the bottom of whatever sits over the top of the street; card: the phone's hero card top, read per size
  function layout(w, h, dpr, wide) {   // in device pixels, sized by the CSS height; the building centred beside the card, the street under it
    const [EW, EH] = view.size, W = w / dpr, H = h / dpr, rects = Object.values(view.windows);
    if (!wide) {   // phones: only the tower, as big as whole device pixels allow between the top bar and the card; the roof may go under the bar
      const floors = Object.entries(view.windows).filter(([k]) => k !== 'R').map(([, r]) => r);
      const top = Math.min(...floors.map((r) => r[1])) - PAD, bottom = Math.max(...floors.map((r) => r[3])) + PAD;
      const foot = card || H * 0.62, s = Math.max(Math.round(dpr), Math.floor(Math.min(w / TOWER, (foot - clear) * dpr / (bottom - top))));
      // The road's foot on the card, or, where that leaves no room, the top window just under the bar.
      return { s, x: Math.round(w / 2 - (EW / 2) * s), y: Math.round(Math.max(clear * dpr - top * s, foot * dpr - EH * s)) };
    }
    const top = Math.min(...rects.map((r) => r[1])) - PAD, bottom = Math.max(...rects.map((r) => r[3])) + PAD;   // the roof's window, the ground floor's
    const fit = rects.length ? (H - clear) / (bottom - top) : Infinity;   // every window between the top bar and the bottom edge
    const s = Math.round(dpr * Math.max(1, Math.floor(Math.min(fit, H / EH, (W - 440) / 200))));
    const cx = (440 + (W - 440) / 2) * dpr;
    // The street at the bottom; on a short screen it sinks until the top window is clear of the top bar.
    return { s, x: Math.round(cx - (EW / 2) * s), y: Math.max(Math.round(h - EH * s), Math.round(clear * dpr) - top * s) };
  }
  return {
    alpha: (p, at) => (at < 0 ? 0 : clamp01(1 - Math.abs(p - at))),
    // Flying in at a floor's window (t: 0 on the street, 1 in the room). Each window is a 1:1 slice of its room
    // (on 1-7 dimmed behind the company's sign, which fades into the room), so at any whole scale the two line up
    // through it: the camera closes in on it in whole-pixel steps, then the window opens out over the room. null
    // without the window: the plain dissolve.
    fly(key, t, w, h, dpr, wide, room) {
      const win = view.windows[key], look = LOOK[key];
      if (!win || !look) return null;
      const base = layout(w, h, dpr, wide), [x0, y0, x1, y1] = win, ww = x1 - x0, wh = y1 - y0;
      const first = t < 0.5, k = easeInOut(first ? t * 2 : t * 2 - 1), e = easeInOut(t);
      const near = Math.max(base.s, room.s), peak = Math.max(near, Math.min(2 * near, Math.floor(Math.min(w * 0.8 / ww, h * 0.5 / wh))));
      const z = Math.round(first ? base.s + (peak - base.s) * k : peak + (room.s - peak) * k);   // whole scales: square pixels
      // The window's middle glides from where the street shows it to where the room will.
      const mx = (a, b) => a + (b - a) * e;
      const fx = mx(base.x + (x0 + ww / 2) * base.s, room.x + (look[0] + ww / 2) * room.s);
      const fy = mx(base.y + (y0 + wh / 2) * base.s, room.y + (look[1] + wh / 2) * room.s);
      const rx = Math.round(fx - (look[0] + ww / 2) * z), ry = Math.round(fy - (look[1] + wh / 2) * z);
      let hole = [rx + look[0] * z, ry + look[1] * z, rx + (look[0] + ww) * z, ry + (look[1] + wh) * z];
      if (!first) {   // the window grows to the screen's edges, on the room's pixel grid
        const grid = (v, o, round) => o + round((v - o) / z) * z;
        const [a, b, c, d] = hole;
        hole = [grid(a - a * k, rx, Math.floor), grid(b - b * k, ry, Math.floor), grid(c + (w - c) * k, rx, Math.ceil), grid(d + (h - d) * k, ry, Math.ceil)];
      }
      return {
        street: { s: z, x: rx + (look[0] - x0) * z, y: ry + (look[1] - y0) * z }, room: { s: z, x: rx, y: ry }, hole,
        dim: 0.85 * easeInOut(Math.min(1, t * 2)), roomA: clamp01((t - 0.3) / 0.2),
      };
    },
    draw(ctx, f, w, h, a, dpr, wide, cam) {   // cam: a flight's scale and place, else the street's own
      if (a <= 0) return;
      if (sized !== `${w},${h}`) { sized = `${w},${h}`; clear = parseFloat(getComputedStyle(ctx.canvas).getPropertyValue('--street-top')) || 0; card = hero ? parseFloat(getComputedStyle(hero).paddingTop) : 0; }
      const [EW, EH] = view.size, { s, x, y } = cam ?? layout(w, h, dpr, wide), src = f * EW, [L, R] = SIDE;
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
      if (cam || at === view.at) return;
      view.at = at;
      for (const [b, [x0, y0, x1, y1]] of buttons) {
        const css = (v) => `${v / dpr}px`;
        // A window under the top bar (the roof, on phones) keeps only what shows below it, or goes.
        const top = Math.max(y + (y0 - PAD) * s, clear * dpr), bottom = y + (y1 + PAD) * s;
        b.hidden = bottom <= top;
        Object.assign(b.style, { left: css(x + (x0 - PAD) * s), top: css(top), width: css((x1 - x0 + 2 * PAD) * s), height: css(bottom - top) });
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
