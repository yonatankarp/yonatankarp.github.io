// The city's life (city.js): walkers, cars, windows going dark, glints on the bay, the mast's and the crane's lights and
// flocks of birds, over the picture (scene-fx.js), and in winter falling snow. Where they go is city-fx.json (in winter
// city-winter-fx.json, its bay found in the winter art), the night's windows are city[-winter]-windows.json, fetched only
// at night, and what hides them is city-depth.png, all written by web3d/pixel/gen_city.py. The holidays' props on the plaza (props.js) stand among the walkers, and stay when nothing moves;
// the new year's fireworks go up over its middle, behind the tower and the crane. On Halloween's dusk and night a few ghosts drift over the streets and roofs
// (ghosts.json: each one's path and the depth it hides from) and the birds are bats, both painted frames from
// web3d/pixel/gen_props.py; neither is in a still frame.
import { OUTSIDE } from './outside.js';
import { dressing, fireworksFps, props } from './props.js';
import { animate, asset, people, rnd, snowfall } from './scene-fx.js';
import PHASES from '../../data/phases.json';   // which hours the lamps are lit at

const root = document.documentElement;

export function cityFx(canvas, img) {
  const art = (name) => `${img.dataset.base}-${name}?v=${img.dataset.version}`, winter = root.dataset.season === 'winter';
  const season = winter ? 'winter-' : '';
  const dir = new URL('.', new URL(img.dataset.base, location.href)).pathname;   // the art's folder: props.webp sits beside the city
  const sheet = (name) => (ext) => `${dir}${name}.${ext}?v=${img.dataset.version}`, options = { ...OUTSIDE, time: root.dataset.time, lit: PHASES[root.dataset.time].lit };
  const plaza = props(sheet, options), show = dressing(options);
  const spooks = Promise.all([show.ghosts && people(sheet('ghosts'), false), show.bats && people(sheet('bats'), show.night)]);
  const poster = (ctx) => plaza.then((items) => { ctx.clearRect(0, 0, canvas.width, canvas.height); for (const p of items) p.draw(ctx, null); });
  // Not once the tower is entered, which hides the city for good.
  animate(canvas, { data: art(`${season}fx.json`), depth: art('depth.png'), live: () => root.classList.contains('at-city'), poster },
    (ctx, fx, { dfill, footAt, sprite }) => setup(ctx, fx, dfill, footAt, sprite, plaza, spooks, show, art(`${season}windows.json`), winter));
}

function setup(ctx, fx, dfill, footAt, sprite, plaza, spooks, show, windowsUrl, winter) {
  const W = ctx.canvas.width, night = root.dataset.time === 'night', lamps = show.lit;
  const snow = winter && snowfall(ctx, night);
  let plazaItems = [];
  plaza.then((items) => { plazaItems = items; });
  // Halloween's ghosts, half see-through, each drifting to and fro along its path (x0, x1, its bottom row y, the depth f
  // it hides behind nearer things from) at 2-5 px a second, bobbing, its body swaying through its frames; and its bats.
  let ghosts = [], bats = null;
  spooks.then(([G, B]) => {
    bats = B || null;
    if (G) ghosts = G.paths.map(([x0, x1, y, f], j) => ({ G, row: j % G.people.length, x0, x1, y, f, x: rnd(x0, x1), v: rnd(2, 5) * (Math.random() < 0.5 ? 1 : -1), ph: rnd(0, 6.3) }));
  });

  // Windows: at night each lit one switches off and on, slowly, in its own wall's colour, its whole pane at once. They are
  // drawn first, on a layer made again only when one switches.
  // Fetched only at night: a missing file leaves every window lit; a broken one fails as a page error (#297).
  const now0 = performance.now(), lit = night ? asset(windowsUrl).then((r) => (r ? r.json() : [])) : Promise.resolve([]);
  let windows = [], stale = true;
  lit.then((list) => { windows = list.map((w) => ({ px: w.px, wall: `rgb(${w.wall})`, off: Math.random() < 0.15, next: now0 + rnd(1500, 30000) })); stale = true; });
  const layer = night && new OffscreenCanvas(W, ctx.canvas.height).getContext('2d');
  const drawWindows = (now) => {
    if (!layer) return;
    for (const c of windows) if (now > c.next) { c.off = !c.off; c.next = now + (c.off ? rnd(5000, 25000) : rnd(10000, 50000)); stale = true; }
    if (stale) {
      layer.clearRect(0, 0, W, layer.canvas.height);
      for (const c of windows) if (c.off) { layer.fillStyle = c.wall; for (const [x, y] of c.px) layer.fillRect(x, y, 1, 1); }
      stale = false;
    }
    ctx.drawImage(layer.canvas, 0, 0);
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
  // A walk is a run of points, x0, y0, x1, y1, ..., so it can follow a kerb that bends.
  const walks = fx.walks.map((s) => {
    const lens = [];
    for (let i = 2; i < s.length; i += 2) lens.push(Math.hypot(s[i] - s[i - 2], s[i + 1] - s[i - 1]));
    return { s, lens, total: lens.reduce((a, b) => a + b) };
  });
  const walkAt = ({ s, lens, total }, t) => {   // the point t of the way along a walk
    let d = t * total, i = 0;
    while (i < lens.length - 1 && d > lens[i]) d -= lens[i++];
    const f = d / lens[i], [x0, y0, x1, y1] = s.slice(2 * i, 2 * i + 4);
    return [Math.round(x0 + (x1 - x0) * f), Math.round(y0 + (y1 - y0) * f)];
  };
  const people = Array.from({ length: 24 }, (_, i) => {
    const shirt = SHIRTS[i % SHIRTS.length], step = Math.random() * 10;
    if (i % 3 === 0) { const box = fx.plazas[i % fx.plazas.length], [x, y] = inBox(box); return { box, x, y, to: inBox(box), shirt, step, pause: 0 }; }
    const avenue = i % 5 === 1, seg = walks[avenue ? 1 : 0];
    return { seg, t: Math.random(), v: rnd(0.006, 0.014) * (Math.random() < 0.5 ? 1 : -1) * (avenue ? 4 : 1), shirt, step };
  }).filter((_, i) => !night || i % 2);
  // Drawn by their feet's row among the plaza's props, farther first, so nobody walks through one.
  const drawPeople = (now, dt) => {
    const order = plazaItems.map((p) => [p.y, () => p.draw(ctx, now / 1000)]);
    for (const g of ghosts) {
      g.x += g.v * dt / 1000;
      if (g.x > g.x1 || g.x < g.x0) { g.v = -g.v; g.x = Math.min(g.x1, Math.max(g.x0, g.x)); }
      const y = g.y + Math.round(Math.sin(now / 1500 + g.ph) * 1.5), row = g.G.frames[g.row], k = ((now / 450 + g.ph * 3) | 0) % row.length;
      order.push([g.y, () => { ctx.globalAlpha = 0.5; sprite(g.G, row[k], g.x, y, g.v < 0, g.f); ctx.globalAlpha = 1; }]);
    }
    for (const w of people) {
      let x, y;
      if (w.seg) {
        w.t += w.v * dt / 1000;
        if (w.t > 1 || w.t < 0) { w.v = -w.v; w.t = Math.min(1, Math.max(0, w.t)); }   // the end of the open stretch: turn back
        [x, y] = walkAt(w.seg, w.t);
      } else {
        const dx = w.to[0] - w.x, dy = w.to[1] - w.y, d = Math.hypot(dx, dy);
        if (w.pause > now) { /* standing a moment */ } else if (d < 0.5) { w.to = inBox(w.box); w.pause = now + rnd(500, 3000); }
        else { const s = Math.min(d, 6 * dt / 1000); w.x += dx / d * s; w.y += dy / d * s; }
        x = Math.round(w.x); y = Math.round(w.y);
      }
      const stride = w.pause > now ? 0 : ((now / 220 + w.step) | 0) % 2, f = footAt(x, y);
      order.push([y, () => {
        ctx.fillStyle = night ? 'rgba(40,34,40,.95)' : '#5a3a28'; dfill(x + stride, y, 1, 1, f); dfill(x + 1 - stride, y, 1, 1, f);   // legs
        ctx.fillStyle = night ? 'rgba(70,60,70,.95)' : w.shirt; dfill(x, y - 2, 2, 2, f);                                              // shirt
        ctx.fillStyle = night ? 'rgba(120,100,90,.95)' : '#f0c8a0'; dfill(x, y - 3, 1, 1, f);                                         // head
      }]);
    }
    order.sort((a, b) => a[0] - b[0]);
    for (const [, draw] of order) draw();
  };

  // Cars: each lane runs, one way, from where its road comes out from behind something (or in off the art) to where it
  // goes behind something again, fading in and out over its last 8 px. A car per 200 px of lane, all at one speed, slower
  // up the picture (`far`), where things are smaller: routes share stretches of road, and one car must not pass through
  // another there.
  // A lane point's ground is footAt there (its ends, hidden by design, take the next point's). Between points it goes
  // linearly from one to the next, and caps footAt, which alone would see only the greenhouses where they stand over
  // the whole road, and put the car on top of them.
  const lanes = fx.lanes.map((pts) => {
    const lens = pts.slice(1).map((p, i) => Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1])), feet = pts.map(([x, y]) => footAt(x, y + 1));
    feet[0] = feet[1]; feet[feet.length - 1] = feet[feet.length - 2];
    return { pts, lens, feet, total: lens.reduce((a, b) => a + b) };
  });
  const along = ({ pts, lens, feet }, d) => {   // the point d px along the lane, which way it heads, and the ground there
    let i = 0;
    while (i < lens.length - 1 && d > lens[i]) d -= lens[i++];
    const f = d / lens[i], a = pts[i], b = pts[i + 1];
    return [Math.round(a[0] + (b[0] - a[0]) * f), Math.round(a[1] + (b[1] - a[1]) * f), Math.sign(b[0] - a[0]) || 1, feet[i] + (feet[i + 1] - feet[i]) * f];
  };
  const far = (y) => Math.min(1, Math.max(0.35, (y - 120) / 180));
  const v = rnd(13, 21), cars = lanes.flatMap((lane, l) => {
    const n = Math.max(1, Math.round(lane.total / 200));
    return Array.from({ length: n }, (_, i) => ({ lane, v, k: 1, d: (i + Math.random() * 0.6) / n * lane.total,
      body: ['60,70,90', '150,40,30', '200,190,170', '40,90,60'][(l + i) % 4] }));
  });
  const drawCars = (dt) => {
    for (const c of cars) {
      c.d = (c.d + c.v * c.k * dt / 1000) % c.lane.total;
      const [x, y, dir, ground] = along(c.lane, c.d), f = Math.min(footAt(x, y + 1), ground + 2);
      const a = Math.min(1, c.d / 8, (c.lane.total - c.d) / 8);
      c.k = far(y);
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
        const x = Math.round(f.x + b.dx), y = Math.round(f.y + b.dy + Math.sin(now / 1600 + b.ph) * 2);
        if (bats) { sprite(bats, bats.frames[0][((2.5 * now / b.beat + b.ph) | 0) % bats.frames[0].length], x, y, false, 255); continue; }   // a bat beats its wings faster; nothing hides the sky
        const up = ((now / b.beat + b.ph) | 0) % 2;
        ctx.fillRect(x, y, 1, 1); ctx.fillRect(x - 1, y - up, 1, 1); ctx.fillRect(x + 1, y - up, 1, 1);
      }
    }
    flocks = flocks.filter((f) => f.x + f.tail < W + 20);   // gone once the last bird is past the edge
  };

  // The fastest mover, in art pixels a second, sets how often a frame is drawn (scene-fx.js): the snow, a bird (up to 15),
  // a car or a walker; on the new year's night, a burst's rising spark and its quickest frame (props.js). A ghost (5 at most) and a
  // bat's wingbeat (a frame every 88 ms or more) stay under the birds' 15.
  const fps = Math.max(snow ? snow.fps : 0, 15, show.fireworks ? fireworksFps : 0, ...cars.map((c) => c.v), ...people.filter((w) => w.seg).map((w) => Math.abs(w.v) * w.seg.total));
  return Object.assign((now, dt) => { drawWindows(now); drawSea(now); drawPeople(now, dt); drawCars(dt); drawLights(now); drawBirds(now, dt); if (snow) snow(now, dt); }, { fps, ready: Promise.all([plaza, lit, spooks]) });
}
