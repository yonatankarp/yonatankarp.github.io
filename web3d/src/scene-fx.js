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
  return {
    // A mover's pixels are drawn only where nothing in the painting is nearer than the ground under its feet, so trees,
    // lamp posts and walls in front of it hide it.
    dfill(x, y, w, h, foot) {
      if (w < 0) { x += w; w = -w; }
      for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) {
        for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) if (depth[yy * W + xx] <= foot + TOL) ctx.fillRect(xx, yy, 1, 1);
      }
    },
    // The ground a mover stands on: the farthest depth within 8 px of its feet. Right under a tree the pixel at its feet
    // is the tree, and taking that would put it level with the tree instead of behind it.
    footAt(x, y) {
      let m = 255;
      y = Math.min(H - 1, Math.max(0, y));
      for (let xx = Math.max(0, x - 8); xx <= Math.min(W - 1, x + 8); xx++) m = Math.min(m, depth[y * W + xx]);
      return m;
    },
  };
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
