// Pixel building: one 480x180 pixel-art strip per floor (web3d/pixel/gen_floors.py), stacked into a tower and
// drawn at a whole-number scale so every pixel stays square. The lift rides between floors in whole art pixels.
// Reads its stops from the page (<section data-floor="KEY">) and emits the building:* events guide.js listens to.
import { guide, roomy } from './guide.js';
import '../../assets/js/copy-email.js';
import './pixel.css';

const FW = 480, FH = 180, FRAMES = 12, FPS = 8;
const REST_MS = 2600;   // after each action loop the room holds still, so the text keeps the reader's attention
const ORDER = ['P', 'L', '1', '2', '3', '4', '5', '6', '7', 'R'];   // bottom to top
const TIME = document.documentElement.dataset.time;          // picked once, in the page's head (#151): it never changes while the page is open
const BAKED = { dawn: 'RPL', day: 'RPL', night: 'RP' }[TIME];   // the art with its own picture at this hour: the rooms with an outside view (gen_floors.PHASES); none at dusk
const HOUR = BAKED ? `-${TIME}` : '';                          // the file name's suffix
let SKY = { dawn: '#5d5a86', day: '#2f5c96', night: '#232a4d' }[TIME] ?? '#74228a';   // above the roof, until its strip gives its own top row
const GROUND = ['#33231a', '#1f1610'];                        // under the garage: the earth's top line, then soil
const DOOR = { x0: 51, x1: 96, mid: 74, y0: 72, y1: 153 };      // the painted lift doors; mirrors gen_floors.DOOR
// Where each street window looks into its room, in strip pixels: mirrors gen_exterior.LOOK. The roof's is painted,
// not a slice, so going up there is the crane shot instead (streetView's fly).
const LOOK = { L: [246, 122], 1: [322, 76], 2: [328, 82], 3: [266, 56], 4: [250, 64], 5: [222, 54], 6: [230, 96], 7: [205, 86], P: [166, 78] };
const BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]];   // mirrors gen_floors.BAYER
// Each room's hanging lamps, by strip x: mirrors install_picks.LAMPS (8 further right on the strip), the lift's own lamp first.
// The roof has none: it is outdoors, so it stays as bright as its sky.
const LAMPS = { P: [74, 215, 251, 327, 351, 395], L: [74, 169, 197, 234, 266, 300], 1: [74, 198, 211, 262, 331, 372, 403], 2: [74, 167, 200, 266, 331, 377, 438], 3: [74, 201, 262, 299, 330, 372, 403], 4: [74, 181, 301, 424], 5: [74, 181, 352], 6: [74, 167, 336], 7: [74, 180, 337] };
const DARK = { day: [0.5, 0.52, 0.58], dawn: [0.42, 0.42, 0.52] }[TIME] ?? [0.34, 0.34, 0.44];   // what a room's colours fall to with its lights off; by day its windows still let some in
const SHADES = [16, 10, 5];                                     // a lamp coming on: how many of 16 Bayer cells are still dark, step by step
const POOL = 8;                                                  // a lamp's light spreads in blocks this many art pixels wide
const OVER = 2, SETTLE = 260;                                   // the cab sinks on past its stop, in art pixels, and comes back, in ms
const FOCUS = { 2: 330, 3: 250 };                               // on narrow screens, the art x kept mid-screen (else 300)
const FADE_IN_MS = 300;                                         // a picture that arrives late fades in over its stand-in
const PAUSE_KEY = 'building-paused';                            // per viewer, kept across reloads
const DOORS = 3.3;                                              // the lift doors' speed, in full travels per second
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');   // read live: it can change after load
const held = () => reduceMotion.matches || !roomy.matches;              // no motion to pause: asked for none, or the plain page, where the pause scrolls away
// The phone layout: the same query as every phone rule in pixel.css, so the canvas and the cards always agree (#46).
const narrow = matchMedia('(max-width: 760px), (max-aspect-ratio: 6/5)');
const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
// The old one-page site's anchors, still linked from elsewhere, land on the floor that took their place (#29); the
// closed newsroom's (floor 8) on the lobby, whose newsstand has the writing now.
const LEGACY = { about: 'L', testimonial: 'L', contact: 'R', experience: '7', proof: '7', 'client-and-work-section': 'P', 'floor-8': 'L' };
// Hugo lowercases menu URLs, so the site menu's About arrives as #floor-l.
const hashKey = () => { const h = location.hash.slice(1); return LEGACY[h] ?? (h.match(/^floor-(\w+)$/) || [])[1]?.toUpperCase(); };

// A picture's colour at one pixel, as CSS.
function colourAt(img, x, y) {
  const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  c.canvas.width = c.canvas.height = 1;
  c.drawImage(img, -x, -y);
  return `rgb(${[...c.getImageData(0, 0, 1, 1).data.slice(0, 3)]})`;
}

export function mountPixel({ canvas, stops, base = '/building/', windowsBox, pauseButton }) {
  const ctx = canvas.getContext('2d');
  const keys = stops.map((s) => s.dataset.floor);
  const strips = new Map();         // key -> Image (or null while loading / missing)
  const open = new Map();           // key -> 0..1, lift doors
  const lit = new Map();            // key -> 0..1, its lamps: on only where the lift has arrived, or a flight lands
  let loads = 0, fading = 0;        // bumped by every image or file that arrives: the picture changes (and fades in)
  const loaded = () => { loads++; fading = performance.now() + FADE_IN_MS; wake(); };
  const started = new Set();
  const load = (key) => {
    if (key === 'E' || started.has(key)) return;   // the street is exterior.png, not a strip
    started.add(key);
    const img = new Image();
    img.onload = () => {
      if (key === 'R') SKY = colourAt(img, 300, 0);
      if (LAMPS[key] && !held()) shade(img, SHADES[0]);   // now, not in the first frame of a flight, which has every storey in range at once
      img.since = performance.now(); strips.set(key, img); loaded();
    };
    img.onerror = () => { strips.set(key, null); loaded(); };
    img.src = `${base}pixel/floor-${key}${BAKED?.includes(key) ? HOUR : ''}.png`;
  };
  const loadAll = () => keys.forEach(load);
  // The street is the first screen: the other floors wait until it has arrived (or failed), or the lift moves (#130).
  const street = streetView(base, windowsBox, stops, loaded, loadAll);

  // ---- the ride ----
  // v: the speed carried over from a ride retargeted mid-way (floors per unit of u), so the cab never stops dead.
  // land, settle: it reaches its stop still moving, by that much, and spends the ride's last settle ms sinking past it and back.
  const ride = { from: 0, to: 0, start: 0, dur: 0, fade: false, v: 0, land: 0, settle: 0, sink: 0 };
  const eAt = keys.indexOf('E');                               // the street view's stop
  const fromHash = keys.indexOf(hashKey());
  ride.from = ride.to = Math.max(0, fromHash);
  lit.set(keys[ride.from], 1);   // a page opening on a floor opens with the lights on
  load(keys[ride.from]);   // a floor's own address shows that floor first, so it loads alongside the street
  if (fromHash >= 0 && location.hash !== `#floor-${keys[fromHash]}`) {   // a legacy or lowercased anchor: show the floor's own
    history.replaceState(null, '', `#floor-${keys[fromHash]}`);
    requestAnimationFrame(() => document.documentElement.classList.contains('building--guided') || stops[fromHash].scrollIntoView());
  }
  const rideU = (now) => (ride.dur ? clamp01((now - ride.start) / ride.dur) : 1);
  // A carried speed rides a cubic Hermite (smoothstep plus the speed's term), which lands without overshooting; the
  // land term is its other end's tangent, the speed the settle starts at.
  const pos = (u) => {
    const m = ride.settle ? Math.min(1, u * ride.dur / (ride.dur - ride.settle)) : u;
    return ride.from + (ride.to - ride.from) * (ride.v ? m * m * (3 - 2 * m) : easeInOut(m)) + ride.v * m * (1 - m) ** 2 + ride.land * m * m * (m - 1);
  };
  // How far past its stop the cab has sunk, in art pixels: in level's terms, so the street's far-off level is not involved.
  const sunk = (u) => { const t = ride.settle ? 1 - (1 - u) * ride.dur / ride.settle : 0; return t > 0 ? ride.sink * Math.sin(Math.PI * t) : 0; };
  // Where the camera is, settle included, for a ride to start from.
  // shortcut: past the roof or the garage there is no next storey to measure that against, so a ride asked for in that settle starts from the stop, up to OVER art pixels away; carry the offset separately if that ever shows.
  const cab = (u) => { const past = pos(u) - sunk(u) / FH; return past >= eAt + 1 && past <= keys.length - 1 ? past : pos(u); };
  const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));
  function go(index) {
    loadAll();
    const now = performance.now(), u = rideU(now);
    const to = Math.max(0, Math.min(keys.length - 1, index));
    if (to === ride.to || (ride.fade && u < 1)) return false;   // already on its way there; a dissolve runs to its end
    const here = cab(u), vel = u < 1 ? (here - cab(rideU(now - 16))) / 16 : 0;   // floors per ms
    const fade = eAt >= 0 && (to === eAt || Math.abs(here - eAt) < 1e-3);   // going in or out: through a window, not a ride
    const still = held();
    const dist = Math.abs(to - here), dur = fade ? (keys[to === eAt ? Math.round(here) : to] === 'R' ? 1400 : 1700) : Math.min(1600, 550 + 250 * Math.max(0, dist - 1));
    const closeMs = still ? 0 : ((open.get(keys[Math.round(here)]) ?? 0) / DOORS) * 1000;   // the doors shut, then it moves
    // The eased start moves the camera less than half an art pixel at first: that stretch runs as the doors finish.
    const hidden = vel || fade ? 0 : dur * Math.cbrt(1 / (1440 * Math.max(dist, 1e-3)));
    const settle = fade || still || paused ? 0 : SETTLE;
    Object.assign(ride, {
      from: here, to, start: now + Math.max(0, closeMs - hidden), fade, dur: still ? 1 : dur + settle, v: fade || still ? 0 : vel * dur, settle,
      land: settle ? Math.sign(to - here) * (OVER / FH) * (Math.PI / settle) * dur : 0, sink: OVER * Math.sign(level(keys[to]) - lerpAt(here, level)),
    });
    document.documentElement.classList.toggle('lift-ride', !fade && !still);   // the card waits for the doors (pixel.css)
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

  // The room loops only while it is allowed to move: the pause button (WCAG 2.2.2), reduced motion and the plain page
  // hold it on its rest frame. A frame that would draw the same picture is skipped, and once nothing is moving the loop
  // sleeps: until the next frame of the loop, or for good while held, until a ride, a resize or a load wakes it (#36).
  let paused = false, raf = 0, timer = 0, drawn = '';
  try { paused = localStorage.getItem(PAUSE_KEY) === 'true'; } catch { /* blocked storage: it just is not remembered */ }
  function wake() { clearTimeout(timer); raf ||= requestAnimationFrame(frame); }
  // Held has nothing to pause: the button hides, and shows again if that changes after load (#128).
  const label = () => {
    if (!pauseButton) return;
    pauseButton.hidden = held();
    pauseButton.dataset.paused = paused;
    pauseButton.setAttribute('aria-label', paused ? 'Play the animation' : 'Pause the animation');
    pauseButton.title = pauseButton.getAttribute('aria-label');
    pauseButton.querySelector('[data-building-pause-label]').textContent = paused ? 'Play' : 'Pause';
  };
  label();
  pauseButton?.addEventListener('click', () => {
    paused = !paused;
    label(); wake();
    try { localStorage.setItem(PAUSE_KEY, paused); } catch { /* as above */ }
  });
  addEventListener('resize', wake);
  for (const q of [reduceMotion, roomy]) q.addEventListener('change', () => { label(); wake(); });

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
    const wide = !narrow.matches, still = held();

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
    const camY = Math.round(lerpAt(at, level) + sunk(u));      // whole art pixels: no shimmer
    const near = Math.round(p);
    if (near !== passing) { passing = near; emit('building:floor', { index: near, key: keys[near] }); }
    // Arrived the moment the camera reaches its stop: the doors and the lamps start as it settles.
    const landed = u === 1 || (!ride.fade && u > 0.5 && camY === level(keys[ride.to]));
    if (landed && arrived !== ride.to) { arrived = ride.to; emit('building:arrive', { index: ride.to, key: keys[ride.to] }); }

    const loopMs = (FRAMES * 1000) / FPS;
    const phase = now % (loopMs + REST_MS);
    const f = paused || still || phase >= loopMs ? 0 : Math.floor(phase / (1000 / FPS));
    for (const key of ORDER) {
      const here = arrived === ride.to && keys[ride.to] === key;
      open.set(key, clamp01((open.get(key) ?? 0) + (here ? dt : -dt) * (still ? 99 : DOORS)));
      lit.set(key, ride.fade && keys[inner] === key ? 1 : clamp01((lit.get(key) ?? 0) + (here ? dt : -dt) * (still || paused ? 99 : DOORS)));   // in step with the doors; paused, they just switch
    }
    const inT = ride.fade ? (ride.to === eAt ? 1 - u : u) : 0;   // going in or out: 0 on the street, 1 in the room
    const fly = ride.fade && inT > 0 && inT < 1 ? street.fly(keys[inner], inT, w, h, dpr, wide, { s, x: x0, y: ry }) : null;
    // A flight's every frame differs and sig must see that; the plain dissolve (no street picture to fly by) steps, like the cards.
    const eased = 1 - easeInOut(inT), streetA = ride.fade ? (fly ? eased : Math.round(eased * 6) / 6) : street.alpha(p, eAt);
    const sig = [f, camY, streetA, loads, now < fading && now, ...open.values(), ...lit.values()].join();
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
    if (fly) { street.flight(ctx, f, w, h, dpr, wide, fly, tower); return; }
    if (streetA < 1) tower(s, x0, ry);
    street.draw(ctx, f, w, h, streetA, dpr, wide);

    // Every storey, the one in view with its top at ry; s and x0 are the frame's own, or the flight's.
    function tower(s, x0, ry) { for (const key of ORDER) {
      const y = ry - (level(key) - camY) * s;
      const img = strips.get(key);
      if (key === 'R' && y > 0) {                                                         // the sky goes on above the roof
        ctx.fillStyle = SKY; ctx.fillRect(0, 0, w, y + 1);
        // At night its stars too: the top rows of the strip's right run, plain sky and stars, each course shifted so no column of them lines up.
        const t = img ? (img.width - FRAMES * FW) / 2 : 0;
        if (TIME === 'night' && t) for (let r = 1, gy = y - 16 * s; gy + 16 * s > 0; r++, gy -= 16 * s) for (let gx = -(r * 97 % t) * s; gx < w; gx += t * s) ctx.drawImage(img, FRAMES * FW + t, 0, t, 16, gx, gy, t * s, 16 * s);
      }
      if (key === 'P' && y + FH * s < h) {                                                // and the ground under the garage
        ctx.fillStyle = GROUND[1]; ctx.fillRect(0, y + FH * s, w, h);
        ctx.fillStyle = GROUND[0]; ctx.fillRect(0, y + FH * s, w, s);
      }
      if (y > h || y + FH * s < 0) continue;
      ctx.fillStyle = '#1f2532';   // a plain storey until its picture arrives (or if it never does)
      if (!img || now - img.since < FADE_IN_MS) ctx.fillRect(0, y, w, FH * s);
      if (!img) continue;
      ctx.globalAlpha = clamp01((now - img.since) / FADE_IN_MS);
      // The room runs on to the screen's edges over the facade posts: after its frames the strip holds a run of t
      // columns that carries on left of art x 8 and another right of 472 (gen_floors.EDGES), tiled outwards.
      // shortcut: past t art px (a screen over ~4.5:1) a run repeats with a step; give it longer runs if that matters.
      const t = (img.width - FRAMES * FW) / 2;
      const paint = (src, sx, runs) => {
        ctx.drawImage(src, sx, 0, FW, FH, x0, y, FW * s, FH * s);
        if (wide && t > 0) {
          for (let gx = x0 + (8 - t) * s; gx + t * s > 0; gx -= t * s) ctx.drawImage(src, runs, 0, t, FH, gx, y, t * s, FH * s);
          for (let gx = x0 + 472 * s; gx < w; gx += t * s) ctx.drawImage(src, runs + t, 0, t, FH, gx, y, t * s, FH * s);
        } else {   // a strip cached from before the runs: its outermost columns, stretched
          if (x0 > 0) ctx.drawImage(src, sx, 0, 1, FH, 0, y, x0, FH * s);
          if (x0 + FW * s < w) ctx.drawImage(src, sx + FW - 1, 0, 1, FH, x0 + FW * s, y, w - x0 - FW * s, FH * s);
        }
      };
      paint(img, f * FW, FRAMES * FW);
      // Lights off in transit; on arrival each lamp's pool spreads from its shade, the lift's first, in blocks of whole-pixel
      // dither, never an alpha veil. The doors go in front (drawn after), on their lit cab.
      const lamps = LAMPS[key], on = lit.get(key);
      if (lamps && on < 1 && !still) {
        if (!on) paint(shade(img, SHADES[0]), 0, FW);
        else for (let lv = 0; lv < SHADES.length; lv++) {
          ctx.save();
          ctx.beginPath();
          for (let cx = 0; cx < FW; cx += POOL) for (let cy = 0; cy < FH; cy += POOL) {
            const glow = Math.max(...lamps.map((lx, i) => on - (i / lamps.length) * 0.4 - Math.min(1, Math.hypot(cx - lx, cy - 30) / 170) * 0.3));
            if (Math.floor(glow / 0.3 * SHADES.length) !== lv && (lv || glow > 0)) continue;
            const a = cx ? x0 + cx * s : 0, b = cx + POOL < FW ? x0 + (cx + POOL) * s : w;
            ctx.rect(a, y + cy * s, b - a, POOL * s);
          }
          ctx.clip();
          paint(shade(img, SHADES[lv]), 0, FW);
          ctx.restore();
        }
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

// A strip's rest frame and edge runs with its lights off, each colour fallen to the nearest of the room's own, so it
// stays on the palette; with lv of 16 Bayer cells of it left, to dither over the lit room. Laid out as the strip, with
// one frame. Made when first seen, and kept on the image.
function shade(img, lv) {
  img.shades ??= {};
  if (img.shades[lv]) return img.shades[lv];
  const runs = img.width - FRAMES * FW;
  const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true }), W = FW + runs;
  c.canvas.width = W; c.canvas.height = FH;
  if (lv < 16) {   // composited, not read back: this runs as a lamp comes on, and must not cost that frame
    const tile = document.createElement('canvas').getContext('2d');
    tile.canvas.width = tile.canvas.height = 4;
    BAYER.forEach((row, y) => row.forEach((b, x) => { if (b < lv) tile.fillRect(x, y, 1, 1); }));
    c.drawImage(shade(img, 16), 0, 0);
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = c.createPattern(tile.canvas, 'repeat');
    c.fillRect(0, 0, W, FH);
    return (img.shades[lv] = c.canvas);
  }
  c.drawImage(img, 0, 0, FW, FH, 0, 0, FW, FH);
  if (runs) c.drawImage(img, FRAMES * FW, 0, runs, FH, FW, 0, runs, FH);
  const d = c.getImageData(0, 0, W, FH), px = new Uint32Array(d.data.buffer);
  const rgb = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255], own = [...new Set(px)].map((v) => [v, rgb(v)]);
  const fallen = new Map(own.map(([v, col]) => {
    const to = col.map((n, i) => n * DARK[i]);
    let best = v, far = Infinity;
    for (const [w, o] of own) { const e = (o[0] - to[0]) ** 2 + (o[1] - to[1]) ** 2 + (o[2] - to[2]) ** 2; if (e < far) { far = e; best = w; } }
    return [v, best];
  }));
  for (let i = 0; i < px.length; i++) px[i] = fallen.get(px[i]);
  c.putImageData(d, 0, 0);
  return (img.shades[lv] = c.canvas);
}

// The street view: the whole building at this hour (web3d/pixel/gen_exterior.py), its windows live crops of the rooms,
// 1-7 dimmed behind each floor's company sign.
// Its windows are buttons laid over the canvas; the street left and right of the picture repeats its neighbours.
function streetView(base, box, stops, loaded, then) {
  const view = { img: null, since: 0, size: [480, 336], windows: {}, top: SKY, bottom: '#2a2226', at: null };
  const img = new Image();
  img.onload = () => {
    then();
    Object.assign(view, { img, since: performance.now(), top: colourAt(img, 0, 0), bottom: colourAt(img, 0, view.size[1] - 1) });
    loaded();
  };
  img.onerror = then;
  img.src = `${base}pixel/exterior${HOUR}.png`;
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
  const CRANE = [200, 116, 81];   // the crane over the roof, which phones leave out for the top bar: first column, width, and the cornice's row under it
  // The planes a flight parts the picture into, cut from its rest frame by what gen_exterior knows of it: mirrors its
  // NEIGHBOURS (x0, x1, roof) and GROUND. The tower's cornice overhangs its brick (x 170-310) by 3 px a side.
  const NEIGHBOURS = [[0, 30, 200], [30, 74, 170], [74, 118, 214], [118, 166, 176], [314, 348, 196], [348, 398, 160], [398, 440, 206], [440, 480, 172]];
  const BRICK = [170, 310], SHAFT = [167, 313], ROAD = 310, FLY_PAST = 0.85;   // FLY_PAST: how far into the flight the window's frame has left the screen
  const CRANE_PEAK = 0.4;                  // how far into the crane shot the brick fills the screen
  const CRANE_OUT = 1.15;                  // and where its climb would end: past 1, since its last stretch is too slow to see, with the cornice gone
  const JIB = [[200, 9, 316, 22], [238, 9, 244, 38], [283, 9, 288, 81]];   // the crane against the sky: jib, hook, mast (the clouds keep clear of them)
  let plated = null;
  function plate() {   // the rest frame without its sky, so the planes slide over the far street
    if (plated) return plated;
    const [EW, EH] = view.size, c = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    c.canvas.width = EW; c.canvas.height = EH;
    c.drawImage(view.img, 0, 0);
    const d = c.getImageData(0, 0, EW, EH), px = d.data;
    // The sky repeats every 4 columns, and the picture's first columns are clear down to the lowest roof (rows < 200).
    const sky = (x, y) => y < 200 && [0, 1, 2].every((i) => px[(y * EW + x) * 4 + i] === px[(y * EW + x % 4) * 4 + i]);
    for (let x = 0; x < EW; x++) {
      const roof = Math.min(...NEIGHBOURS.filter(([a, b]) => x >= a - 2 && x < b + 2).map((n) => n[2])) - 1;   // their cornices overhang too
      const tower = x >= SHAFT[0] && x < SHAFT[1], brick = x >= BRICK[0] && x < BRICK[1];
      for (let y = 0; y < ROAD; y++) {
        const gone = !tower ? y < roof
          : y < CRANE[2] ? sky(x, y) || !JIB.some(([a, b, c, e]) => x >= a && x < c && y >= b && y < e)
            : !brick && (y >= 200 || sky(x, y));
        if (gone) px[(y * EW + x) * 4 + 3] = 0;
      }
    }
    c.putImageData(d, 0, 0);
    return (plated = c.canvas);
  }
  // The sign in a storey's window, with lv of 16 Bayer steps of it left: it dissolves in dither, on the palette.
  const veils = new Map();
  function veil(key, lv) {
    const id = `${key}${lv}`;
    if (veils.has(id)) return veils.get(id);
    const [x0, y0, x1, y1] = view.windows[key], ww = x1 - x0, wh = y1 - y0;
    const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    c.canvas.width = ww; c.canvas.height = wh;
    c.drawImage(view.img, -x0, -y0);
    const d = c.getImageData(0, 0, ww, wh);
    for (let y = 0; y < wh; y++) for (let x = 0; x < ww; x++) if (BAYER[y % 4][x % 4] >= lv) d.data[(y * ww + x) * 4 + 3] = 0;
    c.putImageData(d, 0, 0);
    veils.set(id, c.canvas);
    return c.canvas;
  }
  const hero = stops.find((s) => s.dataset.floor === 'E'), heroCard = hero?.querySelector('.floor-card');
  let clear = 0, card = 0, sized = '';   // CSS --street-top: the bottom of whatever sits over the top of the street; card: the phone's hero card top, read per size
  if (heroCard) new ResizeObserver(() => { sized = ''; loaded(); }).observe(heroCard);   // a late font moves the card's top, so the street's foot
  function measure(ctx, w, h) { if (sized !== `${w},${h}`) { sized = `${w},${h}`; clear = parseFloat(getComputedStyle(ctx.canvas).getPropertyValue('--street-top')) || 0; card = heroCard ? hero.clientHeight - parseFloat(getComputedStyle(hero).paddingBottom) - heroCard.offsetHeight : 0; } }
  function layout(w, h, dpr, wide) {   // in device pixels, sized by the CSS height; the building centred beside the card, the street under it
    const [EW, EH] = view.size, W = w / dpr, H = h / dpr, rects = Object.values(view.windows);
    if (!wide) {   // phones: only the tower, as big as whole device pixels allow between the top bar and the card, the cornice under the bar
      const floors = Object.entries(view.windows).filter(([k]) => k !== 'R').map(([, r]) => r);
      const top = Math.min(...floors.map((r) => r[1])) - PAD, bottom = Math.max(...floors.map((r) => r[3])) + PAD;
      const foot = card || H * 0.62, s = Math.max(Math.round(dpr), Math.floor(Math.min(w / TOWER, (foot - clear) * dpr / (bottom - top))));
      // The road's foot on the card, or, where that leaves no room, the cornice just under the bar, 2 art pixels of sky between them; the road gives way.
      return { s, x: Math.round(w / 2 - (EW / 2) * s), y: Math.round(Math.max(clear * dpr - (CRANE[2] - 2) * s, foot * dpr - EH * s)) };
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
    // Flying in at a floor's window (t: 0 on the street, 1 in the room), the camera only ever going forward. Three
    // planes part: the far street barely moves, the neighbours slide by, and the tower rushes past until the window's
    // frame has gone off the screen's edges. Behind the glass the room, further away, is still settling into place.
    // Every scale is whole, so the pixels stay square. null without the window: the plain dissolve.
    fly(key, t, w, h, dpr, wide, room) {
      if (key === 'R' && view.img) return this.crane(t, w, h, dpr, wide, room);
      const win = view.windows[key], look = LOOK[key];
      if (!win || !look || !view.img) return null;
      const base = layout(w, h, dpr, wide), [x0, y0, x1, y1] = win, ww = x1 - x0, wh = y1 - y0;
      const mx = x0 + ww / 2, my = y0 + wh / 2, lx = look[0] + ww / 2, ly = look[1] + wh / 2;
      const from = [base.x + mx * base.s, base.y + my * base.s], to = [room.x + lx * room.s, room.y + ly * room.s];
      const e = easeInOut(t), fx = from[0] + (to[0] - from[0]) * e, fy = from[1] + (to[1] - from[1]) * e;
      // The scale at which the window covers the screen, wherever on its way its middle is by then.
      const cover = ([ax, ay]) => Math.max(Math.max(ax, w - ax) * 2 / ww, Math.max(ay, h - ay) * 2 / wh);
      const end = Math.ceil(Math.max(cover(from), cover(to)));
      const push = clamp01(t / FLY_PAST);
      const z = Math.round(base.s * (end / base.s) ** (push * push));   // a steady rate of growth: a zoom at a constant ratio reads as constant speed
      const at = (s) => ({ s, x: Math.round(fx - mx * s), y: Math.round(fy - my * s) });
      const rs = Math.round(base.s + (room.s - base.s) * e), front = at(z);
      return {
        key, front, near: at(Math.round(base.s * (z / base.s) ** 0.3)),
        far: { s: base.s, x: base.x + Math.round((fx - from[0]) * 0.12), y: base.y + Math.round((fy - from[1]) * 0.12) },
        room: { s: rs, x: Math.round(fx - lx * rs), y: Math.round(fy - ly * rs) },
        win: [front.x + x0 * z, front.y + y0 * z, ww * z, wh * z],
        dim: (TIME === 'day' ? 0.3 : 0.6) * easeInOut(Math.min(1, t * 2)),   // at noon a full dim reads as the lights going out
        // How much of the sign is still up, of 16. The lobby and the garage have none: their windows are plain slices
        // of the room, which would double it as the two scales part.
        veil: /\d/.test(key) ? Math.round(clamp01(1 - (t - 0.08) / 0.3) * 16) : 0,
      };
    },
    // Rising to the roof (t: 0 on the street, 1 on the deck): the camera pushes in at street level and then climbs. The
    // far street barely moves, the neighbours slide down, and the tower grows until its brick fills the screen, the only
    // moment the two pictures can change places unseen; then its cornice falls through the frame, off the roof behind it.
    crane(t, w, h, dpr, wide, room) {
      const base = layout(w, h, dpr, wide), mid = (BRICK[0] + BRICK[1]) / 2, ground = base.y + ROAD * base.s, tall = ROAD - CRANE[2];
      const from = base.x + mid * base.s, off = h * 1.15 - ground;   // off: where the cornice is headed, past the bottom edge, so it leaves still moving
      const e = easeInOut(CRANE_PEAK / CRANE_OUT);                  // how much of the climb is done at the peak, with the cornice still above the screen
      const Z = Math.ceil(Math.max(w / (BRICK[1] - BRICK[0] - 1), (ground + e * off) / (tall * (1 - e))));
      const push = easeInOut(clamp01(t / CRANE_PEAK)), z = Math.round(base.s * (Z / base.s) ** push);
      const climb = easeInOut(clamp01(t / CRANE_OUT)), risen = climb * (tall + off / Z), fx = from + (w / 2 - from) * push ** 3;   // no pan till the tower has outgrown its far copy, which would show past its edge
      const at = (s) => ({ s, x: Math.round(fx - mid * s), y: Math.round(ground + (risen - ROAD) * s) });
      const front = at(z);
      return {
        key: 'R', front, near: at(Math.round(base.s * (z / base.s) ** 0.3)), over: t >= CRANE_PEAK,
        far: { s: base.s, x: base.x + Math.round((fx - from) * 0.12), y: base.y + Math.round(climb * h * 0.04) },
        room: { ...room, y: room.y - Math.round((1 - climb) * 12) * room.s },   // the deck settles under the camera, in whole art pixels
        dim: 0, veil: Math.round(clamp01(1 - (push - 0.1) / 0.5) * 16),   // outdoors: nothing dims
      };
    },
    flight(ctx, f, w, h, dpr, wide, fly, room) {   // room: the frame's tower(s, x, y)
      const [EW, EH] = view.size, [L, R] = SIDE, plates = plate();
      const blit = (src, sx, sy, sw, sh, c) => {   // only what is on screen: late in the flight a picture is far bigger than the canvas
        const a = Math.max(sx, Math.floor(-c.x / c.s)), b = Math.max(sy, Math.floor(-c.y / c.s));
        const r = Math.min(sx + sw, Math.ceil((w - c.x) / c.s)), d = Math.min(sy + sh, Math.ceil((h - c.y) / c.s));
        if (r > a && d > b) ctx.drawImage(src, a, b, r - a, d - b, c.x + a * c.s, c.y + b * c.s, (r - a) * c.s, (d - b) * c.s);
      };
      const repeats = (c, y0) => {   // the street's neighbours, repeated as in draw()
        for (let gx = c.x - L * c.s; gx > -L * c.s; gx -= L * c.s) blit(plates, 0, y0, L, EH - y0, { ...c, x: gx });
        for (let gx = c.x + EW * c.s; gx < w; gx += R * c.s) blit(plates, EW - R, y0, R, EH - y0, { ...c, x: gx - (EW - R) * c.s });
      };
      const shade = (a) => { ctx.globalAlpha = a; ctx.fillStyle = '#151923'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; };
      const { near, front } = fly;
      if (fly.over) { measure(ctx, w, h); room(fly.room.s, fly.room.x, fly.room.y); }   // the street has gone behind the brick; measured all the same, for a page opened on the roof, whose first way back to the street starts here
      else {
        this.draw(ctx, f, w, h, 1, dpr, wide && fly.key !== 'R', fly.far);   // climbing, the far picture goes without its crane, as on phones: a copy would part from the one on the tower
        shade(fly.dim);
        blit(plates, 0, 0, SHAFT[0], EH, near); blit(plates, SHAFT[1], 0, EW - SHAFT[1], EH, near); repeats(near, 0);
        shade(fly.dim * 0.5);
        blit(plates, 0, ROAD, EW, EH - ROAD, front); repeats(front, ROAD);   // the road is nearest of all, and runs under the camera
      }
      const top = wide && !fly.over ? 0 : CRANE[2];   // past the peak the street's crane has left the top of the frame: only the roof's comes back
      blit(plates, SHAFT[0], top, SHAFT[1] - SHAFT[0], ROAD - top, front);
      const glass = (key, [x, y, gw, gh], r) => {
        ctx.save();
        ctx.beginPath(); ctx.rect(x, y, gw, gh); ctx.clip();
        room(r.s, r.x, r.y);
        if (fly.veil) blit(veil(key, fly.veil), 0, 0, gw / front.s, gh / front.s, { s: front.s, x, y });
        ctx.restore();
      };
      if (fly.key !== 'R') glass(fly.key, fly.win, fly.room);
      // The storeys the crane climbs past, once their signs start to go: each room dark behind its glass, further off than the facade.
      else if (fly.veil < 16) for (const [key, [x0, y0, x1, y1]] of Object.entries(view.windows)) {
        const gw = (x1 - x0) * front.s, gh = (y1 - y0) * front.s, x = front.x + x0 * front.s, y = front.y + y0 * front.s, rs = fly.room.s;
        if (!/\d/.test(key) || y > h || y + gh < 0) continue;   // the lobby's and the garage's are plain slices of the room, and have no sign to lose
        const rx = Math.round(x + gw / 2 - (LOOK[key][0] + (x1 - x0) / 2) * rs), ry = Math.round(y + gh / 2 - (LOOK[key][1] + (y1 - y0) / 2) * rs);
        // tower() places the storeys from the roof's camera; phones have no edge runs, so the strip stays across the screen, as at rest.
        glass(key, [x, y, gw, gh], { s: rs, x: wide ? rx : Math.min(0, Math.max(w - FW * rs, rx)), y: ry - (ORDER.length - 1 - ORDER.indexOf(key)) * FH * rs });
      }
    },
    draw(ctx, f, w, h, a, dpr, wide, cam) {   // cam: a flight's scale and place, else the street's own
      if (a <= 0) return;
      measure(ctx, w, h);
      const [EW, EH] = view.size, { s, x, y } = cam ?? layout(w, h, dpr, wide), src = f * EW, [L, R] = SIDE;
      ctx.globalAlpha = a;   // the sky and the road's flat colours, all there is until the picture arrives
      ctx.fillStyle = view.top; ctx.fillRect(0, 0, w, y + EH * s - s);
      ctx.fillStyle = view.bottom; ctx.fillRect(0, y + EH * s - s, w, h);
      if (view.img) {
        ctx.globalAlpha = a * clamp01((performance.now() - view.since) / FADE_IN_MS);
        const [cx, cw, roof] = CRANE;
        if (!wide) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, EW * s, EH * s); ctx.rect(x + cx * s, y, cw * s, roof * s); ctx.clip('evenodd'); }
        ctx.drawImage(view.img, src, 0, EW, EH, x, y, EW * s, EH * s);
        // The sky repeats every 4 columns: the crane's patch comes from the clear sky at the left of the picture.
        if (!wide) { ctx.restore(); ctx.drawImage(view.img, src, 0, cw, roof, x + cx * s, y, cw * s, roof * s); }
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
        b.hidden = bottom - top < 24 * dpr;   // too thin a sliver to tap
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
