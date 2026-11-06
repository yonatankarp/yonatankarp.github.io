// What the animations over the pixel-art paintings share (city-fx.js, workshop-fx.js, library-fx.js): a canvas at the
// art's own pixels laid over the picture, so they stay crisp pixel art; their data, written by the pipeline
// (web3d/pixel/); a depth test that hides movers behind what stands nearer; and a loop that runs only while it is seen.
export const rnd = (a, b) => a + Math.random() * (b - a);
const TOL = 5;   // out of 255: how much nearer than a mover's feet a pixel may be and still not hide it

// Animates `canvas` from the JSON at `data` and, given one, the depth map at `depth` (brighter = nearer).
// setup(ctx, fx, test) returns draw(now, dt), called each frame on a cleared canvas; `test` is the depth test, if any.
// Nothing at all under reduced motion, or with ?fx=off, which keeps the visual captures still; `live` can hold it too.
export function animate(canvas, { data, depth, live = () => true }, setup) {
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  if (still.matches || new URLSearchParams(location.search).get('fx') === 'off') return;
  Promise.all([
    fetch(data).then((r) => r.json()),
    // Raw values, untouched by colour management: they are depths, not colours.
    depth && fetch(depth).then((r) => r.blob()).then((b) => createImageBitmap(b, { colorSpaceConversion: 'none' })),
  ]).then(([fx, bitmap]) => {
    const ctx = canvas.getContext('2d');
    loop(ctx, setup(ctx, fx, bitmap && depthTest(ctx, bitmap)), live, still);
  }).catch(() => {});   // without its data the picture is just still
}

function depthTest(ctx, bitmap) {
  const { width: W, height: H } = ctx.canvas, pad = new OffscreenCanvas(W, H).getContext('2d');
  pad.drawImage(bitmap, 0, 0);
  const rgba = pad.getImageData(0, 0, W, H).data, depth = new Uint8Array(W * H);
  for (let i = 0; i < depth.length; i++) depth[i] = rgba[i * 4];
  // A mover's pixels are drawn only where nothing in the painting is nearer than the ground under its feet, so trees,
  // lamp posts and walls in front of it hide it.
  const dfill = (x, y, w, h, foot) => {
    if (w < 0) { x += w; w = -w; }
    for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) {
      for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) if (depth[yy * W + xx] <= foot + TOL) ctx.fillRect(xx, yy, 1, 1);
    }
  };
  // The ground a mover stands on: the farthest depth within 8 px of its feet. Right under a tree the pixel at its feet
  // is the tree, and taking that would put it level with the tree instead of behind it.
  const footAt = (x, y) => {
    let m = 255;
    y = Math.min(H - 1, Math.max(0, y));
    for (let xx = Math.max(0, x - 8); xx <= Math.min(W - 1, x + 8); xx++) m = Math.min(m, depth[y * W + xx]);
    return m;
  };
  // One frame of a painted person (people()) with its sole on (x, y), mirrored when facing left, depth-tested from its feet.
  const sprite = (sheet, frame, x, y, left) => {
    const x0 = Math.round(x) - (sheet.w >> 1), y0 = y - frame.foot, f = footAt(Math.round(x), y);
    for (const { fill, px } of frame.cells) {
      ctx.fillStyle = fill;
      for (let i = 0; i < px.length; i += 2) dfill(x0 + (left ? sheet.w - 1 - px[i] : px[i]), y0 + px[i + 1], 1, 1, f);
    }
  };
  return { dfill, footAt, sprite };
}

// A sheet of painted people (gen_walkers.py), a row per person and a column per frame, split once into each frame's
// pixels grouped by colour, as they are or dimmed for the night, with the row of its sole. url(ext) is the sheet's .json or .webp. Resolves to null
// without it: the scene goes without them.
export function people(url, night) {
  return Promise.all([
    fetch(url('json')).then((r) => r.json()),
    fetch(url('webp')).then((r) => r.blob()).then((b) => createImageBitmap(b, { colorSpaceConversion: 'none' })),
  ]).then(([m, bitmap]) => {
    const pad = new OffscreenCanvas(bitmap.width, bitmap.height).getContext('2d');
    pad.drawImage(bitmap, 0, 0);
    const d = pad.getImageData(0, 0, bitmap.width, bitmap.height).data, dim = (v, k) => Math.round(v * 0.45 + [14, 16, 34][k] * 0.55);   // under rgba(14,16,34,.55)
    const frames = m.people.map((_, j) => Array.from({ length: m.frames }, (_, k) => {
      const byColour = new Map();
      for (let y = 0; y < m.h; y++) {
        for (let x = 0; x < m.w; x++) {
          const i = ((j * m.h + y) * bitmap.width + k * m.w + x) * 4;
          if (d[i + 3] < 128) continue;
          const fill = `rgb(${[d[i], d[i + 1], d[i + 2]].map((v, c) => (night ? dim(v, c) : v))})`;
          if (!byColour.has(fill)) byColour.set(fill, []);
          byColour.get(fill).push(x, y);
        }
      }
      return { cells: [...byColour].map(([fill, px]) => ({ fill, px })), foot: m.foot[j][k] };
    }));
    return { ...m, frames };
  }).catch(() => null);
}

// Drawn only while it can be seen: the tab shown, the canvas on screen, motion welcome, and `live`.
function loop(ctx, draw, live, still) {
  const { canvas } = ctx, clear = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
  let raf = 0, last = 0, seen = true;
  const going = () => !document.hidden && seen && !still.matches && live();
  const frame = (now) => {
    raf = 0;
    if (!going()) { if (still.matches) clear(); return; }
    const dt = Math.min(100, now - last);
    last = now;
    clear();
    draw(now, dt);
    raf = requestAnimationFrame(frame);
  };
  const wake = () => { if (!raf && going()) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', wake);
  still.addEventListener('change', () => { if (still.matches) clear(); else wake(); });
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; wake(); }).observe(canvas);
  wake();
}
