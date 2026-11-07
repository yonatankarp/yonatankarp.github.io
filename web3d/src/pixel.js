// The career tower: one 960x360 pixel-art strip per floor (web3d/pixel/gen_floors.py), stacked, and drawn at a whole
// number of device pixels per art pixel so every pixel stays square. The lift rides between floors.
// Reads its stops from the page (<section data-floor="KEY">) and emits the building:* events guide.js listens to.
// The art's numbers come from art.js. The city (city.js) leads in at the lobby.
import { guide, roomy } from './guide.js';
import { FW, FH, FRAMES, EDGE, ROOM_X0, ROOM_X1, ORDER, ANIM, CAB, BOXES, DOOR, LAMPS, TIME, BAKED, HOUR, SKY_AT_LOAD, SHADES, CAPSULE, RECEPTION, DARK, narrow, clamp01, colourAt, shade, darken, bayer } from './art.js';
import { capsuleAt } from './capsule.js';
import { reception } from './reception.js';
import { floorKey, floorShaped } from './hash.js';
import './city.js';
import '../../assets/js/copy-email.js';
import '../../assets/js/site-menu.js';
import './pixel.css';

const FPS = 8;
const REST_MS = 2600;   // after each action loop the room holds still, so the text keeps the reader's attention
let SKY = SKY_AT_LOAD;                                         // above the roof, until its strip gives its own top row
const GROUND = ['#33231a', '#1f1610'];                        // under the lobby: the earth's top line, then soil
const POOL = 16;                                                 // a lamp's light spreads in blocks this many art pixels wide
const OVER = 4, SETTLE = 260;                                   // the cab sinks on past its stop, in art pixels, and comes back, in ms
const FOCUS = 600;                                              // on narrow screens, the art x kept mid-screen
const FADE_IN_MS = 300;                                         // a picture that arrives late fades in over its stand-in
const PAUSE_KEY = 'building-paused';                            // per viewer, kept across reloads
const LAMPS_AFTER = 180;                                        // arriving on a floor: the old page is still over the room until about now
const DOORS = 3.3;                                              // the lift doors' speed, in full travels per second
const STARS = [760, 180];                                       // the roof strip's x and width of open night sky, tiled above it
const KEEP = 2;                                                 // the storeys kept decoded either side of the lift's stop: the rest are let go
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');   // read live: it can change after load
const held = () => reduceMotion.matches || !roomy.matches;              // no motion to pause: asked for none, or the plain page, where the pause scrolls away
const hashKey = () => floorKey(location.hash, ORDER);   // a floor that exists again (a new floor 8) wins over its old anchor
const PAY = 36;                                                 // floor 7's capsule's canvas, in art pixels: it turned any way, on the 4-pixel Bayer grid
const TRIES = 3, RETRY_MS = 2000;                                // a strip that failed to load is asked for again, this often and no sooner

export function mountPixel({ canvas, stops, base = '/building/', version = '', pauseButton }) {
  const ctx = canvas.getContext('2d');
  const keys = stops.map((s) => s.dataset.floor);
  const strips = new Map();         // key -> ImageBitmap or Image (or null while loading / missing)
  const open = new Map();           // key -> 0..1, lift doors
  const lit = new Map();            // key -> 0..1, its lamps: on only where the lift has arrived
  let loads = 0, fading = 0;        // bumped by every image that arrives: the picture changes (and fades in)
  const loaded = () => { loads++; fading = performance.now() + FADE_IN_MS; wake(); };
  // The art's URLs carry its version, computed from the files at build time (layouts/index.html): a strip cached from
  // before a change of the art is never drawn by the numbers bundled for the new one (#65).
  const artUrl = (name) => `${base}pixel/${name}.webp${version && `?v=${version}`}`;
  const started = new Set(), failed = new Map();   // failed: key -> [tries, when]
  const load = (key) => {
    if (!keys.includes(key) || started.has(key)) return;
    const [tries, when] = failed.get(key) ?? [0, -Infinity];
    if (tries >= TRIES || performance.now() - when < RETRY_MS) return;   // a strip that keeps failing is not fetched on every hover
    started.add(key);
    if (key === CAPSULE.floor) pay.img ??= Object.assign(new Image(), { onload: wake, src: artUrl('capsule') });
    if (key === RECEPTION.floor) desk.img ??= Object.assign(new Image(), { onload: wake, src: artUrl('receptionists') });
    const url = artUrl(`floor-${key}${BAKED?.includes(key) ? HOUR : ''}`);
    // Decoded off the main thread, as a bitmap: an <img> is decoded by the first drawImage, the whole strip there and then (#184).
    const art = 'createImageBitmap' in window
      ? fetch(url).then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob(); }).then((b) => createImageBitmap(b))
      : new Promise((ok, fail) => Object.assign(new Image(), { onload() { ok(this); }, onerror: fail, src: url }));
    art.then((img) => {
      if (!started.has(key)) return release(img);   // let go while it was on its way
      if (key === 'R') SKY = colourAt(img, 600, 0);
      if (LAMPS[key]) { img.dark = () => { if (img.waited) img.since = performance.now(); loaded(); }; if (!held()) darkenSoon(img, urgent.has(key)); }
      img.since = performance.now(); strips.set(key, img); loaded();
    }, () => {   // drawn plain for now; the next ride that needs it asks again (#63)
      started.delete(key); failed.set(key, [tries + 1, performance.now()]);
      strips.set(key, null); loaded();
    });
  };
  // Floor 7's payment: its painted capsule (capsule.webp) rides the room's pipe at the screen's frame rate, not in the strip's
  // frames (capsule.js). It is turned and smoothed into a small canvas in the room's own art pixels, laid on the strip's Bayer
  // grid, and drawn at the room's scale like the strip, darkened with it (dimmed).
  const pay = { img: null, at: null, x: 0, y: 0, shades: {}, c: document.createElement('canvas').getContext('2d', { willReadFrequently: true }) };
  pay.c.canvas.width = pay.c.canvas.height = PAY;
  const payDraw = ([x, y, a]) => {
    const g = pay.c, [len, depth] = CAPSULE.size;
    pay.x = Math.floor((x - PAY / 2) / 4) * 4; pay.y = Math.floor((y - PAY / 2) / 4) * 4;
    g.clearRect(0, 0, PAY, PAY);
    g.save();
    g.beginPath();
    for (const [cx, cy, cw, ch] of CAPSULE.clip) g.rect(cx - pay.x, cy - pay.y, cw, ch);   // it slips out of view into the counter
    g.clip();
    g.translate(x - pay.x, y - pay.y); g.rotate(a);
    g.imageSmoothingQuality = 'high';
    g.drawImage(pay.img, -len / 2, -depth / 2, len, depth);
    g.restore();
    pay.shades = {};
  };
  // A live sprite's canvas (the capsule's, the receptionists') with the room's lights off, lv of 16 Bayer cells of it kept,
  // as shade() makes the strip's: the canvas sits on the strip's 4-pixel grid, so the dither lines up with the room's.
  const dimmed = (sp, lv) => (sp.shades[lv] ??= (() => {
    const { width: W, height: H } = sp.c.canvas;
    const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    c.canvas.width = W; c.canvas.height = H;
    const d = sp.c.getImageData(0, 0, W, H), px = d.data;
    for (let i = 0; i < px.length; i += 4) { px[i] *= DARK[0]; px[i + 1] *= DARK[1]; px[i + 2] *= DARK[2]; }
    c.putImageData(d, 0, 0);
    if (lv < 16) { c.globalCompositeOperation = 'destination-in'; c.fillStyle = c.createPattern(bayer(lv), 'repeat'); c.fillRect(0, 0, W, H); }
    return c.canvas;
  })());
  // The lobby's receptionists: painted people (receptionists.webp, a row each, a column per pose) behind its desk, whose top
  // edge their sprites are cut at. What each does is picked live (reception.js), on a clock that runs only while the room
  // may move and is on screen. Both are laid in one small canvas on the strip's Bayer grid, remade when a pose changes, and
  // drawn once, where the desk is (the runs a wide screen tiles are the room's edge columns), darkened with the room.
  const R = RECEPTION, staff = reception(R), spots = Object.values(R.spots);
  const desk = { img: null, poses: '', ran: 0, shades: {}, c: document.createElement('canvas').getContext('2d', { willReadFrequently: true }),
    x: Math.floor((Math.min(...spots) - R.w / 2) / 4) * 4, y: Math.floor((R.deskY - R.desk) / 4) * 4 };
  desk.c.canvas.width = Math.max(...spots) + R.w / 2 - desk.x; desk.c.canvas.height = R.deskY - R.desk + R.h - desk.y;
  const deskDraw = (poses) => {
    desk.c.clearRect(0, 0, desk.c.canvas.width, desk.c.canvas.height);
    poses.forEach((pose, j) => desk.c.drawImage(desk.img, R.poses.indexOf(pose) * R.w, j * R.h, R.w, R.h,
      Math.round(R.spots[R.people[j]] - R.w / 2) - desk.x, R.deskY - R.desk - desk.y, R.w, R.h));
    desk.shades = {};
  };

  // Decoded strips are big (a phone holds a few hundred MB at most): only the storeys round the lift's stop are kept,
  // and the ones a ride passes while it runs. A storey let go is fetched again (from the cache) when it is next near.
  const evict = () => {
    const at = ORDER.indexOf(keys[ride.to]);
    for (const key of started) {
      if (Math.abs(ORDER.indexOf(key) - at) <= KEEP) continue;
      const img = strips.get(key);
      started.delete(key); strips.delete(key); lit.delete(key); open.delete(key);
      if (img) release(img);
    }
  };
  // The storeys above and below the stop, which show at the screen's edges, and theirs, for the edges after one step.
  const nearby = (key) => [ORDER[ORDER.indexOf(key) - 1], ORDER[ORDER.indexOf(key) + 1]];
  const around = (key) => [...new Set([key, ...nearby(key), ...nearby(key).filter(Boolean).flatMap(nearby)])];
  // A ride shows its stop and that stop's neighbours, which are darkened first, and every storey it passes on the way.
  let urgent = new Set();
  const need = (from, to) => {
    urgent = new Set([keys[to], ...nearby(keys[to])]);
    const [a, b] = [level(keys[Math.round(from)]), level(keys[to])].sort((x, y) => x - y);
    [...urgent, ...ORDER.filter((k) => level(k) >= a && level(k) <= b), ...around(keys[to])].forEach(load);
    if (!held()) urgent.forEach((k) => strips.get(k) && LAMPS[k] && darkenSoon(strips.get(k), true));
  };
  // A floor about to be asked for, by a pointer over its control or the focus on it, starts loading what its ride will show.
  for (const type of ['pointerover', 'focusin']) document.addEventListener(type, (e) => { const i = keys.indexOf(e.target.closest?.('[data-goto]')?.dataset.goto); if (i >= 0) need(cab(rideU(performance.now())), i); }, { passive: true });

  // ---- the ride ----
  // v: the speed carried over from a ride retargeted mid-way (floors per unit of u), so the cab never stops dead.
  // land, settle: it reaches its stop still moving, by that much, and spends the ride's last settle ms sinking past it and back.
  const ride = { from: 0, to: 0, start: 0, dur: 0, v: 0, land: 0, settle: 0, sink: 0 };
  const fromHash = keys.indexOf(hashKey());
  ride.from = ride.to = fromHash >= 0 ? fromHash : keys.indexOf('L');   // in from the city: the lobby
  lit.set(keys[ride.from], 1);   // a page opening on a floor opens with the lights on
  around(keys[ride.from]).forEach(load);
  if (location.hash !== `#floor-${keys[ride.to]}`) {   // the city's #floor-E, a legacy or lowercased anchor, a floor there is not: show the floor's own
    history.replaceState(null, '', `#floor-${keys[ride.to]}`);
    if (fromHash >= 0) requestAnimationFrame(() => document.documentElement.classList.contains('building--guided') || stops[ride.to].scrollIntoView());
  }
  const rideU = (now) => (ride.dur ? clamp01((now - ride.start) / ride.dur) : 1);
  // A cubic Hermite (smoothstep plus any carried speed's term), which lands without overshooting and, without a cubic ease's
  // peak of 3x the mean, without strobing: past about 50 CSS px a frame the eye sees separate pictures, not motion. The
  // land term is its other end's tangent, the speed the settle starts at.
  const pos = (u) => {
    const m = ride.settle ? Math.min(1, u * ride.dur / (ride.dur - ride.settle)) : u;
    return ride.from + (ride.to - ride.from) * m * m * (3 - 2 * m) + ride.v * m * (1 - m) ** 2 + ride.land * m * m * (m - 1);
  };
  // How far past its stop the cab has sunk, in art pixels.
  const sunk = (u) => { const t = ride.settle ? 1 - (1 - u) * ride.dur / ride.settle : 0; return t > 0 ? ride.sink * Math.sin(Math.PI * t) : 0; };
  // Where the camera is, settle included, for a ride to start from.
  // shortcut: past the roof or the lobby there is no next storey to measure that against, so a ride asked for in that settle starts from the stop, up to OVER art pixels away; carry the offset separately if that ever shows.
  const cab = (u) => { const past = pos(u) - sunk(u) / FH; return past >= 0 && past <= keys.length - 1 ? past : pos(u); };
  const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));
  function go(index) {
    const now = performance.now(), u = rideU(now);
    const to = Math.max(0, Math.min(keys.length - 1, index));
    need(cab(u), to);
    if (to === ride.to) return false;   // already on its way there
    const here = cab(u), vel = u < 1 ? (here - cab(rideU(now - 16))) / 16 : 0;   // floors per ms
    const still = held();
    const dist = Math.abs(to - here), dur = Math.min(1600, 650 + 230 * Math.max(0, dist - 1));
    const closeMs = still ? 0 : ((open.get(keys[Math.round(here)]) ?? 0) / DOORS) * 1000;   // the doors shut, then it moves
    // The eased start moves the camera less than half an art pixel at first: that stretch runs as the doors finish.
    const hidden = vel ? 0 : dur * Math.sqrt(1 / (2160 * Math.max(dist, 1e-3)));
    const settle = still || paused ? 0 : SETTLE;
    Object.assign(ride, {
      from: here, to, start: now + Math.max(0, closeMs - hidden), dur: still ? 1 : dur + settle, v: still ? 0 : vel * dur, settle,
      land: settle ? Math.sign(to - here) * (OVER / FH) * (Math.PI / settle) * dur : 0, sink: OVER * Math.sign(level(keys[to]) - lerpAt(here, level)),
    });
    document.documentElement.classList.toggle('lift-ride', !still);   // the card waits for the doors (pixel.css)
    history.replaceState(null, '', `#floor-${keys[to]}`);
    arrived = -1;   // a ride redirected back to the floor it left still arrives there (#31)
    emit('building:depart', { index: to, key: keys[to], dir: Math.sign(to - here) });
    wake();
    return true;
  }

  // Floor stop index -> height in the tower, in art pixels (higher floors further up the screen).
  const level = (key) => ORDER.indexOf(key) * FH;
  const lerpAt = (p, of) => {
    const k = Math.min(Math.floor(p), keys.length - 1);
    const a = of(keys[k]), b = of(keys[Math.min(k + 1, keys.length - 1)]);
    return a + (b - a) * (p - k);
  };

  // The room loops only while it is allowed to move: the pause button (WCAG 2.2.2), reduced motion and the plain page
  // hold it on its rest frame. A frame that would draw the same picture is skipped, and once nothing is moving the loop
  // sleeps: until the next frame of the loop, or for good while held, until a ride, a resize or a load wakes it (#36).
  let paused = false, raf = 0, timer = 0, drawn = '', epoch = 0;
  try { paused = localStorage.getItem(PAUSE_KEY) === 'true'; } catch { /* blocked storage: it just is not remembered */ }
  // Arrived from another page under its view transition, which reduced motion never has (layouts/index.html tells us; a
  // page restored by Back gets it too): the doors shut and the lamps off, until the old page has cleared the room.
  let waiting = '', waitTo = 0;
  const arrive = () => {
    document.documentElement.classList.remove('px-arrive');
    if (held() || paused || rideU(performance.now()) < 1) return;
    const key = keys[ride.to];
    open.set(key, 0); lit.set(key, 0);
    waiting = key; waitTo = performance.now() + LAMPS_AFTER;
    setTimeout(wake, LAMPS_AFTER);
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

    const u = rideU(now);
    const p = Math.min(keys.length - 1, Math.max(0, pos(u)));
    // Device pixels an art pixel: the largest whole number at which the floor fits (wide) or fills its share (phones).
    let s = Math.max(1, Math.floor(dpr * (wide ? Math.min(W / FW, H / (FH * 1.15)) : H / (FH * 2.2))));
    // Phones: the room's floor sits behind the elevator, above the card (pixel.css --card-top). On a short phone
    // the room is drawn smaller, down to 2/3 CSS px an art pixel, still a whole number of device pixels (#127).
    const floorAt = cardTop - 28;
    if (!wide && cardTop) s = Math.min(s, Math.max(Math.ceil(dpr * 2 / 3), Math.floor(dpr * floorAt / FH)));
    const x0 = wide ? Math.round((w - FW * s) / 2) : Math.min(0, Math.max(w - FW * s, Math.round(w / 2 - FOCUS * s)));
    const cy = wide ? h / 2 : cardTop ? floorAt * dpr - FH * s / 2 : h * 0.3;   // phones keep the room above the card
    const ry = Math.round(cy - FH * s / 2);                    // the top of the floor in view
    const camY = Math.round((lerpAt(p, level) + sunk(u)) * s) / s;   // whole device pixels: art pixels stay one size, and a slow move is not a series of art-pixel jumps
    const near = Math.round(p);
    if (near !== passing) { passing = near; emit('building:floor', { index: near, key: keys[near] }); }
    // Arrived the moment the camera reaches its stop: the doors and the lamps start as it settles.
    const landed = u === 1 || (u > 0.5 && (camY - level(keys[ride.to])) * ride.sink >= 0);
    if (landed && arrived !== ride.to) { arrived = ride.to; evict(); emit('building:arrive', { index: ride.to, key: keys[ride.to] }); }

    const phase = (now - epoch) % (loopMs + REST_MS);
    const f = paused || still || phase >= loopMs ? 0 : Math.floor(phase / (1000 / FPS));
    // The capsule rides from the loop's start, while floor 7 is on screen and the room may move.
    const payY = Math.round(ry - (level(CAPSULE.floor) - camY) * s);
    pay.at = !paused && !still && pay.img?.naturalWidth && strips.get(CAPSULE.floor) && payY < h && payY + FH * s > 0 ? capsuleAt(CAPSULE, phase) : null;
    // The receptionists' clock runs while the lobby is on screen and may move: paused, they hold their pose; held, they rest.
    const deskTop = Math.round(ry - (level(R.floor) - camY) * s);
    const deskOn = desk.img?.naturalWidth && strips.get(R.floor) && deskTop < h && deskTop + FH * s > 0, deskMoves = deskOn && !paused && !still;
    if (deskMoves && desk.ran) staff.step(now - desk.ran);
    desk.ran = deskMoves ? now : 0;
    const poses = deskOn ? staff.all.map((p) => (still ? 'idle' : p.pose)).join() : '';
    for (const key of ORDER) {
      if (key === waiting && (now < waitTo || !strips.has(key))) continue;
      const here = arrived === ride.to && keys[ride.to] === key;
      open.set(key, clamp01((open.get(key) ?? 0) + (here ? dt : -dt) * (still ? 99 : DOORS)));
      lit.set(key, clamp01((lit.get(key) ?? 0) + (here ? dt : -dt) * (still || paused ? 99 : DOORS)));   // in step with the doors; paused, they just switch
    }
    const sig = [f, pay.at, poses, camY, loads, now < fading && now, ...open.values(), ...lit.values()].join();
    if (sig === drawn) {
      if (u === 1) {   // still: sleep until the loop's next frame, or until woken
        cancelAnimationFrame(raf); raf = 0;
        if (!paused && !still) {
          const next = phase < loopMs ? 1000 / FPS - (phase % (1000 / FPS)) : pay.at ? CAPSULE.ride + CAPSULE.hold - phase : loopMs + REST_MS - phase;
          timer = setTimeout(wake, deskMoves ? Math.min(next, staff.next()) : next);   // or when a receptionist next changes
        }
      }
      return;
    }
    drawn = sig;
    if (pay.at) payDraw(pay.at);
    if (poses && poses !== desk.poses) deskDraw((desk.poses = poses).split(','));

    ctx.fillStyle = '#151923';
    ctx.fillRect(0, 0, w, h);
    // Every storey, the one in view with its top at ry.
    for (const key of ORDER) {
      const y = Math.round(ry - (level(key) - camY) * s);
      const img = strips.get(key);
      if (key === 'R' && y > 0) {                                                         // the sky goes on above the roof
        ctx.fillStyle = SKY; ctx.fillRect(0, 0, w, y + 1);
        // At night its stars too: a patch of the roof's own top rows right of the crane, plain sky and stars, each course
        // shifted so no column of them lines up.
        const [sx, sw] = STARS;
        if (TIME === 'night' && img) for (let r = 1, gy = y - 32 * s; gy + 32 * s > 0; r++, gy -= 32 * s) for (let gx = -(r * 97 % sw) * s; gx < w; gx += sw * s) ctx.drawImage(img, sx, 0, sw, 32, gx, gy, sw * s, 32 * s);
      }
      if (key === ORDER[0] && y + FH * s < h) {                                           // and the ground under the lobby
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
      // The strip: its rest frame, then a run of EDGE columns that carries on left of the painting and another right of
      // it, tiled outwards over the facade posts on a wide screen (gen_floors.runs), then its moving box's other frames; on
      // floor 7, its capsule, and in the lobby, its receptionists, darkened as src is (lv of 16 Bayer cells dark, none for the lit room).
      const paint = (src, f, lv) => {
        ctx.drawImage(src, 0, 0, FW, FH, x0, y, FW * s, FH * s);
        if (wide) {
          for (let gx = x0 + (ROOM_X0 - EDGE) * s; gx + EDGE * s > 0; gx -= EDGE * s) ctx.drawImage(src, FW, 0, EDGE, FH, gx, y, EDGE * s, FH * s);
          for (let gx = x0 + ROOM_X1 * s; gx < w; gx += EDGE * s) ctx.drawImage(src, FW + EDGE, 0, EDGE, FH, gx, y, EDGE * s, FH * s);
        }
        const [bx, by, bw, bh] = ANIM[key];
        if (f) ctx.drawImage(src, BOXES + (f - 1) * bw, 0, bw, bh, x0 + bx * s, y + by * s, bw * s, bh * s);
        if (pay.at && key === CAPSULE.floor) ctx.drawImage(lv ? dimmed(pay, lv) : pay.c.canvas, x0 + pay.x * s, y + pay.y * s, PAY * s, PAY * s);
        if (poses && key === R.floor) {
          const { width: dw, height: dh } = desk.c.canvas;
          ctx.drawImage(lv ? dimmed(desk, lv) : desk.c.canvas, x0 + desk.x * s, y + desk.y * s, dw * s, dh * s);
        }
      };
      paint(img, f);
      // Lights off in transit; on arrival each lamp's pool spreads from its shade, the lift's first, in blocks of whole-pixel
      // dither, never an alpha veil. The doors go in front (drawn after), on their lit cab.
      const lamps = LAMPS[key], on = lit.get(key);
      if (lamps && on < 1 && !still) {
        if (!on) paint(shade(img, SHADES[0]), 0, SHADES[0]);
        else for (let lv = 0; lv < SHADES.length; lv++) {
          ctx.save();
          ctx.beginPath();
          for (let cx = 0; cx < FW; cx += POOL) for (let cy = 0; cy < FH; cy += POOL) {
            const glow = Math.max(...lamps.map((lx, i) => on - (i / lamps.length) * 0.4 - Math.min(1, Math.hypot(cx - lx, cy - 60) / 340) * 0.3));
            if (Math.floor(glow / 0.3 * SHADES.length) !== lv && (lv || glow > 0)) continue;
            const a = cx ? x0 + cx * s : 0, b = cx + POOL < FW ? x0 + (cx + POOL) * s : w;
            ctx.rect(a, y + cy * s, b - a, POOL * s);
          }
          ctx.clip();
          paint(shade(img, SHADES[lv]), 0, SHADES[lv]);
          ctx.restore();
        }
      }
      drawDoors(ctx, img, x0, y, s, open.get(key));
      ctx.globalAlpha = 1;
    }
  }
  wake();
  // e.g. the site menu's About; a pick the lift ignores (it is already going there), or a floor there is not, keeps the
  // lift's own hash
  addEventListener('hashchange', () => {
    const i = keys.indexOf(hashKey());
    if (i >= 0 ? !go(i) : floorShaped(location.hash)) history.replaceState(null, '', `#floor-${keys[ride.to]}`);
  });
  if (import.meta.env?.DEV) window.__held = () => [...strips.values()].filter(Boolean).reduce((n, img) => n + img.width * img.height * 4 + Object.values(img.shades ?? {}).reduce((m, c) => m + c.width * c.height * 4, 0), 0);
  return { go, index: () => ride.to, moving: () => arrived !== ride.to };
}

// A strip let go: its pixels freed now (a bitmap's close(), an image's empty src), and its lights-off pictures with it.
function release(img) {
  const at = dim.indexOf(img);
  if (at >= 0) dim.splice(at, 1);
  for (const c of Object.values(img.shades ?? {})) c.width = c.height = 0;
  img.shades = null; img.darkening = null;
  if (img.close) img.close(); else img.src = '';
}

// The painted door halves slide apart over the painted cab, a whole pixel at a time. They are the rest frame's: doors
// never move in a loop.
function drawDoors(ctx, img, x0, y0, s, open) {
  if (open <= 0) return;                                        // closed: the strip already shows the doors
  const gap = Math.round(open * (DOOR.mid - DOOR.x0 - 2));
  const top = y0 + DOOR.y0 * s, h = DOOR.y1 - DOOR.y0;
  const lw = DOOR.mid - DOOR.x0, rw = DOOR.x1 - DOOR.mid;
  const left = x0 + DOOR.x0 * s, width = (DOOR.x1 - DOOR.x0) * s;
  ctx.save();
  ctx.beginPath();
  ctx.rect(left, top, width, h * s);
  ctx.clip();
  ctx.drawImage(img, CAB, 0, DOOR.x1 - DOOR.x0, h, left, top, width, h * s);   // the cab
  ctx.drawImage(img, DOOR.x0, DOOR.y0, lw, h, x0 + (DOOR.x0 - gap) * s, top, lw * s, h * s);
  ctx.drawImage(img, DOOR.mid, DOOR.y0, rw, h, x0 + (DOOR.mid + gap) * s, top, rw * s, h * s);
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
    if (!img) break;
    if (img.shades?.[16]) { dim.shift(); continue; }   // a ride needed it first
    img.darkening ??= darken(img);
    const step = img.darkening.next();
    if (step.done) { (img.shades ??= {})[16] = step.value; img.darkening = null; dim.shift(); img.dark?.(); }
  } while (dim.length && performance.now() < stop);
  if (dim.length) idle(darkenSome, 100); else darkening = false;
}

const canvas = document.querySelector('#pixel-canvas');
const mount = () => {
  const stops = [...document.querySelectorAll('section[data-floor]')];
  const api = mountPixel({ canvas, stops, base: canvas.dataset.base || '/building/', version: canvas.dataset.version, pauseButton: document.querySelector('[data-building-pause]') });
  guide(api);
  if (import.meta.env?.DEV) window.__building = api;
};
// On the city (city.js) the tower waits, unloaded, until the visitor enters it.
if (canvas && document.documentElement.classList.contains('at-city')) document.addEventListener('city:enter', mount, { once: true });
else if (canvas) mount();
