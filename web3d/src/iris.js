// Going into a district from the city (city.js): the city's last frame, laid over the next view, opens in a dithered iris
// from the door it pushed into, each 12 px cell clearing at its 4x4 Bayer threshold as the ring passes it, while the view
// under it settles from 1.18 to its rest, so the push carries on through the door. The tower is the city's own page, which
// draws its frame itself; every other district is a page of its own, handed the frame by the head's pre-paint
// (assets/js/push-in.js) as window.pushIn.
const CELL = 12, BAND = 5 * CELL, STEPS = 18, OPEN_MS = 600, SETTLE_MS = 700;
export const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];   // floors.json's, which the lobby's dissolve opens in too: scripts/test/iris.test.js

// A screen-sized canvas over the page at z, under the top bar, with paint's picture on it, in CSS px.
export function cover(paint, z = 1) {
  const c = document.createElement('canvas'), dpr = devicePixelRatio || 1;
  c.className = 'px-iris';
  c.setAttribute('aria-hidden', 'true');
  Object.assign(c.style, { position: 'fixed', left: '0', top: '0', width: `${innerWidth}px`, height: `${innerHeight}px`, zIndex: z, pointerEvents: 'none' });   // the frame's own px, under a scrollbar if any
  c.width = Math.round(innerWidth * dpr); c.height = Math.round(innerHeight * dpr);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr); ctx.imageSmoothingEnabled = false;
  paint(ctx);
  document.body.append(c);
  return c;
}

// The iris opens from [px, py] on the screen, and each [element, ox, oy] of settle settles about its own (ox, oy).
// Resolves once the frame is gone.
export function iris(c, [px, py], settle = []) {
  const timing = { duration: SETTLE_MS, easing: 'cubic-bezier(0.2, 0.7, 0.3, 1)' };
  for (const [el, ox, oy] of settle) el.animate({ transform: ['scale(1.18)', 'none'], transformOrigin: [`${ox}px ${oy}px`, `${ox}px ${oy}px`] }, timing);
  const ctx = c.getContext('2d'), W = innerWidth, H = innerHeight;
  const cols = Math.ceil(W / CELL), rows = Math.ceil(H / CELL), far = Math.hypot(Math.max(px, W - px), Math.max(py, H - py)) + BAND;
  const left = new Uint8Array(cols * rows).fill(1), t0 = performance.now();
  return new Promise((done) => {
    const frame = () => {
      const k = Math.min(1, Math.floor((performance.now() - t0) / OPEN_MS * STEPS) / STEPS), r = (1 - (1 - k) ** 2) * far;
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const n = j * cols + i;
        if (left[n] && Math.hypot(i * CELL + CELL / 2 - px, j * CELL + CELL / 2 - py) < r - BAND + BAND * (BAYER[(j & 3) * 4 + (i & 3)] + 0.5) / 16) {
          left[n] = 0; ctx.clearRect(i * CELL, j * CELL, CELL, CELL);
        }
      }
      if (k < 1) requestAnimationFrame(frame); else { c.remove(); done(); }
    };
    requestAnimationFrame(frame);
  });
}

// A district's page, in from the city: once the city's picture and the page's own (art) are ready, the city's frame where
// the push-in left it, the old page's held snapshot let go, and the iris. place() says, then, where it opens from and what
// settles ({ at, settle }), and starts anything that moves with it. Nothing comes in a page whose pre-paint gave up.
export function arrive(art, place) {
  const z = window.pushIn, root = document.documentElement;
  if (!z) return;
  const city = Object.assign(new Image(), { src: z.src });
  const show = () => {
    root.classList.add('iris-open');
    if (z.revealed) z.vt?.skipTransition();
    else addEventListener('pagereveal', (e) => e.viewTransition?.skipTransition(), { once: true });
  };
  const done = () => root.classList.remove('iris', 'iris-open');
  Promise.all([city.decode(), art.decode()]).then(() => {
    if (!root.classList.contains('iris')) return;
    const { at, settle } = place();
    const c = cover((ctx) => ctx.drawImage(city, z.x, z.y, z.w, z.h));
    show();
    iris(c, at, settle).then(done);
  }, () => { show(); done(); });
}
