// What the animations over the pixel-art paintings share (city-fx.js, workshop-fx.js, library-fx.js): a canvas at the
// art's own pixels laid over the picture, so they stay crisp pixel art; their data, written by the pipeline
// (web3d/pixel/); a depth test that hides movers behind what stands nearer; and a loop that runs only while it is seen.
export const rnd = (a, b) => a + Math.random() * (b - a);
// A scene's file, or null when it is not there (a 404, offline): the scene goes without it. Only the fetch is forgiven:
// a file that is there but cannot be read, and the scene's own setup, fail as page errors (#297).
export const asset = (url) => fetch(url).then((r) => (r.ok ? r : null), () => null);
const TOL = 5;   // out of 255: how much nearer than a mover's feet a pixel may be and still not hide it

// The top bar's Pause (pixel-bar.html, WCAG 2.2.2) holds the scenes as it holds the tower (pixel.js), kept the same way:
// per viewer, across reloads and pages, and read again when Back restores a page another one paused or played.
// On the city it is the tower's once the tower is entered (live() goes false).
export const PAUSE_KEY = 'building-paused';
export const pausedStored = () => { try { return localStorage.getItem(PAUSE_KEY) === 'true'; } catch { return false; } };   // blocked storage: not remembered
let paused = pausedStored();
export function pauseLabel(button, on, hidden) {
  button.hidden = hidden;
  button.dataset.paused = on;
  button.setAttribute('aria-label', on ? 'Play the animation' : 'Pause the animation');
  button.title = button.getAttribute('aria-label');
  button.querySelector('[data-building-pause-label]').textContent = on ? 'Play' : 'Pause';
}

// Animates `canvas` from the JSON at `data` and, given one, the depth map at `depth` (brighter = nearer).
// setup(ctx, fx, test) returns draw(now, dt), called each frame on a cleared canvas (draw.fps: see loop()); `test` is
// the depth test, if any.
// Nothing moves under reduced motion, or with ?fx=off, which keeps the visual captures still; `live` can hold it too.
// Then poster(ctx), if given, draws what stands still (the city's holiday props) once instead, and again whenever motion
// is turned off while the page is open.
export function animate(canvas, { data, depth, live = () => true, poster }, setup) {
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  if (still.matches || new URLSearchParams(location.search).get('fx') === 'off') { poster?.(canvas.getContext('2d')); return; }
  Promise.all([
    asset(data).then((r) => r && r.json()),
    // Raw values, untouched by colour management: they are depths, not colours.
    depth && asset(depth).then((r) => r && r.blob()).then((b) => b && createImageBitmap(b, { colorSpaceConversion: 'none' })),
  ]).then(([fx, bitmap]) => {
    const ctx = canvas.getContext('2d');
    if (!fx || (depth && !bitmap)) { poster?.(ctx); return; }   // without its data the picture is just still
    loop(ctx, setup(ctx, fx, bitmap && depthTest(ctx, bitmap)), live, still, poster);
  });
}

function depthTest(ctx, bitmap) {
  const { width: W, height: H } = ctx.canvas, pad = new OffscreenCanvas(W, H).getContext('2d');
  pad.drawImage(bitmap, 0, 0);
  const rgba = pad.getImageData(0, 0, W, H).data, depth = new Uint8Array(W * H);
  for (let i = 0; i < depth.length; i++) depth[i] = rgba[i * 4];
  // A mover's pixels are drawn only where nothing in the painting is nearer than the ground under its feet, so trees,
  // lamp posts and walls in front of it hide it.
  const dfill = (x, y, w, h, foot) => spans(depth, W, H, x, y, w, h, foot + TOL, (a, yy, n) => ctx.fillRect(a, yy, n, 1));
  // The ground a mover stands on: the farthest depth within 8 px of its feet. Right under a tree the pixel at its feet
  // is the tree, and taking that would put it level with the tree instead of behind it.
  const footAt = (x, y) => {
    let m = 255;
    y = Math.min(H - 1, Math.max(0, y));
    for (let xx = Math.max(0, x - 8); xx <= Math.min(W - 1, x + 8); xx++) m = Math.min(m, depth[y * W + xx]);
    return m;
  };
  // One frame of a painted person (people()) with its sole on (x, y), mirrored when facing left, depth-tested from its feet
  // (the ground under them, or the depth f): its picture, made once, drawn whole, or without the pixels something nearer
  // hides where anything in its box is.
  const cut = new OffscreenCanvas(1, 1).getContext('2d');
  const sprite = (sheet, frame, x, y, left, f = footAt(Math.round(x), y)) => {
    const { w, h } = sheet, x0 = Math.round(x) - (w >> 1), y0 = y - frame.foot, k = left ? 1 : 0;
    const px = (frame.px[k] ??= mirror(frame.px[0], w)), hid = hidden(px, w, h, x0, y0, depth, W, H, f + TOL);
    if (!hid) { ctx.drawImage(frame.baked[k] ??= baked(px, w, h), x0, y0); return; }
    if (cut.canvas.width !== w || cut.canvas.height !== h) { cut.canvas.width = w; cut.canvas.height = h; }
    cut.putImageData(new ImageData(hid, w, h), 0, 0);
    ctx.drawImage(cut.canvas, x0, y0);
  };
  return { dfill, footAt, sprite };
}

// Where the w x h box at (x, y) on a W x H depth map is no nearer than lim, as fill(x, y, length) for each row's run of it:
// a mover's pixels there, which never overlap, so the picture is the same as a rect a pixel.
export function spans(depth, W, H, x, y, w, h, lim, fill) {
  if (w < 0) { x += w; w = -w; }
  const x1 = Math.min(W, x + w);
  for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) {
    for (let xx = Math.max(0, x), row = yy * W; xx < x1; xx++) {
      if (depth[row + xx] > lim) continue;
      const a = xx;
      while (xx + 1 < x1 && depth[row + xx + 1] <= lim) xx++;
      fill(a, yy, xx + 1 - a);
    }
  }
}

// A w x h sprite's RGBA pixels px at (x0, y0) without those the depth map has nearer than lim, or null when nothing in
// its box is nearer.
export function hidden(px, w, h, x0, y0, depth, W, H, lim) {
  let out = null;
  for (let yy = Math.max(0, y0); yy < Math.min(H, y0 + h); yy++) {
    for (let xx = Math.max(0, x0); xx < Math.min(W, x0 + w); xx++) {
      if (depth[yy * W + xx] <= lim) continue;
      out ??= px.slice();
      out[((yy - y0) * w + xx - x0) * 4 + 3] = 0;
    }
  }
  return out;
}

// RGBA pixels w wide, mirrored left to right.
export function mirror(px, w) {
  const out = new Uint8ClampedArray(px.length);
  for (let i = 0; i < px.length; i += 4) { const j = i + (w - 1 - 2 * ((i >> 2) % w)) * 4; out.set(px.subarray(j, j + 4), i); }
  return out;
}
const baked = (px, w, h) => { const c = new OffscreenCanvas(w, h); c.getContext('2d').putImageData(new ImageData(px, w, h), 0, 0); return c; };

// A sheet of painted people or cats (gen_walkers.py), a row per person and a column per frame, split once into each frame's
// pixels grouped by colour and as RGBA, as they are or dimmed for the night, with the row of its sole. url(ext) is the sheet's .json or .webp. Resolves to null
// without it: the scene goes without them.
export function people(url, night) {
  return Promise.all([
    asset(url('json')).then((r) => r && r.json()),
    asset(url('webp')).then((r) => r && r.blob()).then((b) => b && createImageBitmap(b, { colorSpaceConversion: 'none' })),
  ]).then(([m, bitmap]) => {
    if (!m || !bitmap) return null;
    const pad = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
    pad.drawImage(bitmap, 0, 0);
    const d = pad.getImageData(0, 0, bitmap.width, bitmap.height).data, dim = (v, k) => Math.round(v * 0.45 + [14, 16, 34][k] * 0.55);   // under rgba(14,16,34,.55)
    const frames = m.people.map((_, j) => Array.from({ length: m.frames }, (_, k) => {
      const byColour = new Map(), px = new Uint8ClampedArray(m.w * m.h * 4);
      for (let y = 0; y < m.h; y++) {
        for (let x = 0; x < m.w; x++) {
          const i = ((j * m.h + y) * bitmap.width + k * m.w + x) * 4;
          if (d[i + 3] < 128) continue;
          const rgb = [d[i], d[i + 1], d[i + 2]].map((v, c) => (night ? dim(v, c) : v)), fill = `rgb(${rgb})`;
          if (!byColour.has(fill)) byColour.set(fill, []);
          byColour.get(fill).push(x, y);
          px.set([...rgb, 255], (y * m.w + x) * 4);
        }
      }
      return { cells: [...byColour].map(([fill, px]) => ({ fill, px })), foot: m.foot[j][k], px: [px], baked: [] };
    }));
    return { ...m, frames };
  });
}

// Snow falling over the whole art in winter, in front of everything: about 520 flakes, 1 px and some 2 px, drifting
// side to side as they fall at 7-23 px a second, bluish and dimmer at night. Returns draw(now, dt), for a scene's frame.
// The flakes keep to a few shades, so a frame sets its fill a handful of times, not once a flake.
export function snowfall(ctx, night) {
  const { width: W, height: H } = ctx.canvas, SHADES = 6;
  const fills = Array.from({ length: SHADES }, (_, k) => { const a = 0.45 + 0.5 * (k + 0.5) / SHADES; return night ? `rgba(215,228,255,${a * 0.8})` : `rgba(255,255,255,${a})`; });
  const flakes = Array.from({ length: SHADES }, () => []);
  for (let i = 0; i < 520; i++) flakes[Math.random() * SHADES | 0].push({ x: rnd(0, W), y: rnd(0, H), v: rnd(7, 23), w: rnd(0.4, 1.6), p: rnd(0, 6.3), s: Math.random() < 0.12 ? 2 : 1 });
  return Object.assign((now, dt) => {
    const t = now / 1000, k = dt / 1000;
    flakes.forEach((shade, j) => {
      ctx.fillStyle = fills[j];
      for (const f of shade) {
        f.y += f.v * k; f.x += (Math.sin(t * f.w + f.p) * 4 - 2) * k;
        if (f.y > H) { f.y = -2; f.x = rnd(0, W); }
        if (f.x < -2) f.x += W + 4;
        ctx.fillRect(Math.round(f.x), Math.round(f.y), f.s, f.s);
      }
    });
  }, { fps: 23 });   // its fastest flake's art pixels a second
}

// How many screen frames, iv ms apart, a scene at fps waits between draws: the most that still draws fps a second. A
// little slack keeps a screen whose rate divides evenly (60 at 120 Hz) from flipping between two counts as iv jitters.
export const every = (fps, iv) => Math.floor(1000 / (fps * iv) + 0.1);

// Drawn only while it can be seen: the tab shown, the canvas on screen, motion welcome, not paused, and `live`. Paused, it
// keeps the frame it was on. A scene whose draw has an fps, its fastest mover's art pixels a second, is drawn every k-th
// screen frame, as many as still keep that mover to a pixel a frame: evenly, so nothing judders, and not twice as often
// on a 120 Hz screen.
function loop(ctx, draw, live, still, poster) {
  const { canvas } = ctx, clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height), fps = Math.min(60, draw.fps ?? 60);
  const hold = () => { clear(); poster?.(ctx); };   // motion turned off: what stands still, as a still page has it
  let raf = 0, last = 0, prev = 0, seen = true, iv = 1000 / 60, skip = 0;   // iv: the screen's frame interval, smoothed
  const going = () => !document.hidden && seen && !still.matches && !paused && live();
  const frame = (now) => {
    raf = 0;
    if (!going()) { if (still.matches) hold(); return; }
    iv += (Math.min(100, now - prev) - iv) / 8;
    prev = now;
    if (++skip >= every(fps, iv)) {
      skip = 0;
      const dt = Math.min(100, now - last);
      last = now;
      clear();
      draw(now, dt);
    }
    raf = requestAnimationFrame(frame);
  };
  const wake = () => { if (!raf && going()) { last = prev = performance.now(); skip = Infinity; raf = requestAnimationFrame(frame); } };
  const pauseButton = document.querySelector('[data-building-pause]');
  const label = () => { if (pauseButton && live()) pauseLabel(pauseButton, paused, still.matches); };   // reduced motion has nothing to pause
  label();
  pauseButton?.addEventListener('click', () => {
    if (!live()) return;
    paused = !paused;
    label(); wake();
    try { localStorage.setItem(PAUSE_KEY, paused); } catch { /* as above */ }
  });
  addEventListener('pageshow', (e) => { if (e.persisted) { paused = pausedStored(); label(); wake(); } });
  document.addEventListener('visibilitychange', wake);
  still.addEventListener('change', () => { label(); if (still.matches) hold(); else wake(); });
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; wake(); }).observe(canvas);
  wake();
}
