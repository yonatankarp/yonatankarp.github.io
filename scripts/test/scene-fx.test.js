// The scenes' drawing helpers (web3d/src/scene-fx.js) against the pixel-at-a-time drawing they replace.
const test = require('node:test');
const assert = require('node:assert/strict');

// The top bar's Pause, as far as scene-fx.js touches the page: set before the module first loads, as it reads the stored one then.
const listeners = {}, stored = { 'building-paused': 'true' }, label = { textContent: '' };
const button = {
  hidden: true, dataset: {}, attrs: {},
  addEventListener: (type, fn) => { listeners[`button ${type}`] = fn; },
  setAttribute(k, v) { this.attrs[k] = v; }, getAttribute(k) { return this.attrs[k]; },
  querySelector: () => label,
};
globalThis.document = { querySelector: (sel) => (sel === '[data-building-pause]' ? button : null) };
globalThis.addEventListener = (type, fn) => { listeners[type] = fn; };
Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: (k) => stored[k] ?? null, setItem: (k, v) => { stored[k] = String(v); } } });

const load = () => import('../../web3d/src/scene-fx.js');

function seeded(seed) {
  return () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
}

test('spans cover exactly the box pixels no nearer than the limit, once each', async () => {
  const { spans } = await load();
  const random = seeded(7), W = 23, H = 17;
  for (let n = 0; n < 300; n++) {
    const depth = Uint8Array.from({ length: W * H }, () => (random() < 0.3 ? 200 : 0));
    const x = Math.floor(random() * 40) - 10, y = Math.floor(random() * 30) - 8, w = Math.floor(random() * 30) - 8, h = Math.floor(random() * 12), lim = 5;
    const want = new Set(), got = [];
    const [bx, bw] = w < 0 ? [x + w, -w] : [x, w];
    for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) {
      for (let xx = Math.max(0, bx); xx < Math.min(W, bx + bw); xx++) if (depth[yy * W + xx] <= lim) want.add(`${xx},${yy}`);
    }
    spans(depth, W, H, x, y, w, h, lim, (a, yy, len) => { for (let i = 0; i < len; i++) got.push(`${a + i},${yy}`); });
    assert.equal(got.length, new Set(got).size, 'no pixel twice');
    assert.deepEqual(new Set(got), want);
  }
});

test('hidden clears just the sprite pixels something nearer stands on, and is null when nothing does', async () => {
  const { hidden } = await load();
  const random = seeded(11), W = 30, H = 20, w = 6, h = 5;
  const px = Uint8ClampedArray.from({ length: w * h * 4 }, (_, i) => (i % 4 === 3 ? 255 : i % 251));
  assert.equal(hidden(px, w, h, 3, 3, new Uint8Array(W * H), W, H, 5), null);
  for (let n = 0; n < 200; n++) {
    const depth = Uint8Array.from({ length: W * H }, () => (random() < 0.1 ? 90 : 3));
    const x0 = Math.floor(random() * 40) - 8, y0 = Math.floor(random() * 28) - 6;
    const out = hidden(px, w, h, x0, y0, depth, W, H, 5);
    let near = false;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const X = x0 + x, Y = y0 + y, hid = X >= 0 && X < W && Y >= 0 && Y < H && depth[Y * W + X] > 5, i = (y * w + x) * 4;
        near ||= hid;
        if (out) assert.deepEqual([...out.subarray(i, i + 4)], [px[i], px[i + 1], px[i + 2], hid ? 0 : 255]);
      }
    }
    assert.equal(out !== null, near);
  }
});

test('mirror flips each row and undoes itself', async () => {
  const { mirror } = await load();
  const px = Uint8ClampedArray.from({ length: 3 * 2 * 4 }, (_, i) => i);
  const m = mirror(px, 3);
  assert.deepEqual([...m.subarray(0, 4)], [8, 9, 10, 11]);
  assert.deepEqual([...m.subarray(12, 16)], [20, 21, 22, 23]);
  assert.deepEqual(mirror(m, 3), px);
});

test('every draws as often as the scene needs, evenly, through a jittery frame interval', async () => {
  const { every } = await load();
  for (const [fps, hz, k] of [[60, 60, 1], [60, 120, 2], [22, 60, 2], [23, 120, 5], [60, 40, 0], [22, 40, 1]]) {
    for (const j of [0.98, 1, 1.02]) assert.equal(Math.max(1, every(fps, 1000 / hz * j)), Math.max(1, k), `${fps} fps at ${hz} Hz x${j}`);
  }
});

test('one Pause: the live holder has the press and the label, every holder wakes, it is kept, and Back reads it again', async () => {
  const fx = await load();
  assert.equal(fx.paused, true, 'the stored one');
  let cityLive = true;
  const woke = [];
  fx.holdPause({ live: () => cityLive, hidden: () => false, wake: () => woke.push('city') });
  assert.deepEqual([button.hidden, button.dataset.paused, label.textContent], [false, true, 'Play']);
  listeners['button click']();
  assert.deepEqual([fx.paused, stored['building-paused'], label.textContent, woke.join()], [false, 'false', 'Pause', 'city']);
  cityLive = false;   // the tower entered, not yet mounted: a press holds nothing
  listeners['button click']();
  assert.equal(fx.paused, false);
  const relabel = fx.holdPause({ hidden: () => true, wake: () => woke.push('tower') });
  listeners['button click']();
  assert.deepEqual([fx.paused, stored['building-paused'], button.hidden, label.textContent, woke.join()], [true, 'true', true, 'Play', 'city,city,tower']);
  stored['building-paused'] = 'false';
  listeners.pageshow({ persisted: true });
  assert.deepEqual([fx.paused, label.textContent], [false, 'Pause']);
  assert.equal(typeof relabel, 'function');
});
