// The city's life (city.js): walkers, cars, windows going dark, glints on the bay, the mast's and the crane's lights and
// flocks of birds, drawn on a canvas at the art's own pixels laid over the picture, so they stay crisp pixel art.
// Where they go is city-fx.json and what hides them is city-depth.png, both written by web3d/pixel/gen_city.py.
const root = document.documentElement;
const rnd = (a, b) => a + Math.random() * (b - a);
const TOL = 5;   // out of 255: how much nearer than a mover's feet a pixel may be and still not hide it

export function cityFx(canvas, img) {
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  if (still.matches || new URLSearchParams(location.search).get('fx') === 'off') return;   // ?fx=off keeps the visual captures still
  const art = (name) => `${img.dataset.base}-${name}?v=${img.dataset.version}`;
  Promise.all([
    fetch(art('fx.json')).then((r) => r.json()),
    // Raw values, untouched by colour management: they are depths, not colours.
    fetch(art('depth.png')).then((r) => r.blob()).then((b) => createImageBitmap(b, { colorSpaceConversion: 'none' })),
  ]).then(([fx, depth]) => run(canvas, fx, depth, still)).catch(() => {});   // without its data the city is just still
}

function run(canvas, fx, bitmap, still) {
  const W = canvas.width, H = canvas.height, ctx = canvas.getContext('2d');
  const time = root.dataset.time, night = time === 'night', lamps = night || time === 'dusk';
  const pad = new OffscreenCanvas(W, H).getContext('2d');
  pad.drawImage(bitmap, 0, 0);
  const rgba = pad.getImageData(0, 0, W, H).data, DEPTH = new Uint8Array(W * H);
  for (let i = 0; i < DEPTH.length; i++) DEPTH[i] = rgba[i * 4];

  // A mover's pixel is drawn only where nothing in the painting is nearer than the ground under its feet (brighter =
  // nearer), so trees, lamp posts and walls in front of it hide it.
  const dfill = (x, y, w, h, foot) => {
    if (w < 0) { x += w; w = -w; }
    for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy++) {
      for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx++) if (DEPTH[yy * W + xx] <= foot + TOL) ctx.fillRect(xx, yy, 1, 1);
    }
  };
  // The ground a mover stands on: the farthest depth within 8 px of its feet. Right under a tree the pixel at its feet
  // is the tree, and taking that would put it level with the tree instead of behind it.
  const footAt = (x, y) => {
    let m = 255;
    y = Math.min(H - 1, Math.max(0, y));
    for (let xx = Math.max(0, x - 8); xx <= Math.min(W - 1, x + 8); xx++) m = Math.min(m, DEPTH[y * W + xx]);
    return m;
  };

  // Windows: at night each lit one switches off and on, slowly, in its own wall's colour.
  const now0 = performance.now();
  const windows = night ? fx.windows.map((w) => ({ px: w.px, wall: `rgb(${w.wall})`, off: Math.random() < 0.15, next: now0 + rnd(1500, 30000) })) : [];
  const drawWindows = (now) => {
    for (const c of windows) {
      if (now > c.next) { c.off = !c.off; c.next = now + (c.off ? rnd(5000, 25000) : rnd(10000, 50000)); }
      if (c.off) { ctx.fillStyle = c.wall; for (const [x, y] of c.px) ctx.fillRect(x, y, 1, 1); }
    }
  };

  // The bay: short glints that flash and fade, warm in the light and cool at night.
  const water = fx.sea.flatMap(([y, x0, x1]) => Array.from({ length: x1 - x0 + 1 }, (_, i) => [x0 + i, y]));
  let glints = [];
  const drawSea = (now) => {
    while (glints.length < 70) { const [x, y] = water[Math.random() * water.length | 0]; glints.push({ x, y, t0: now, life: rnd(500, 1600) }); }
    glints = glints.filter((g) => now - g.t0 < g.life);
    for (const g of glints) {
      const a = Math.sin(Math.PI * (now - g.t0) / g.life);
      ctx.fillStyle = night ? `rgba(170,200,235,${a * 0.8})` : `rgba(255,236,190,${a})`;
      ctx.fillRect(g.x, g.y, g.y > 250 ? 2 : 1, 1);   // nearer water, wider glints
    }
  };

  // Walkers: pacing the street and the avenue, or strolling the plaza with pauses. Fewer, and dark, at night.
  const SHIRTS = ['#c0392b', '#2e86c1', '#f1c40f', '#ecf0f1', '#27ae60', '#8e44ad', '#e67e22', '#34495e'];
  const inBox = (b) => [rnd(b[0], b[2]), rnd(b[1], b[3])];
  const people = Array.from({ length: 24 }, (_, i) => {
    const shirt = SHIRTS[i % SHIRTS.length], step = Math.random() * 10;
    if (i % 3 === 0) { const box = fx.plazas[i % fx.plazas.length], [x, y] = inBox(box); return { box, x, y, to: inBox(box), shirt, step, pause: 0 }; }
    const avenue = i % 5 === 1, seg = fx.walks[avenue ? 1 : 0];
    return { seg, t: Math.random(), v: rnd(0.006, 0.014) * (Math.random() < 0.5 ? 1 : -1) * (avenue ? 4 : 1), shirt, step };
  }).filter((_, i) => !night || i % 2);
  const drawPeople = (now, dt) => {
    for (const w of people) {
      let x, y;
      if (w.seg) {
        w.t += w.v * dt / 1000;
        if (w.t > 1 || w.t < 0) { w.v = -w.v; w.t = Math.min(1, Math.max(0, w.t)); }   // the end of the open stretch: turn back
        x = Math.round(w.seg[0] + (w.seg[2] - w.seg[0]) * w.t); y = Math.round(w.seg[1] + (w.seg[3] - w.seg[1]) * w.t);
      } else {
        const dx = w.to[0] - w.x, dy = w.to[1] - w.y, d = Math.hypot(dx, dy);
        if (w.pause > now) { /* standing a moment */ } else if (d < 0.5) { w.to = inBox(w.box); w.pause = now + rnd(500, 3000); }
        else { const s = Math.min(d, 6 * dt / 1000); w.x += dx / d * s; w.y += dy / d * s; }
        x = Math.round(w.x); y = Math.round(w.y);
      }
      const stride = w.pause > now ? 0 : ((now / 220 + w.step) | 0) % 2, f = footAt(x, y);
      ctx.fillStyle = night ? 'rgba(40,34,40,.95)' : '#5a3a28'; dfill(x + stride, y, 1, 1, f); dfill(x + 1 - stride, y, 1, 1, f);   // legs
      ctx.fillStyle = night ? 'rgba(70,60,70,.95)' : w.shirt; dfill(x, y - 2, 2, 2, f);                                              // shirt
      ctx.fillStyle = night ? 'rgba(120,100,90,.95)' : '#f0c8a0'; dfill(x, y - 3, 1, 1, f);                                         // head
    }
  };

  // Cars: the main street's lanes and the ring road's curve, fading in and out where the road leaves the open stretch.
  const lanes = fx.lanes.map((pts) => {
    const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]));
    return { pts, lens, total: lens.reduce((a, b) => a + b) };
  });
  const along = ({ pts, lens, total }, t) => {   // a point t of the way along the lane, and which way it heads
    let d = t * total, i = 0;
    while (i < lens.length - 1 && d > lens[i]) d -= lens[i++];
    const f = d / lens[i], a = pts[i], b = pts[i + 1];
    return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.sign(b[0] - a[0]) || 1];
  };
  const cars = Array.from({ length: 8 }, (_, i) => ({ lane: lanes[i % 3], t: Math.random(), v: rnd(0.025, 0.04) * (i % 3 === 2 ? 2.5 : 1),
    body: ['60,70,90', '150,40,30', '200,190,170', '40,90,60'][i % 4] }));
  const drawCars = (dt) => {
    for (const c of cars) {
      c.t = (c.t + c.v * dt / 1000) % 1;
      const [x, y, dir] = along(c.lane, c.t), f = footAt(x, y + 1), a = Math.min(1, Math.min(c.t, 1 - c.t) * 10);
      if (!night) { ctx.fillStyle = `rgba(${c.body},${a})`; dfill(x - 2, y - 1, 4, 2, f); }
      if (lamps) {   // headlights, their soft beam ahead and a red tail light
        ctx.fillStyle = `rgba(255,240,190,${a})`; dfill(x, y, 2, 1, f);
        ctx.fillStyle = `rgba(255,230,160,${a * 0.25})`; dfill(x + dir * 2, y - 1, dir * 5, 3, f);
        ctx.fillStyle = `rgba(230,40,30,${a})`; dfill(x - dir * 4, y, 1, 1, f);
      } else { ctx.fillStyle = `rgba(255,236,190,${a})`; dfill(x + dir * 2, y, 1, 1, f); }
    }
  };

  // Lights: the radio mast's red beacon pulses with a soft halo; the crane's tips blink.
  const drawLights = (now) => {
    const p = (Math.sin(now / 600) + 1) / 2, [bx, by] = fx.lights.beacon;
    ctx.fillStyle = `rgba(255,40,30,${0.35 + 0.65 * p})`; ctx.fillRect(bx, by, 2, 2);
    ctx.fillStyle = `rgba(255,60,40,${0.25 * p})`; ctx.fillRect(bx - 2, by - 2, 6, 6);
    if ((now / 1200 | 0) % 2) { ctx.fillStyle = '#ff5a3c'; for (const [x, y] of fx.lights.blinks) ctx.fillRect(x, y, 1, 1); }
  };

  // Birds: up to two loose flocks far off over the hills, each bird a faint 3-px "v" flapping to a flat line and back
  // with its own wingbeat, 10-18 px behind the one before it.
  let flocks = [], nextFlock = now0 + 1500;
  const newFlock = () => {
    let back = 10;
    const birds = Array.from({ length: 5 + (Math.random() * 7 | 0) }, () => ({ dx: (back -= rnd(10, 18)), dy: rnd(-7, 7), ph: rnd(0, 6.3), beat: rnd(220, 320) }));
    return { x: -30, y: rnd(12, 52), v: rnd(9, 15), birds, tail: back };
  };
  const drawBirds = (now, dt) => {
    if (flocks.length < 2 && now > nextFlock) { flocks.push(newFlock()); nextFlock = now + rnd(4000, 9000); }
    ctx.fillStyle = night ? 'rgba(20,22,34,.35)' : 'rgba(70,50,55,.5)';
    for (const f of flocks) {
      f.x += f.v * dt / 1000;
      for (const b of f.birds) {
        const x = Math.round(f.x + b.dx), y = Math.round(f.y + b.dy + Math.sin(now / 1600 + b.ph) * 2), up = ((now / b.beat + b.ph) | 0) % 2;
        ctx.fillRect(x, y, 1, 1); ctx.fillRect(x - 1, y - up, 1, 1); ctx.fillRect(x + 1, y - up, 1, 1);
      }
    }
    flocks = flocks.filter((f) => f.x + f.tail < W + 20);   // gone once the last bird is past the edge
  };

  // Drawn only while it can be seen: the tab shown, the city on screen and not yet left for the tower, and motion welcome.
  let raf = 0, last = 0, seen = true;
  const live = () => !document.hidden && seen && root.classList.contains('at-city') && !still.matches;
  const frame = (now) => {
    raf = 0;
    if (!live()) { if (still.matches) ctx.clearRect(0, 0, W, H); return; }
    const dt = Math.min(100, now - last);
    last = now;
    ctx.clearRect(0, 0, W, H);
    drawWindows(now); drawSea(now); drawPeople(now, dt); drawCars(dt); drawLights(now); drawBirds(now, dt);
    raf = requestAnimationFrame(frame);
  };
  const wake = () => { if (!raf && live()) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', wake);
  still.addEventListener('change', () => { if (still.matches) ctx.clearRect(0, 0, W, H); else wake(); });
  new IntersectionObserver(([e]) => { seen = e.isIntersecting; wake(); }).observe(canvas);
  wake();
}
