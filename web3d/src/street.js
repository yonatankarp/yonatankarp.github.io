// The street view, pixel.js's stop E: the whole building at this hour (web3d/pixel/gen_exterior.py), its windows live
// crops of the rooms, 1-7 dimmed behind each floor's company sign, and the camera's moves from it: the fly-in at a
// window, the crane to the roof and the opening shot down from the sky.
// Its windows are buttons laid over the canvas; the street left and right of the picture repeats its neighbours.
import { ART, SIZE, FW, FH, ORDER, BAYER, LOOK, TIME, HOUR, SHADES, narrow, easeInOut, clamp01, colourAt, shade } from './art.js';
import { decor } from './decor.js';
import { OUTSIDE } from './outside.js';

export function streetView(sky, base, box, stops, loaded, then, has) {
  const view = { img: null, size: SIZE, windows: {}, top: sky, bottom: '#2a2226', at: null };
  const dressing = decor();   // the season, the holidays and the weather, over the picture
  OUTSIDE.changed(loaded);    // the weather has come: draw it
  const img = new Image();
  img.onload = () => {
    then();
    Object.assign(view, { img, top: colourAt(img, 0, 0), bottom: colourAt(img, 0, view.size[1] - 1) });
    loaded();
  };
  img.onerror = then;
  img.src = `${base}pixel/exterior${HOUR}.webp`;
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
  const CRANE = ART.crane;   // the crane over the roof, which phones leave out for the top bar: first column, width, and the cornice's row under it
  // The planes a flight parts the picture into, cut from its rest frame by what gen_exterior knows of it: its
  // NEIGHBOURS (x0, x1, roof) and GROUND. The tower's cornice overhangs its brick (x 170-310) by 3 px a side.
  const { neighbours: NEIGHBOURS, brick: BRICK, ground: ROAD } = ART, SHAFT = [BRICK[0] - 3, BRICK[1] + 3];
  const FLY_PAST = 0.85;   // how far into the flight the window's frame has left the screen
  const CRANE_PEAK = 0.4;                  // how far into the crane shot the brick fills the screen
  const CRANE_OUT = 1.15;                  // and where its climb would end: past 1, since its last stretch is too slow to see, with the cornice gone
  const STOREY = ART.storey, SKY_COLS = 8;   // a storey's height; the first 4 columns of the sky with no star in them, at any hour
  const JIB = [[200, 9, 316, 22], [238, 9, 244, 38], [283, 9, 288, CRANE[2]]];   // the crane against the sky: jib, hook, mast down to the cornice (the clouds keep clear of them)
  // The rows below are the street's, which slides down by RISE when a taller tower grows the picture at its top
  // (gen_exterior.RISE): the first block's roof (LOW), and the one cloud the tower cuts at rest (CUT, its rows).
  const RISE = ART.rise ?? 0, LOW = RISE + 200, CUT = RISE + 110;
  let plated = null;
  function plate() {   // the rest frame without its sky, so the planes slide over the far street
    if (plated) return plated;
    const [EW, EH] = view.size, c = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    c.canvas.width = EW; c.canvas.height = EH;
    c.drawImage(view.img, 0, 0);
    const d = c.getImageData(0, 0, EW, EH), px = d.data;
    // The sky repeats every 4 columns, and the picture's first columns are clear down to the first block's roof (LOW).
    const sky = (x, y) => y < LOW && [0, 1, 2].every((i) => px[(y * EW + x) * 4 + i] === px[(y * EW + x % 4) * 4 + i]);
    for (let x = 0; x < EW; x++) {
      const roof = Math.min(...NEIGHBOURS.filter(([a, b]) => x >= a - 2 && x < b + 2).map((n) => n[2])) - 1;   // their cornices overhang too
      const tower = x >= SHAFT[0] && x < SHAFT[1], brick = x >= BRICK[0] && x < BRICK[1];
      for (let y = 0; y < ROAD; y++) {
        const gone = !tower ? y < roof
          : y < CRANE[2] ? sky(x, y) || !JIB.some(([a, b, c, e]) => x >= a && x < c && y >= b && y < e)
            : !brick && (y >= LOW || sky(x, y) || (x < BRICK[0] - 1 && y >= CUT && y < CUT + 5) || (x === SHAFT[0] && y >= CUT && y < CUT + 10));   // the sky, or the cloud cut by the tower's edge (the ledge starts under it)
        if (gone) px[(y * EW + x) * 4 + 3] = 0;
      }
    }
    c.putImageData(d, 0, 0);
    return (plated = c.canvas);
  }
  let cleared = null;
  function clearSky() {   // the rest frame's sky alone, for when what stands in it is further down: painted out from the sky's clear columns, and its lowest row running on below
    if (cleared) return cleared;
    const [EW, EH] = view.size, over = plate().getContext('2d').getImageData(0, 0, EW, EH).data, c = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
    c.canvas.width = EW; c.canvas.height = EH;
    c.drawImage(view.img, 0, 0);
    const d = c.getImageData(0, 0, EW, EH), px = new Uint32Array(d.data.buffer), fr = new ImageData(EW, EH), edge = new Uint32Array(fr.data.buffer);
    const clear = (x, y) => px[Math.min(y, LOW - 10) * EW + SKY_COLS + x % 4];   // above the first roof's cornice
    for (let y = 0; y < EH; y++) for (let x = 0; x < EW; x++) {
      const i = y * EW + x;
      if (y >= LOW || over[i * 4 + 3]) px[i] = clear(x, y);
      // What the plates leave of the tower beside its shaft travels with it: the jib's tail, the cornice's end and the glow round it.
      else if (((x >= SHAFT[0] - 4 && x < SHAFT[0]) || (x >= SHAFT[1] && x < SHAFT[1] + 4)) && y >= CRANE[2] - 3 && y < CRANE[2] + 19 || (x >= SHAFT[1] && x < JIB[0][2] && y < JIB[0][3])) {
        if (px[i] !== clear(x, y)) edge[i] = px[i];
        px[i] = clear(x, y);
      }
    }
    // The one cloud the tower cuts at rest (gen_exterior.STREET_CLOUDS): its hidden half, mirrored, or its cut edge would show.
    for (let y = CUT; y < CUT + 10; y++) for (let x = SHAFT[0]; x < 181; x++) if (px[y * EW + 320 - x] !== clear(320 - x, y)) px[y * EW + x] = px[y * EW + 320 - x];
    c.putImageData(d, 0, 0);
    const e = document.createElement('canvas').getContext('2d');
    e.canvas.width = EW; e.canvas.height = EH;
    e.putImageData(fr, 0, 0);
    return (cleared = { canvas: c.canvas, fringe: e.canvas });
  }
  const darks = new Map();
  function dark(lv) {   // the planes with their lights off, lv of 16 Bayer cells of it left
    if (darks.has(lv)) return darks.get(lv);
    const c = document.createElement('canvas').getContext('2d');
    c.canvas.width = view.size[0]; c.canvas.height = view.size[1];
    c.drawImage(plate(), 0, 0);
    c.globalCompositeOperation = 'source-in';
    c.drawImage(shade(view.img, lv), 0, 0);
    darks.set(lv, c.canvas);
    return c.canvas;
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
  let clear = 0, card = 0, across = 0.5, sized = '';   // CSS --street-top: the bottom of whatever sits over the top of the street; card: the phone's hero card top; CSS --street-x: where the phone's tower stands, as a share of the width; read per size
  if (heroCard) new ResizeObserver(() => { sized = ''; loaded(); }).observe(heroCard);   // a late font moves the card's top, so the street's foot
  function measure(ctx, w, h) { if (sized !== `${w},${h}`) { sized = `${w},${h}`; const css = getComputedStyle(ctx.canvas); clear = parseFloat(css.getPropertyValue('--street-top')) || 0; across = parseFloat(css.getPropertyValue('--street-x')) || 0.5; card = heroCard ? hero.clientHeight - parseFloat(getComputedStyle(hero).paddingBottom) - heroCard.offsetHeight : 0; } }
  function layout(w, h, dpr, wide) {   // in device pixels, sized by the CSS height; the building centred beside the card, the street under it
    const [EW, EH] = view.size, W = w / dpr, H = h / dpr, rects = Object.values(view.windows);
    if (!wide) {   // phones: only the tower, as big as whole device pixels allow between the top bar and the card, the cornice under the bar
      const floors = Object.entries(view.windows).filter(([k]) => k !== 'R').map(([, r]) => r);
      const top = Math.min(...floors.map((r) => r[1])) - PAD, bottom = Math.max(...floors.map((r) => r[3])) + PAD;
      const foot = card || H * 0.62, s = Math.max(Math.round(dpr), Math.floor(Math.min(w / TOWER, (foot - clear) * dpr / (bottom - top))));
      // The road's foot on the card, or, where that leaves no room, the cornice just under the bar, 2 art pixels of sky between them; the road gives way.
      return { s, x: Math.round(w * across - (EW / 2) * s), y: Math.round(Math.max(clear * dpr - (CRANE[2] - 2) * s, foot * dpr - EH * s)) };
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
    ready: () => !!view.img && Object.keys(view.windows).length > 0,
    prime() { clearSky(); SHADES.forEach((lv) => dark(lv)); dressing.layers(); },
    weather: (ctx, f, at, w, h, clip) => dressing.weather(ctx, f, at, w, h, clip),   // the roof's, from pixel.js
    // Flying in at a floor's window (t: 0 on the street, 1 in the room), the camera only ever going forward. Three
    // planes part: the far street barely moves, the neighbours slide by, and the tower rushes past until the window's
    // frame has gone off the screen's edges. Behind the glass the room, further away, is still settling into place.
    // Every scale is whole, so the pixels stay square. null without the window: the plain dissolve.
    fly(key, t, w, h, dpr, wide, room) {
      if (key === 'E') return this.descend(t, w, h, dpr, wide);
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
      // A steady rate of growth: a zoom at a constant ratio reads as constant speed. Not whole scales in flight: 2 to 3 is a 50%
      // jump. The art pixels differ by a device pixel for the moment they move; every plane lands on, and leaves, a whole scale.
      const z = base.s * (end / base.s) ** (push * push);
      const at = (s) => ({ s, x: Math.round(fx - mx * s), y: Math.round(fy - my * s) });
      const rs = base.s + (room.s - base.s) * e, front = at(z);
      return {
        key, front, near: at(base.s * (z / base.s) ** 0.3),
        far: { s: base.s, x: base.x + Math.round((fx - from[0]) * 0.12), y: base.y + Math.round((fy - from[1]) * 0.12) },
        room: { s: rs, x: Math.round(fx - lx * rs), y: Math.round(fy - ly * rs) },
        win: [front.x + x0 * z, front.y + y0 * z, ww * z, wh * z],
        dim: (TIME === 'day' ? 0.3 : 0.6) * easeInOut(Math.min(1, t * 2)),   // at noon a full dim reads as the lights going out
        // How much of the sign is still up, of 16. The lobby and the garage have none: their windows are plain slices
        // of the room, which would double it as the two scales part. A room still on its way keeps the sign up (#184).
        veil: /\d/.test(key) ? (has(key) ? Math.round(clamp01(1 - (t - 0.08) / 0.3) * 16) : 16) : 0,
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
      const push = easeInOut(clamp01(t / CRANE_PEAK)), z = base.s * (Z / base.s) ** push;
      const climb = easeInOut(clamp01(t / CRANE_OUT)), risen = climb * (tall + off / Z), fx = from + (w / 2 - from) * push ** 3;   // no pan till the tower has outgrown its far copy, which would show past its edge
      const at = (s) => ({ s, x: Math.round(fx - mid * s), y: Math.round(ground + (risen - ROAD) * s) });
      const front = at(z);
      return {
        key: 'R', front, near: at(base.s * (z / base.s) ** 0.3), over: t >= CRANE_PEAK,
        far: { s: base.s, x: base.x + Math.round((fx - from) * 0.12), y: base.y + Math.round(climb * h * 0.04) },
        room: { ...room, y: room.y - Math.round((1 - climb) * 12) * room.s },   // the deck settles under the camera, in whole art pixels
        dim: 0, veil: Math.round(clamp01(1 - (push - 0.1) / 0.5) * 16),   // outdoors: nothing dims
      };
    },
    // The opening shot (t: 0 up in the sky, 1 on the street): the camera comes down, so everything rises into the
    // frame, the nearer the faster. It starts with the sky's own picture just under the view's foot, only flat sky in
    // the frame, the very colour shown while the art is on its way. Whole device pixels; no scale, so no pixel changes size.
    descend(t, w, h, dpr, wide) {
      const base = layout(w, h, dpr, wide), high = (wide ? h : (card || (h / dpr) * 0.62) * dpr) - base.y, e = 1 - (1 - t) ** 3;
      const at = (k) => ({ ...base, y: base.y + Math.round((1 - e) * high * k) });
      return { key: 'E', t, far: at(1), near: at(1.25), front: at(1.5) };
    },
    flight(ctx, f, w, h, dpr, wide, fly, room) {   // room: the frame's tower(s, x, y)
      const [EW, EH] = view.size, [L, R] = SIDE, plates = plate();
      const blit = (src, sx, sy, sw, sh, c) => {   // only what is on screen: late in the flight a picture is far bigger than the canvas
        const a = Math.max(sx, Math.floor(-c.x / c.s)), b = Math.max(sy, Math.floor(-c.y / c.s));
        const r = Math.min(sx + sw, Math.ceil((w - c.x) / c.s)), d = Math.min(sy + sh, Math.ceil((h - c.y) / c.s));
        const X = Math.round(c.x + a * c.s), Y = Math.round(c.y + b * c.s);   // the far edges too, or a fractional scale's planes part at their seams
        if (r > a && d > b) ctx.drawImage(src, a, b, r - a, d - b, X, Y, Math.round(c.x + r * c.s) - X, Math.round(c.y + d * c.s) - Y);
      };
      const repeats = (c, y0, src = plates) => {   // the street's neighbours, repeated as in draw()
        for (let gx = c.x - L * c.s; gx > -L * c.s; gx -= L * c.s) blit(src, 0, y0, L, EH - y0, { ...c, x: gx });
        for (let gx = c.x + EW * c.s; gx < w; gx += R * c.s) blit(src, EW - R, y0, R, EH - y0, { ...c, x: gx - (EW - R) * c.s });
      };
      const shade = (a) => { ctx.globalAlpha = a; ctx.fillStyle = '#151923'; ctx.fillRect(0, 0, w, h); ctx.globalAlpha = 1; };
      const { near, front } = fly;
      const dress = (d) => {   // the front plane's dressing: its repeating layer, its fixed one, and the flames and bulbs
        blit(d.front, 0, 0, EW, EH, front); repeats(front, ROAD, d.front); blit(d.fixed, 0, 0, EW, EH, front); dressing.glints(ctx, f, front);
      };
      if (fly.key === 'E') {
        // lv of the lights still off for what starts coming on at t = a; 0 once on.
        const off = (a) => { const u = (fly.t - a) / 0.1; return u >= 1 ? 0 : SHADES[Math.max(0, Math.floor(u * SHADES.length))]; };
        const sky = clearSky();
        this.draw(ctx, 0, w, h, 1, dpr, wide, fly.far, sky.canvas);
        const plane = (src) => { blit(src, 0, 0, SHAFT[0], EH, near); blit(src, SHAFT[1], 0, EW - SHAFT[1], EH, near); repeats(near, 0, src); };
        plane(plates);
        const n = off(0.55), d = dressing.layers();
        if (n) plane(dark(n));
        plane(d.near);
        const r = off(0.72), road = (src) => { blit(src, 0, ROAD, EW, EH - ROAD, front); repeats(front, ROAD, src); };
        road(plates);
        if (r) road(dark(r));
        // The slots beside the ground floor belong to the far picture at rest, and would hang in the sky: they travel with the tower.
        blit(view.img, SHAFT[0], LOW, SHAFT[1] - SHAFT[0], ROAD - LOW, front);
        const top = wide ? 0 : CRANE[2];
        blit(plates, SHAFT[0], top, SHAFT[1] - SHAFT[0], LOW - top, front);
        blit(sky.fringe, 0, top, EW, LOW - top, front);
        // Floor by floor, top down, as the camera comes past them: the crane and the cornice, then each storey.
        const storeys = ORDER.length - 2, roofAt = ROAD - storeys * STOREY;   // every floor but the garage and the roof
        for (let i = 0; i <= storeys; i++) {
          const a = i ? roofAt + (i - 1) * STOREY : top, lv = off(0.1 + (i * 0.56) / storeys);   // the lights come on down the tower in the same time, however tall
          if (lv) blit(dark(lv), SHAFT[0], a, SHAFT[1] - SHAFT[0], roofAt + i * STOREY - a, front);
        }
        dress(d);
        return;
      }
      if (fly.over) { measure(ctx, w, h); room(fly.room.s, fly.room.x, fly.room.y); }   // the street has gone behind the brick; measured all the same, for a page opened on the roof, whose first way back to the street starts here
      else {
        this.draw(ctx, f, w, h, 1, dpr, wide && fly.key !== 'R', fly.far);   // climbing, the far picture goes without its crane, as on phones: a copy would part from the one on the tower
        shade(fly.dim);
        blit(plates, 0, 0, SHAFT[0], EH, near); blit(plates, SHAFT[1], 0, EW - SHAFT[1], EH, near); repeats(near, 0);
        blit(dressing.layers().near, 0, 0, EW, EH, near); repeats(near, 0, dressing.layers().near);
        shade(fly.dim * 0.5);
        blit(plates, 0, ROAD, EW, EH - ROAD, front); repeats(front, ROAD);   // the road is nearest of all, and runs under the camera
      }
      const top = wide && !fly.over ? 0 : CRANE[2];   // past the peak the street's crane has left the top of the frame: only the roof's comes back
      blit(plates, SHAFT[0], top, SHAFT[1] - SHAFT[0], ROAD - top, front);
      if (!fly.over) dress(dressing.layers());
      const glass = (key, [x, y, gw, gh], r) => {
        ctx.save();
        ctx.beginPath(); ctx.rect(Math.round(x), Math.round(y), Math.round(x + gw) - Math.round(x), Math.round(y + gh) - Math.round(y)); ctx.clip();
        room(r.s, r.x, r.y);
        if (fly.veil) blit(veil(key, fly.veil), 0, 0, Math.round(gw / front.s), Math.round(gh / front.s), { s: front.s, x, y });
        ctx.restore();
      };
      if (fly.key !== 'R') glass(fly.key, fly.win, fly.room);
      // The storeys the crane climbs past, once their signs start to go: each room dark behind its glass, further off than the facade.
      else if (fly.veil < 16) for (const [key, [x0, y0, x1, y1]] of Object.entries(view.windows)) {
        const gw = (x1 - x0) * front.s, gh = (y1 - y0) * front.s, x = front.x + x0 * front.s, y = front.y + y0 * front.s, rs = fly.room.s;
        if (!/\d/.test(key) || y > h || y + gh < 0) continue;   // the lobby's and the garage's are plain slices of the room, and have no sign to lose
        if (!has(key, true)) continue;   // its room, dark, not here yet: the sign stays up (#184)
        const rx = Math.round(x + gw / 2 - (LOOK[key][0] + (x1 - x0) / 2) * rs), ry = Math.round(y + gh / 2 - (LOOK[key][1] + (y1 - y0) / 2) * rs);
        // tower() places the storeys from the roof's camera; phones have no edge runs, so the strip stays across the screen, as at rest.
        glass(key, [x, y, gw, gh], { s: rs, x: wide ? rx : Math.min(0, Math.max(w - FW * rs, rx)), y: ry - (ORDER.length - 1 - ORDER.indexOf(key)) * FH * rs });
      }
    },
    draw(ctx, f, w, h, a, dpr, wide, cam, pic = view.img) {   // cam: a flight's scale and place, else the street's own; pic: null for the flat colours alone
      if (a <= 0) return;
      measure(ctx, w, h);
      const [EW, EH] = view.size, { s, x, y } = cam ?? layout(w, h, dpr, wide), src = f * EW, [L, R] = SIDE;
      ctx.globalAlpha = a;   // the sky and the road's flat colours, all there is until the picture arrives
      ctx.fillStyle = view.top; ctx.fillRect(0, 0, w, y + EH * s - s);
      ctx.fillStyle = view.bottom; ctx.fillRect(0, y + EH * s - s, w, h);
      if (pic) {
        const [cx, cw, roof] = CRANE;
        if (!wide) { ctx.save(); ctx.beginPath(); ctx.rect(x, y, EW * s, EH * s); ctx.rect(x + cx * s, y, cw * s, roof * s); ctx.clip('evenodd'); }
        ctx.drawImage(pic, src, 0, EW, EH, x, y, EW * s, EH * s);
        // The sky repeats every 4 columns: the crane's patch comes from the clear sky at the left of the picture.
        if (!wide) { ctx.restore(); ctx.drawImage(pic, src, 0, cw, roof, x + cx * s, y, cw * s, roof * s); }
        for (let gx = x - L * s; gx > -L * s; gx -= L * s) ctx.drawImage(pic, src, 0, L, EH, gx, y, L * s, EH * s);
        for (let gx = x + EW * s; gx < w; gx += R * s) ctx.drawImage(pic, src + EW - R, 0, R, EH, gx, y, R * s, EH * s);
        // The dressing, repeated down the street as the picture is; a flight's far picture takes only its far layer.
        const d = dressing.layers();
        for (const lay of cam ? [d.far] : [d.far, d.near, d.front]) {
          ctx.drawImage(lay, x, y, EW * s, EH * s);
          for (let gx = x - L * s; gx > -L * s; gx -= L * s) ctx.drawImage(lay, 0, 0, L, EH, gx, y, L * s, EH * s);
          for (let gx = x + EW * s; gx < w; gx += R * s) ctx.drawImage(lay, EW - R, 0, R, EH, gx, y, R * s, EH * s);
        }
        if (!cam) { ctx.drawImage(d.fixed, x, y, EW * s, EH * s); dressing.glints(ctx, f, { s, x, y }); dressing.weather(ctx, f, { s, x, y }, w, h); }
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
