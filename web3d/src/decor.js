// The street dressed for what is going on outside (outside.js): two trees on the pavement that follow the season, snow
// on the roofs and the pavement in a cold winter, the holidays' decorations, and the weather falling over it all.
// Drawn in code, in art pixels over the baked street (gen_exterior.py), so no season or holiday needs art of its own.
// Still layers, one per plane a flight parts the street into (street.js), as tall and wide as the street's picture:
// far (the weather's clouds), near (the neighbours: their roofs and windows) and front (the pavement and the lamp posts),
// which repeat down the street with the picture's ends, and fixed, on the front plane too but drawn once, for what the
// repeats would cut (the strings of lights, the trees). Then what moves with the street's frames: the flames and the
// bulbs, and the rain, the snow, the fog and the fireworks. The holidays keep to the street; the tower's signs stay clear.
import { TIME, BAYER, ART, SIZE, WINDOWS } from './art.js';
import { OUTSIDE } from './outside.js';

const [EW, EH] = SIZE;               // the street's picture
const RISE = ART.rise ?? 0;          // the rows a taller tower grew it by at its top: the street's sky and scenery slide down by as many
const GROUND = ART.ground;           // the pavement's top line; the kerb is 8 rows down
const CORNICE = ART.crane[2] - 1;    // the row just above the tower's cornice: where snow lies on it
const PAVEMENT = GROUND + 6;         // the pavement's front row: what stands on it
const POSTS = [40, 142, 338, 440];   // the street lamps, each with its head at rows GROUND - 45 to - 41
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
  POSTS.forEach((x) => cap(front, x - 2, x + 3, GROUND - 45));
  for (let x = 0; x < EW; x++) for (let y = GROUND + 1; y < GROUND + 8; y++) if (BAYER[y & 3][x & 3] < (y < GROUND + 3 ? 13 : 9)) dot(front, x, y, (x + y) % 7 ? white : blue);
}

// ---- the weather's clouds: clear of the tower and the crane, and of the columns the street repeats at its ends ----
function clouds(far, dark) {
  const top = dark ? ['#6d7480', '#565c68', '#3f444e'] : ['#d3d8df', '#aab2bd', '#878f9c'];
  for (const [cx, cy, r] of [[128, 40 + RISE, 12], [112, 112 + RISE, 8], [364, 58 + RISE, 12], [374, 128 + RISE, 8]]) {
    for (let y = cy - r; y <= cy + 3; y++) for (let x = cx - r * 2; x <= cx + r * 2; x++) {
      const bumps = Math.min(...[-1, 0, 1].map((k) => ((x - cx - k * r) / r) ** 2 + ((y - cy + (k ? 0 : r * 0.35)) / (r * 0.8)) ** 2));
      if (bumps > 1 - 0.25 * hash(x, y, 8)) continue;
      const v = (cy + 3 - y) / (r + 3) + (BAYER[y & 3][x & 3] / 16 - 0.5) * 0.3;
      dot(far, x, y, top[v > 0.6 ? 0 : v > 0.25 ? 1 : 2]);
    }
  }
}

// ---- the holidays: on the street, never on the tower, whose signs stay clear ----
const flame = ['#ffe680', '#ffb43a', '#ff8a2a'];
const HEAD = GROUND - 41;   // the foot of a street lamp's head, where a string of lights hangs from
// The strings of lights run lamp to lamp, and from the lamps either side of the tower to its brick, so they never
// cross a sign. Drawn on the street's middle only (the fixed layer): its ends repeat outwards, which would cut them.
const SPANS = [[40, 142], [142, ART.brick[0]], [ART.brick[1], 338], [338, 440]];
function strings(c, each) {
  for (const [x0, x1] of SPANS) {
    const sag = Math.max(2, Math.round((x1 - x0) * 0.06));
    for (let x = x0 + 2; x < x1 - 1; x++) {
      const u = (x - x0) / (x1 - x0), y = HEAD + Math.round(4 * sag * u * (1 - u));
      dot(c, x, y, '#1c1f26');
      each?.(x, y, x - x0 - 2);
    }
  }
}
// The bulbs along them: every 4 px, twinkling through cols (null: dark for a frame).
const bulbs = (c, glints, colours, twinkle = true) => strings(c, (x, y, i) => {
  if (i % 4 === 2) glints.push([x, y + 1, twinkle ? [colours[(i >> 2) % colours.length], '#ffffff', null] : [colours[(i >> 2) % colours.length]], i >> 2]);
});
// Something hung from the strings every `step` px.
const hung = (c, step, draw) => strings(c, (x, y, i) => { if (i % step === step >> 1) draw(x, y + 1); });
// The neighbours' windows, as gen_exterior.PANES lays them (4 x 5), and a few of them by a seed: ~share of them.
const PANES = ART.neighbours.flatMap(([x0, x1, top]) => {
  const out = [];
  for (let y = top + 8; y < GROUND - 6; y += 10) for (let x = x0 + 4; x < x1 - 4; x += 8) out.push([x, y]);
  return out;
});
const some = (seed, share) => PANES.filter(([x, y]) => hash(x, y, seed) < share);
// What hangs on each street lamp's post, under its head.
const posts = (c, rows, pal) => POSTS.forEach((x) => sprite(c, x - (rows[0].length >> 1), HEAD + 4, rows, pal));
const lantern = (c, x, y, pal) => sprite(c, x - 1, y, ['.d.', 'rRr', 'rRr', 'rrr', '.t.'], pal);
const RED = { d: ['#d9a93a'], r: ['#d8282a', DARK], R: ['#ff6a4a', DARK], t: ['#ffcc3a'] };
const BRASS = { d: ['#d9a93a'], r: ['#2a9a9a', DARK], R: ['#ffe28a', DARK], t: ['#d9a93a'] };

// Hanukkah: a public menorah on the pavement beside the tower, as cities put up in their squares, and another in the
// news stand's window, facing the street as the custom has it, each with tonight's candles lit, the newest on the left;
// and blue and white lights on the strings.
function menorah(c, glints, x0, foot, gap, stem) {
  const gold = ['#d9a93a', DARK], shade = ['#9c7426', DARK], mid = x0 + gap * 4, bar = foot - stem, night = OUTSIDE.holidays.hanukkah;
  dot(c, mid - 3, foot, shade[0], shade[1], 7); dot(c, mid - 2, foot - 1, gold[0], gold[1], 5);
  dot(c, mid, bar, gold[0], gold[1], 1, stem - 1); dot(c, mid + 1, bar, shade[0], shade[1], 1, stem - 1);
  dot(c, x0, bar, gold[0], gold[1], gap * 8 + 1); dot(c, x0, bar + 1, shade[0], shade[1], gap * 8 + 1);
  for (let i = 0; i < 9; i++) {
    const x = x0 + i * gap, top = bar - (i === 4 ? 6 : 4);
    if (gap > 3) dot(c, x - 1, bar - 1, gold[0], gold[1], 3);       // its cup
    dot(c, x, top + 1, '#f4efe2', false, 1, bar - top - (gap > 3 ? 2 : 1));   // the candle
    if (candle(i, night)) glints.push([x, top, flame, i], [x, top - 1, ['#ffb43a', null, null, '#ffe680'], i]);
  }
}
function hanukkah(fixed, glints) {
  menorah(fixed, glints, 144, PAVEMENT, 3, 20);
  const [, , wx1, wy1] = WINDOWS.L;
  menorah(fixed, glints, wx1 - 30, wy1 - 2, 3, 7);
  bulbs(fixed, glints, ['#5aa8ff', '#eef6ff']);
}
// The candles of night n (0-7): n + 1 of the eight, filled in from the right, and the shamash, the middle one.
const candle = (i, n) => (i === 4 ? true : (i > 4 ? i - 1 : i) >= 7 - n);
// Christmas: warm bulbs on the strings, a wreath on every lamp post and on some of the neighbours' windows, and a tree
// at the tower's corner.
function christmas(near, front, fixed, glints) {
  bulbs(fixed, glints, ['#ff5050', '#55e06a', '#ffd24a', '#5aa8ff']);
  const wreath = ['.gGg.', 'g...G', 'G...g', 'g...G', '.gRg.', '..R..'], pal = { g: ['#1e5a2e'], G: ['#2f7d3e'], R: ['#d8282a'] };
  posts(front, wreath, pal);
  for (const [x, y] of some(21, 0.12)) sprite(near, x, y, ['gGgG', 'G..g', 'g..G', 'GgRg'], pal);
  sprite(fixed, 304, PAVEMENT - 25, [
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
// Sukkot: a sukkah on the pavement, beside the tower, its roof of branches.
function sukkah(fixed) {
  sprite(fixed, 146, PAVEMENT - 11, [
    '.g.Gg.gG..gg.Gg.g.G',
    'gGgGgGgGgGgGgGgGgGg',
    'wcccrccocccrcccoccw',
    'wbbbbbbbbbbbbbbbbbw',
    'wccccccc...cccccccw',
    'wbbbbbbb...bbbbbbbw',
    'wccccccc...cccccccw',
    'wccccccc...cccccccw',
    'wbbbbbbb...bbbbbbbw',
    'wccccccc...cccccccw',
    'wwwwwwwwwwwwwwwwwww',
    'w.................w',
  ], { g: ['#3f7a35'], G: ['#6aa84a'], w: ['#7a5232'], c: ['#efe6cf'], b: ['#5b84c4'], r: ['#d8423a'], o: ['#f0a030'] });
}
// Eid: brass and teal lanterns along the strings, a crescent and star on every lamp post, and two by the door.
function eid(front, fixed) {
  strings(fixed);
  hung(fixed, 12, (x, y) => lantern(fixed, x, y, BRASS));
  posts(front, ['.ss...', 's...s.', 's..sss', 's...s.', '.ss...'], { s: ['#ffd45e', DARK] });
  lantern(front, 172, GROUND - 32, BRASS); lantern(front, 306, GROUND - 32, BRASS);
}
// The Lunar New Year: red lanterns along the strings, under the neighbours' eaves, on the lamp posts and by the door.
function lunar(near, front, fixed) {
  strings(fixed);
  hung(fixed, 12, (x, y) => lantern(fixed, x, y, RED));
  for (const [x0, x1, roof] of ART.neighbours) for (let x = x0 + 6; x < x1 - 4; x += 14) lantern(near, x, roof + 3, RED);
  posts(front, ['.d.', 'rRr', 'rRr', 'rrr', '.t.', '.t.'], RED);
  lantern(front, 172, GROUND - 32, RED); lantern(front, 306, GROUND - 32, RED);
}
// Halloween: jack-o'-lanterns on the pavement, and a few of the neighbours' windows glowing orange after dark.
function halloween(near, fixed) {
  const big = ['...gg...', '.oooooo.', 'oyyooyyo', 'oooooooo', 'oyoyyoyo', 'ooyooyoo', '.oooooo.'];
  const small = ['..g..', '.ooo.', 'oyoyo', 'ooooo', 'oyyyo', '.ooo.'];
  const pal = { g: ['#3c6a2a'], o: ['#e0731c'], y: [DARK ? '#ffe36a' : '#5a2a08', DARK] };
  sprite(fixed, 158, PAVEMENT - 6, big, pal); sprite(fixed, 166, PAVEMENT - 5, small, pal); sprite(fixed, 312, PAVEMENT - 5, small, pal);
  sprite(fixed, 64, PAVEMENT - 6, big, pal); sprite(fixed, 404, PAVEMENT - 5, small, pal); sprite(fixed, 412, PAVEMENT - 6, big, pal);
  if (DARK) for (const [x, y] of some(31, 0.1)) sprite(near, x, y, ['oooo', 'koko', 'oooo', 'okko', 'oooo'], { o: ['#ff9a2a', true], k: ['#5a2a08', true] });
}
// Diwali: diyas along the pavement and on the neighbours' window sills, and marigold lights on the strings.
function diwali(near, fixed, glints) {
  const diya = (c, x, y) => { dot(c, x - 2, y - 1, '#b5532a', false, 5); dot(c, x - 1, y, '#8a3a1c', false, 3); };
  for (let x = 172; x <= 306; x += 9) { diya(fixed, x, PAVEMENT); glints.push([x, PAVEMENT - 2, flame, x]); }
  for (const [x, y] of some(41, 0.3)) { dot(near, x, y + 6, '#8a3a1c', false, 4); dot(near, x + 1, y + 5, '#ffb43a', true, 2); }
  bulbs(fixed, glints, ['#ffb43a', '#ff8a2a', '#ffe680'], false);
}
// Easter: pastel bunting on the strings by day, and the eggs in the trees (tree()).
function easter(fixed) {
  hung(fixed, 5, (x, y) => sprite(fixed, x - 1, y, ['fff', '.f.'], { f: [['#f06a8a', '#ffd04a', '#6ec6f0', '#9ee07a', '#c79af2'][Math.floor(x / 5) % 5]] }));
}

// ---- what moves ----
const RAIN = { tile: 64, count: 7, fall: 9 }, SNOW = { tile: 64, count: 9, fall: 2 };
const drops = (k, n, tile) => Array.from({ length: n }, (_, i) => [Math.floor(hash(i, k, 11) * tile), Math.floor(hash(i, k, 12) * tile)]);
const RAIN_AT = drops(1, RAIN.count, RAIN.tile), SNOW_AT = drops(2, SNOW.count, SNOW.tile);
const BURSTS = [[66, 58, 0, '#ff6a6a'], [412, 46, 5, '#7ad8ff'], [118, 126, 8, '#ffe066'], [384, 118, 3, '#b48aff']].map(([x, y, ...rest]) => [x, y + RISE, ...rest]);
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
    const far = layer(), near = layer(), front = layer(), fixed = layer(), glints = [], h = OUTSIDE.holidays, sky = OUTSIDE.sky;
    if (sky && sky !== 'clear' && sky !== 'fog') clouds(far, sky !== 'cloudy' || DARK);
    if (OUTSIDE.cold) snow(near, front);
    TREES.forEach((x) => tree(fixed, x, 'easter' in h));
    if ('easter' in h) easter(fixed);
    if ('sukkot' in h) sukkah(fixed);
    if ('hanukkah' in h) hanukkah(fixed, glints);
    if ('christmas' in h) christmas(near, front, fixed, glints);
    if ('eid-al-fitr' in h || 'eid-al-adha' in h) eid(front, fixed);
    if ('lunar-new-year' in h) lunar(near, front, fixed);
    if ('halloween' in h) halloween(near, fixed);
    if ('diwali' in h) diwali(near, fixed, glints);
    return (built = { version, far: far.canvas, near: near.canvas, front: front.canvas, fixed: fixed.canvas, glints });
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
        [[RISE + 200, 1], [RISE + 250, 2], [RISE + 290, 3]].forEach(([from, level], i, all) => {
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
