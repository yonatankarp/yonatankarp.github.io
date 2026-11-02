// Pixel building: one 480x180 pixel-art strip per floor (web3d/pixel/gen_floors.py), stacked into a tower and
// drawn at a whole-number scale so every pixel stays square. The lift rides between floors in whole art pixels.
// Reads its stops from the page (<section data-floor="KEY">) and emits the building:* events guide.js listens to.
// The art's numbers come from art.js; the street view is street.js.
import { guide, roomy } from './guide.js';
import { FW, FH, FRAMES, ORDER, DOOR, LAMPS, TIME, BAKED, HOUR, SKY_AT_LOAD, SHADES, narrow, easeInOut, clamp01, colourAt, shade, darken } from './art.js';
import { streetView } from './street.js';
import '../../assets/js/copy-email.js';
import '../../assets/js/site-menu.js';
import './pixel.css';

const FPS = 8;
const REST_MS = 2600;   // after each action loop the room holds still, so the text keeps the reader's attention
let SKY = SKY_AT_LOAD;                                         // above the roof, until its strip gives its own top row
const GROUND = ['#33231a', '#1f1610'];                        // under the garage: the earth's top line, then soil
const POOL = 8;                                                  // a lamp's light spreads in blocks this many art pixels wide
const OVER = 2, SETTLE = 260;                                   // the cab sinks on past its stop, in art pixels, and comes back, in ms
const FOCUS = { 2: 330, 3: 250 };                               // on narrow screens, the art x kept mid-screen (else 300)
const FADE_IN_MS = 300;                                         // a picture that arrives late fades in over its stand-in
const PAUSE_KEY = 'building-paused';                            // per viewer, kept across reloads
const SHOT_KEY = 'building-shot', SHOT_MS = 2000;               // the opening shot: once a browser session, and how long
const ARRIVE_FROM = 0.25, ARRIVE_MS = 1000;                     // on every arrival from another page: the same shot, picked up where the crane is about to enter (flat sky before that would only be a wait), and faster
const LAMPS_AFTER = 180;                                        // arriving on a floor: the old page is still over the room until about now
const SHOT_BY = 1500;                                           // ms after the card's first paint: art later than this just appears, under someone already reading
const DOORS = 3.3;
const ROOF_FROM = 117, ROOF_DECK = 155;                         // the roof strip's open air: right of this art x, above this row                                              // the lift doors' speed, in full travels per second
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');   // read live: it can change after load
const held = () => reduceMotion.matches || !roomy.matches;              // no motion to pause: asked for none, or the plain page, where the pause scrolls away
// The old one-page site's anchors, still linked from elsewhere, land on the floor that took their place (#29); the
// closed newsroom's (floor 8) on the lobby, whose newsstand has the writing now.
// A floor that exists again (a new floor 8) wins over its old anchor.
const LEGACY = { about: 'L', testimonial: 'L', contact: 'R', experience: '7', proof: '7', 'client-and-work-section': 'P', 'floor-8': 'L' };
// Hugo lowercases menu URLs, so the site menu's About arrives as #floor-l.
const hashKey = () => {
  const h = location.hash.slice(1), own = (h.match(/^floor-(\w+)$/) || [])[1]?.toUpperCase();
  return ORDER.includes(own) ? own : LEGACY[h] ?? own;
};

export function mountPixel({ canvas, stops, base = '/building/', windowsBox, pauseButton }) {
  const ctx = canvas.getContext('2d');
  const keys = stops.map((s) => s.dataset.floor);
  const strips = new Map();         // key -> ImageBitmap or Image (or null while loading / missing)
  const open = new Map();           // key -> 0..1, lift doors
  const lit = new Map();            // key -> 0..1, its lamps: on only where the lift has arrived, or a flight lands
  let loads = 0, fading = 0;        // bumped by every image or file that arrives: the picture changes (and fades in)
  const loaded = () => { loads++; fading = performance.now() + FADE_IN_MS; wake(); };
  const started = new Set();
  const load = (key) => {
    if (key === 'E' || !keys.includes(key) || started.has(key)) return;   // the street is exterior.webp, not a strip
    started.add(key);
    const url = `${base}pixel/floor-${key}${BAKED?.includes(key) ? HOUR : ''}.webp`;
    // Decoded off the main thread, as a bitmap: an <img> is decoded by the first drawImage, the whole strip there and then (#184).
    const art = 'createImageBitmap' in window
      ? fetch(url).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob(); }).then((b) => createImageBitmap(b))
      : new Promise((ok, fail) => Object.assign(new Image(), { onload() { ok(this); }, onerror: fail, src: url }));
    art.then((img) => {
      if (key === 'R') SKY = colourAt(img, 300, 0);
      if (LAMPS[key]) { img.dark = () => { if (img.waited) img.since = performance.now(); loaded(); }; if (!held()) darkenSoon(img, urgent.has(key)); }   // before the first frame of a flight, which has every storey in range at once
      img.since = performance.now(); strips.set(key, img); loaded();
    }, () => { strips.set(key, null); loaded(); });
  };
  // Until the first ride only what the next move can show loads (#184): from the street, the lobby (the first step), the
  // garage (its door) and the roof (the hero's button); from a floor, the storeys above and below, which show at the
  // screen's edges, and the next stop of the ride (the roof's is the garage), and around a floor theirs too, for the
  // edges after one step. The rest waits for the lift to move.
  const nearby = (key) => (key === 'E' ? ['L', 'P', 'R'] : [ORDER[ORDER.indexOf(key) - 1], ORDER[ORDER.indexOf(key) + 1], key === 'R' && 'P']);
  const around = (key) => [...new Set([key, ...nearby(key), ...nearby(key).filter(Boolean).flatMap(nearby)])];
  // A ride shows its stop and that stop's neighbours, which are darkened first, and every storey it passes on the way;
  // going in or out through a window passes none.
  let urgent = new Set();
  const need = (from, to) => {
    urgent = new Set([keys[to], ...nearby(keys[to])]);
    const [a, b] = [level(keys[Math.round(from)]), level(keys[to])].sort((x, y) => x - y);
    const fade = keys[Math.round(from)] === 'E' || keys[to] === 'E';
    [...urgent, ...(fade ? [] : ORDER.filter((k) => level(k) >= a && level(k) <= b)), ...around(keys[to])].forEach(load);
    if (!held()) urgent.forEach((k) => strips.get(k) && LAMPS[k] && darkenSoon(strips.get(k), true));
  };
  let riding = false;   // once the lift has moved, the other floors follow in idle time
  const loadRest = () => { if (!riding) { riding = true; idle(() => keys.forEach(load), 2000); } };
  // The street is the first screen: the other floors wait until it has arrived (or failed), or the lift moves (#130).
  const street = streetView(SKY, base, windowsBox, stops, loaded, () => (keys[ride.to] === 'E' ? nearby : around)(keys[ride.to]).forEach(load), (key, dark) => !!strips.get(key) && (!dark || !!strips.get(key).shades?.[16]));
  // A floor about to be asked for, by a pointer over its control or the focus on it, starts loading what its ride will show.
  for (const type of ['pointerover', 'focusin']) document.addEventListener(type, (e) => { const i = keys.indexOf(e.target.closest?.('[data-goto]')?.dataset.goto); if (i >= 0) need(cab(rideU(performance.now())), i); }, { passive: true });

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
  // A cubic Hermite (smoothstep plus any carried speed's term), which lands without overshooting and, without a cubic ease's
  // peak of 3x the mean, without strobing: past about 50 CSS px a frame the eye sees separate pictures, not motion. The
  // land term is its other end's tangent, the speed the settle starts at.
  const pos = (u) => {
    const m = ride.settle ? Math.min(1, u * ride.dur / (ride.dur - ride.settle)) : u;
    return ride.from + (ride.to - ride.from) * m * m * (3 - 2 * m) + ride.v * m * (1 - m) ** 2 + ride.land * m * m * (m - 1);
  };
  // How far past its stop the cab has sunk, in art pixels: in level's terms, so the street's far-off level is not involved.
  const sunk = (u) => { const t = ride.settle ? 1 - (1 - u) * ride.dur / ride.settle : 0; return t > 0 ? ride.sink * Math.sin(Math.PI * t) : 0; };
  // Where the camera is, settle included, for a ride to start from.
  // shortcut: past the roof or the garage there is no next storey to measure that against, so a ride asked for in that settle starts from the stop, up to OVER art pixels away; carry the offset separately if that ever shows.
  const cab = (u) => { const past = pos(u) - sunk(u) / FH; return past >= eAt + 1 && past <= keys.length - 1 ? past : pos(u); };
  const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));
  function go(index) {
    shot = 0;
    const now = performance.now(), u = rideU(now);
    const to = Math.max(0, Math.min(keys.length - 1, index));
    need(cab(u), to);
    loadRest();
    if (to === ride.to || (ride.fade && u < 1)) return false;   // already on its way there; a dissolve runs to its end
    const here = cab(u), vel = u < 1 ? (here - cab(rideU(now - 16))) / 16 : 0;   // floors per ms
    const fade = eAt >= 0 && (to === eAt || Math.abs(here - eAt) < 1e-3);   // going in or out: through a window, not a ride
    const still = held();
    const dist = Math.abs(to - here), dur = fade ? (keys[to === eAt ? Math.round(here) : to] === 'R' ? 1400 : 1700) : Math.min(1600, 650 + 230 * Math.max(0, dist - 1));
    const closeMs = still ? 0 : ((open.get(keys[Math.round(here)]) ?? 0) / DOORS) * 1000;   // the doors shut, then it moves
    // The eased start moves the camera less than half an art pixel at first: that stretch runs as the doors finish.
    const hidden = vel || fade ? 0 : dur * Math.sqrt(1 / (1080 * Math.max(dist, 1e-3)));
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
  // The opening shot: -1 waiting for the art, then when it began, 0 for none. Spent at the first load in any case, and
  // storage that cannot remember gets none, rather than one at every reload. arrive(), below, is the other way in.
  let shot = 0, epoch = 0, shotFrom = 0, shotMs = SHOT_MS;
  try {
    if (!sessionStorage.getItem(SHOT_KEY) && keys[ride.from] === 'E' && !paused && !held()) shot = -1;
    sessionStorage.setItem(SHOT_KEY, '1');
  } catch { shot = 0; }
  // Any input cuts to the rest picture, in time for that same input to land on it.
  const cut = () => { if (shot) epoch = performance.now() - (FRAMES * 1000) / FPS; shot = 0; wake(); };
  const cuttable = () => { for (const type of ['wheel', 'keydown', 'pointerdown', 'click']) addEventListener(type, cut, { capture: true, passive: true, once: true }); };
  if (shot) cuttable();
  const roll = () => { street.prime(); shot = performance.now() + 100; };   // its clock starts after the planes' first cost and first draw, held on flat sky: the motion is fastest at once
  // Arrived from another page under its view transition, which reduced motion never has (layouts/index.html tells us; a
  // page restored by Back gets it too). The street: the shot, whatever the session has seen. A floor: the doors shut and
  // the lamps off, until the old page has cleared the room and its picture is here.
  let waiting = '', waitTo = 0;
  const arrive = () => {
    document.documentElement.classList.remove('px-arrive');
    if (held() || paused || rideU(performance.now()) < 1) return;
    const key = keys[ride.to];
    if (key !== 'E') {
      open.set(key, 0); lit.set(key, 0);
      waiting = key; waitTo = performance.now() + LAMPS_AFTER;
      setTimeout(wake, LAMPS_AFTER);
    } else {
      shotFrom = ARRIVE_FROM; shotMs = ARRIVE_MS; cuttable();
      if (street.ready()) roll(); else shot = -1;
    }
    wake();
  };
  document.addEventListener('building:reveal', arrive);
  if (document.documentElement.classList.contains('px-arrive')) arrive();   // revealed before this module ran
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
    const wide = !narrow.matches, still = held(), loopMs = (FRAMES * 1000) / FPS;
    if (still || (shot < 0 && now - (performance.getEntriesByName('first-contentful-paint')[0]?.startTime ?? now) > SHOT_BY)) shot = 0;
    if (shot < 0 && street.ready()) roll();
    const take = shot > 0 ? clamp01(shotFrom + (now - shot) / shotMs) : 0;
    if (take === 1) { shot = 0; epoch = now - loopMs; }   // the room's loop starts on its rest, the shot's last picture
    document.documentElement.classList.toggle('in-shot', !!shot);   // the garage's sign waits for the street to land (pixel.css)

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
    const camY = Math.round((lerpAt(at, level) + sunk(u)) * s) / s;   // whole device pixels: art pixels stay one size, and a slow move is not a series of art-pixel jumps
    const near = Math.round(p);
    if (near !== passing) { passing = near; emit('building:floor', { index: near, key: keys[near] }); }
    // Arrived the moment the camera reaches its stop: the doors and the lamps start as it settles.
    const landed = u === 1 || (!ride.fade && u > 0.5 && (camY - level(keys[ride.to])) * ride.sink >= 0);
    if (landed && arrived !== ride.to) { arrived = ride.to; emit('building:arrive', { index: ride.to, key: keys[ride.to] }); }

    const phase = (now - epoch) % (loopMs + REST_MS);
    const f = paused || still || phase >= loopMs ? 0 : Math.floor(phase / (1000 / FPS));
    for (const key of ORDER) {
      if (key === waiting && (now < waitTo || !strips.has(key))) continue;
      const here = arrived === ride.to && keys[ride.to] === key;
      open.set(key, clamp01((open.get(key) ?? 0) + (here ? dt : -dt) * (still ? 99 : DOORS)));
      lit.set(key, ride.fade && keys[inner] === key ? 1 : clamp01((lit.get(key) ?? 0) + (here ? dt : -dt) * (still || paused ? 99 : DOORS)));   // in step with the doors; paused, they just switch
    }
    const inT = ride.fade ? (ride.to === eAt ? 1 - u : u) : 0;   // going in or out: 0 on the street, 1 in the room
    const fly = ride.fade && inT > 0 && inT < 1 ? street.fly(keys[inner], inT, w, h, dpr, wide, { s, x: x0, y: ry }) : null;
    // A flight's every frame differs and sig must see that; the plain dissolve (no street picture to fly by) steps, like the cards.
    const eased = 1 - easeInOut(inT), streetA = ride.fade ? (fly ? eased : Math.round(eased * 6) / 6) : street.alpha(p, eAt);
    const sig = [f, camY, streetA, loads, now < fading && now, shot < 0, shot > 0 && take, ...open.values(), ...lit.values()].join();
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
    street.draw(ctx, f, w, h, streetA, dpr, wide, undefined, shot ? null : undefined);   // during the shot, its flat colours and the windows' places
    if (shot > 0) street.flight(ctx, 0, w, h, dpr, wide, street.fly('E', take, w, h, dpr, wide));
    else if (shot) { ctx.fillStyle = SKY; ctx.fillRect(0, 0, w, h); }   // the shot's first picture, and what pixel.css shows before this script

    // Every storey, the one in view with its top at ry; s and x0 are the frame's own, or the flight's.
    function tower(s, x0, ry) { for (const key of ORDER) {
      const y = Math.round(ry - (level(key) - camY) * s);
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
      // A storey passed with its lights off, whose dark picture idle time has not made yet, stays plain until it has, rather
      // than making it in this frame; only the ride's own stop is worth that (#184). Then it fades in, like a late arrival.
      if (LAMPS[key] && lit.get(key) < 1 && !still && !img.shades?.[16] && key !== keys[ride.to]) { img.waited = true; darkenSoon(img); ctx.fillRect(0, y, w, FH * s); continue; }
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
      // The roof is outdoors: the street's weather falls on it too, right of the lift's lobby (art x 117) and down to its deck.
      if (key === 'R') street.weather(ctx, f, { s, x: x0, y }, w, h, [x0 + ROOF_FROM * s, 0, w, y + ROOF_DECK * s]);
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

// Floors waiting for their lights-off picture, made a step at a time in the browser's idle time; where there is no
// requestIdleCallback (Safari), on timers. Either way in slices of at most SLICE ms, short enough for a tap to wait out.
const dim = [], SLICE = 8;
const idle = 'requestIdleCallback' in window ? (f, timeout) => requestIdleCallback(f, { timeout }) : (f) => setTimeout(f, 1);
let darkening = false;
function darkenSoon(img, first) {   // first: one the next ride shows, ahead of the queue
  const at = dim.indexOf(img);
  if (img.shades?.[16] || (at >= 0 && !first)) return;
  if (at >= 0) dim.splice(at, 1);
  if (first) dim.unshift(img); else dim.push(img);
  if (!darkening) { darkening = true; idle(darkenSome, 100); }
}
function darkenSome(deadline) {
  // A page busy with a ride may have no idle time: after 100 ms it gets a slice anyway, before a frame.
  const stop = performance.now() + (deadline && !deadline.didTimeout ? Math.min(SLICE, deadline.timeRemaining()) : SLICE);
  do {   // at least one step a call, so a busy page still gets there
    const img = dim[0];
    if (img.shades?.[16]) { dim.shift(); continue; }   // a flight needed it first
    img.darkening ??= darken(img);
    const step = img.darkening.next();
    if (step.done) { (img.shades ??= {})[16] = step.value; img.darkening = null; dim.shift(); img.dark?.(); }
  } while (dim.length && performance.now() < stop);
  if (dim.length) idle(darkenSome, 100); else darkening = false;
}

const canvas = document.querySelector('#pixel-canvas');
if (canvas) {
  const stops = [...document.querySelectorAll('section[data-floor]')];
  const api = mountPixel({ canvas, stops, base: canvas.dataset.base || '/building/', windowsBox: document.querySelector('[data-exterior-windows]'), pauseButton: document.querySelector('[data-building-pause]') });
  guide(api);
  if (import.meta.env?.DEV) window.__building = api;
}
