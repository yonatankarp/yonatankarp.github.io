// The street dressed for what is going on outside (outside.js): two trees on the pavement that follow the season, snow
// on the roofs and the pavement in a cold winter, the holidays' decorations, and the weather falling over it all.
// Drawn in code, in art pixels over the baked street (gen_exterior.py), so no season or holiday needs art of its own.
// Three still layers, one per plane a flight parts the street into (street.js): far (the weather's clouds), near (the
// neighbours' roofs) and front (the tower and the pavement), as tall and wide as the street's picture; then what moves
// with the street's frames: the flames and the bulbs, and the rain, the snow, the fog and the fireworks.
import { TIME, BAYER, ART } from './art.js';
import { OUTSIDE } from './outside.js';

const [EW, EH] = [480, 336];   // the street's picture (exterior.json size)
const CORNICE = 80;     // the row just above the tower's cornice (its top line is 81): what stands on the roof's edge
const PAVEMENT = 316;   // the pavement's front row, between its top line (310) and the kerb (318): what stands on it
const POSTS = [40, 142, 338, 440];   // the street lamps, each with its head at rows 265-269
const TREES = [108, 372];            // clear of the 96 and 72 columns the street repeats at its ends (street.js SIDE)
// Not lit by itself, a colour falls with the light: noon's own colours, dawn's and dusk's a little darker, night's half.
const DIM = { day: 1, dawn: 0.82, dusk: 0.72, night: 0.5 }[TIME] ?? 0.72;
const DARK = TIME === 'night' || TIME === 'dusk';

const hash = (x, y, k = 0) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(k, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
function tone(hex, lit) {
  if (lit || DIM === 1) return hex;
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${[n >> 16, (n >> 8) & 255, n & 255].map((v) => Math.round(v * DIM))})`;
}
const layer = () => { const c = document.createElement('canvas').getContext('2d'); c.canvas.width = EW; c.canvas.height = EH; return c; };
const dot = (c, x, y, hex, lit = false, w = 1, h = 1) => { c.fillStyle = tone(hex, lit); c.fillRect(x, y, w, h); };
// A picture in characters, one per art pixel, each a colour of pal ([hex, lit]); any other character is see-through.
function sprite(c, x, y, rows, pal) {
  rows.forEach((row, j) => { for (let i = 0; i < row.length; i++) { const p = pal[row[i]]; if (p) dot(c, x + i, y + j, p[0], p[1]); } });
}

// ---- the trees ----
const LEAVES = {
  spring: ['#2e5a2c', '#4f8a3e', '#79b458'],
  summer: ['#1f4a26', '#33703a', '#58974a'],
  autumn: ['#7a2e16', '#c2561c', '#e89a34'],
};
function tree(c, cx, eggs) {
  const base = PAVEMENT, season = OUTSIDE.season, cold = OUTSIDE.cold;
  for (let y = base - 17; y <= base; y++) { dot(c, cx - 1, y, '#6b4428'); dot(c, cx, y, '#45291a'); }
  dot(c, cx - 2, base, '#45291a', false, 4);
  const cy = base - 28, rx = 14, ry = 12, at = [];
  if (season === 'winter') {
    const twig = new Set();   // a bare crown, branching four times
    const branch = (x, y, a, len, depth) => {
      for (let i = 0; i < len; i++) { x += Math.sin(a); y -= Math.cos(a); twig.add(`${Math.round(x)},${Math.round(y)}`); }
      if (depth) [-0.55, 0.5].forEach((d, k) => branch(x, y, a + d + (hash(Math.round(x), depth, k) - 0.5) * 0.4, len * 0.68, depth - 1));
    };
    branch(cx - 0.5, base - 17, 0, 8, 4);
    for (const p of twig) {
      const [x, y] = p.split(',').map(Number);
      dot(c, x, y, '#4a3020');
      if (cold && !twig.has(`${x},${y - 1}`) && hash(x, y, 9) < 0.7) dot(c, x, y - 1, '#eef2f6');
    }
    if (eggs) for (const p of [...twig].filter((_, i) => i % 9 === 4).slice(0, 6)) at.push(p.split(',').map(Number));
  } else {
    const pal = LEAVES[season] ?? LEAVES.summer, inside = (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < 1 - 0.3 * hash(x, y, 1);
    for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
      if (!inside(x, y)) continue;
      const edge = !inside(x, y + 1) || !inside(x + 1, y);   // the shadow side's rim
      const v = 0.55 - ((x - cx) / rx) * 0.2 - ((y - cy) / ry) * 0.35 + (BAYER[y & 3][x & 3] / 16 - 0.5) * 0.3;
      dot(c, x, y, edge ? pal[0] : pal[v < 0.4 ? 0 : v < 0.7 ? 1 : 2]);
      if (season === 'spring' && hash(x, y, 3) < 0.13) dot(c, x, y, hash(x, y, 4) < 0.5 ? '#f2a9c2' : '#fde3ec');
    }
    if (season === 'autumn') for (let i = 0; i < 9; i++) dot(c, cx - 13 + Math.floor(hash(i, cx, 5) * 26), base - (i & 1), pal[1 + (i % 2)]);
    if (eggs) for (let i = 0; i < 8; i++) at.push([cx - 10 + Math.floor(hash(i, cx, 6) * 20), cy - 3 + Math.floor(hash(i, cx, 7) * 11)]);
  }
  // Easter's eggs hang in it, as on Germany's Ostereierbaum.
  at.forEach(([x, y], i) => {
    const col = ['#f06a8a', '#ffd04a', '#6ec6f0', '#9ee07a', '#c79af2'][i % 5];
    dot(c, x, y + 1, '#2a1e18'); dot(c, x - 1, y + 2, col, false, 2, 3); dot(c, x - 1, y + 3, '#ffffff');
  });
}

// ---- snow on the roofs and the pavement ----
function snow(near, front) {
  const white = '#eef2f6', blue = '#c3cfdc';
  const cap = (c, x0, x1, top) => {
    for (let x = x0; x < x1; x++) {
      dot(c, x, top - 1, hash(x, top, 2) < 0.3 ? blue : white);
      if (hash(x, top, 3) < 0.55) dot(c, x, top - 2, white);
      if (hash(x, top, 4) < 0.08) dot(c, x, top, blue);   // a drip over the edge
    }
  };
  for (const [x0, x1, roof] of ART.neighbours) cap(near, x0 - 1, x1 + 1, roof - 1);
  cap(front, 167, 314, CORNICE + 1);
  POSTS.forEach((x) => cap(front, x - 2, x + 3, 265));
  for (let x = 0; x < EW; x++) for (let y = 311; y < 318; y++) if (BAYER[y & 3][x & 3] < (y < 313 ? 13 : 9)) dot(front, x, y, (x + y) % 7 ? white : blue);
}

// ---- the weather's clouds: clear of the tower and the crane, and of the columns the street repeats at its ends ----
function clouds(far, dark) {
  const top = dark ? ['#6d7480', '#565c68', '#3f444e'] : ['#d3d8df', '#aab2bd', '#878f9c'];
  for (const [cx, cy, r] of [[128, 40, 12], [112, 112, 8], [364, 58, 12], [374, 128, 8]]) {
    for (let y = cy - r; y <= cy + 3; y++) for (let x = cx - r * 2; x <= cx + r * 2; x++) {
      const bumps = Math.min(...[-1, 0, 1].map((k) => ((x - cx - k * r) / r) ** 2 + ((y - cy + (k ? 0 : r * 0.35)) / (r * 0.8)) ** 2));
      if (bumps > 1 - 0.25 * hash(x, y, 8)) continue;
      const v = (cy + 3 - y) / (r + 3) + (BAYER[y & 3][x & 3] / 16 - 0.5) * 0.3;
      dot(far, x, y, top[v > 0.6 ? 0 : v > 0.25 ? 1 : 2]);
    }
  }
}

// ---- the holidays ----
const flame = ['#ffe680', '#ffb43a', '#ff8a2a'];
// Hanukkah: a menorah on the roof's edge, as on the big rooftop ones, with tonight's candles lit, the newest on the left.
function menorah(c, glints, night) {
  const x0 = 174, gold = '#d9a93a', shade = '#9c7426', bar = CORNICE - 12;
  dot(c, x0 + 12, CORNICE, shade, false, 9); dot(c, x0 + 13, CORNICE - 1, gold, false, 7);
  dot(c, x0 + 16, bar, shade, false, 1, CORNICE - 1 - bar); dot(c, x0 + 15, bar, gold, false, 1, CORNICE - 1 - bar);
  dot(c, x0, bar, gold, false, 33); dot(c, x0, bar + 1, shade, false, 33);
  for (let i = 0; i < 9; i++) {
    const x = x0 + i * 4, shamash = i === 4, top = bar - (shamash ? 7 : 5);
    dot(c, x - 1, bar - 1, gold, false, 3);                            // its cup
    dot(c, x, top + 1, '#f4efe2', false, 1, bar - 2 - top);            // the candle
    if (candle(i, night)) glints.push([x, top, flame, i], [x, top - 1, ['#ffb43a', null, null, '#ffe680'], i]);
  }
}
// The candles of night n (0-7): n + 1 of the eight, filled in from the right.
const candle = (i, n) => (i === 4 ? true : (i > 4 ? i - 1 : i) >= 7 - n);
// Sukkot: a sukkah on the roof, its roof of branches.
function sukkah(c) {
  sprite(c, 176, CORNICE - 12, [
    '.g.Gg.gG..gg.Gg.g.G',
    'gGgGgGgGgGgGgGgGgGg',
    'wcccrccocccrcccoccw',
    'wbbbbbbbbbbbbbbbbbw',
    'wccccccc...ccccccw.',
    'wccccccc...cccccccw',
    'wbbbbbbb...bbbbbbbw',
    'wccccccc...cccccccw',
    'wccccccc...cccccccw',
    'wbbbbbbb...bbbbbbbw',
    'wccccccc...cccccccw',
    'wwwwwwwwwwwwwwwwwww',
  ], { g: ['#3f7a35'], G: ['#6aa84a'], w: ['#7a5232'], c: ['#efe6cf'], b: ['#5b84c4'], r: ['#d8423a'], o: ['#f0a030'] });
}
// Eid: a crescent and a star on the roof's other end.
function crescent(c) {
  const gold = ['#ffd45e', DARK], cx = 300, cy = CORNICE - 9;
  for (let y = cy - 7; y <= cy + 7; y++) for (let x = cx - 7; x <= cx + 7; x++) {
    if ((x - cx) ** 2 + (y - cy) ** 2 <= 49 && (x - cx - 3) ** 2 + (y - cy + 1) ** 2 > 30) dot(c, x, y, gold[0], gold[1]);
  }
  sprite(c, cx + 2, cy - 3, ['..s..', '.sss.', 'sssss', '.sss.', '.s.s.'], { s: gold });
  dot(c, cx - 1, cy + 8, '#3a3a40', false, 3);
}
// Christmas: a string of bulbs under the cornice, twinkling, and a tree at the tower's corner.
function christmas(c, glints) {
  for (let x = 168; x < 313; x++) {
    const sag = Math.round(Math.sin(((x - 168) / 12) * Math.PI) ** 2 * 2);
    dot(c, x, 83 + sag, '#20301f');
    if ((x - 168) % 4 === 2) glints.push([x, 84 + sag, [['#ff5050', '#55e06a', '#ffd24a', '#5aa8ff'][((x - 168) / 4 | 0) % 4], '#ffffff', null], (x / 4) | 0]);
  }
  sprite(c, 304, PAVEMENT - 25, [
    '.......y.......',
    '......yYy......',
    '.......g.......',
    '......ggg......',
    '.....gGgrg.....',
    '....gggGgg.....',
    '.....ggbgg.....',
    '....gGgggGg....',
    '...gggyggggg...',
    '....ggggGgg....',
    '...gGgggggrg...',
    '..ggggbggGggg..',
    '....gggggGg....',
    '...gGggrgggGg..',
    '..ggggggggbggg.',
    '.gGggyggGgggggg',
    '...ggggggggrg..',
    '..gggGggbgggGg.',
    '.gggrggggggyggg',
    'gggggggGgggggggg',
    '......ttt......',
    '......ttt......',
    '.....RRRRR.....',
    '.....RrRrR.....',
    '.....RRRRR.....',
  ], { g: ['#1e5a2e'], G: ['#2f7d3e'], y: ['#ffd24a', DARK], Y: ['#fff3a8', DARK], r: ['#e8403c', DARK], b: ['#5aa8ff', DARK], t: ['#5a3a22'], R: ['#a8282a'] });
}
// Halloween: jack-o'-lanterns by the door.
function pumpkins(c) {
  const big = ['...gg...', '.oooooo.', 'oyyooyyo', 'oooooooo', 'oyoyyoyo', 'ooyooyoo', '.oooooo.'];
  const small = ['..g..', '.ooo.', 'oyoyo', 'ooooo', 'oyyyo', '.ooo.'];
  const pal = { g: ['#3c6a2a'], o: ['#e0731c'], y: [DARK ? '#ffe36a' : '#5a2a08', DARK] };
  sprite(c, 160, PAVEMENT - 6, big, pal); sprite(c, 169, PAVEMENT - 5, small, pal); sprite(c, 312, PAVEMENT - 5, small, pal);
}
// Diwali: diyas along the pavement and the roof's edge.
function diyas(c, glints) {
  for (let x = 172; x <= 306; x += 9) for (const y of [PAVEMENT, CORNICE]) {
    dot(c, x - 2, y - 1, '#b5532a', false, 5); dot(c, x - 1, y, '#8a3a1c', false, 3);
    glints.push([x, y - 2, flame, x]);
  }
}
// Lanterns: on each street lamp, and either side of the door; red for the Lunar New Year, Eid's in brass and teal.
function lanterns(c, eid) {
  const pal = eid ? { d: ['#d9a93a'], r: ['#2a9a9a', DARK], R: ['#ffe28a', DARK], t: ['#d9a93a'] } : { d: ['#d9a93a'], r: ['#d8282a', DARK], R: ['#ff6a4a', DARK], t: ['#ffcc3a'] };
  const one = ['..d..', '.ddd.', 'rrrrr', 'rRrRr', 'rRrRr', 'rrrrr', '.ddd.', '..t..', '..t..'];
  POSTS.forEach((x) => { dot(c, x + 1, 271, '#30363e', false, 4); sprite(c, x + 3, 272, one, pal); });
  sprite(c, 170, 276, one, pal); sprite(c, 304, 276, one, pal);
}

// ---- what moves ----
const RAIN = { tile: 64, count: 7, fall: 9 }, SNOW = { tile: 64, count: 9, fall: 2 };
const drops = (k, n, tile) => Array.from({ length: n }, (_, i) => [Math.floor(hash(i, k, 11) * tile), Math.floor(hash(i, k, 12) * tile)]);
const RAIN_AT = drops(1, RAIN.count, RAIN.tile), SNOW_AT = drops(2, SNOW.count, SNOW.tile);
const BURSTS = [[66, 58, 0, '#ff6a6a'], [412, 46, 5, '#7ad8ff'], [118, 126, 8, '#ffe066'], [384, 118, 3, '#b48aff']];
const fogs = new Map();
function fogPattern(ctx, s, level, colour) {
  const id = `${s},${level},${colour}`;
  if (!fogs.has(id)) {
    const c = document.createElement('canvas').getContext('2d');
    c.canvas.width = c.canvas.height = 4 * s;
    c.fillStyle = colour;
    BAYER.forEach((row, y) => row.forEach((b, x) => { if (b < level) c.fillRect(x * s, y * s, s, s); }));
    fogs.set(id, ctx.createPattern(c.canvas, 'repeat'));
  }
  return fogs.get(id);
}

export function decor() {
  let built = null, version = 0;
  OUTSIDE.changed(() => { version++; });
  function build() {
    if (built?.version === version) return built;
    const far = layer(), near = layer(), front = layer(), glints = [], h = OUTSIDE.holidays, sky = OUTSIDE.sky;
    if (sky && sky !== 'clear' && sky !== 'fog') clouds(far, sky !== 'cloudy' || DARK);
    if (OUTSIDE.cold) snow(near, front);
    TREES.forEach((x) => tree(front, x, 'easter' in h));
    if ('sukkot' in h) sukkah(front);
    if ('hanukkah' in h) menorah(front, glints, h.hanukkah);
    if ('eid-al-fitr' in h || 'eid-al-adha' in h) { crescent(front); lanterns(front, true); }
    if ('lunar-new-year' in h) lanterns(front, false);
    if ('christmas' in h) christmas(front, glints);
    if ('halloween' in h) pumpkins(front);
    if ('diwali' in h) diyas(front, glints);
    return (built = { version, far: far.canvas, near: near.canvas, front: front.canvas, glints });
  }
  return {
    layers: build,
    // The flames and the bulbs at frame f, over the front layer at its place (s, x, y in device pixels).
    glints(ctx, f, { s, x, y }) {
      for (const [gx, gy, cols, k] of build().glints) {
        const col = cols[(f + k) % cols.length];
        if (col) { ctx.fillStyle = col; ctx.fillRect(Math.round(x + gx * s), Math.round(y + gy * s), Math.ceil(s), Math.ceil(s)); }
      }
    },
    // The weather and the fireworks over the street at frame f, on its grid of art pixels (s, x, y), within the canvas'
    // w x h, or only below row `from` of it (the roof's sky starts at the top of the screen, the street's rain too).
    weather(ctx, f, { s, x, y }, w, h, clip) {
      const sky = OUTSIDE.sky, fireworks = 'new-year' in OUTSIDE.holidays;
      if (!fireworks && (!sky || sky === 'clear' || sky === 'cloudy')) return;
      ctx.save();
      if (clip) { ctx.beginPath(); ctx.rect(...clip); ctx.clip(); }
      const ax0 = Math.floor(-x / s), ax1 = Math.ceil((w - x) / s), ay0 = Math.floor(-y / s), ay1 = Math.ceil((h - y) / s);
      const fall = (spec, at, paint) => {
        const T = spec.tile;
        for (let ty = Math.floor(ay0 / T) * T; ty < ay1; ty += T) for (let tx = Math.floor(ax0 / T) * T; tx < ax1; tx += T) {
          at.forEach(([px, py], i) => paint(tx + px, ty + ((py + f * spec.fall * (1 + (i % 2))) % T), i));
        }
      };
      const cell = (ax, ay, col, len = 1) => { ctx.fillStyle = col; ctx.fillRect(x + ax * s, y + ay * s, s, len * s); };
      if (sky === 'rain') fall(RAIN, RAIN_AT, (ax, ay) => { cell(ax, ay, tone('#9fb6d4'), 2); cell(ax - 1, ay + 2, tone('#7f97b8'), 2); });
      if (sky === 'snow') fall(SNOW, SNOW_AT, (ax, ay, i) => { const sway = ((f + i) >> 2) & 1; cell(ax + sway, ay, i % 3 ? '#eef2f6' : '#c3cfdc'); if (i % 4 === 0) cell(ax + sway + 1, ay, '#eef2f6'); });
      if (sky === 'fog') {
        const colour = tone('#c6ccd4');
        [[200, 1], [250, 2], [290, 3]].forEach(([from, level], i, all) => {
          const to = all[i + 1]?.[0] ?? EH, pat = fogPattern(ctx, s, level, colour);
          pat.setTransform(new DOMMatrix().translate(x, y));
          ctx.fillStyle = pat; ctx.fillRect(0, y + from * s, w, (to - from) * s);
        });
        ctx.fillStyle = fogPattern(ctx, s, 3, colour); ctx.fillRect(0, y + EH * s, w, h);
      }
      if (fireworks) for (const [bx, by, at, col] of BURSTS) {
        const r = (f + at) % 12;
        if (r < 3) { cell(bx, by + 12 - r * 5, '#ffe9b0', 2); continue; }   // the rocket going up
        const n = r - 2, dim = n > 6 ? tone(col) : col;
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2, d = n * 2.2;
          cell(Math.round(bx + Math.cos(a) * d), Math.round(by + Math.sin(a) * d + n * n * 0.08), k & 1 && n > 4 ? '#ffffff' : dim);
          if (n > 1 && n < 8) cell(Math.round(bx + Math.cos(a) * (d - 2)), Math.round(by + Math.sin(a) * (d - 2)), tone(col));
        }
      }
      ctx.restore();
    },
  };
}
