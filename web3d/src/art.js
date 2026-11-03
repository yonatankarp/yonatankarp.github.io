// What the building (pixel.js) and the street (street.js) share: the art's own numbers, read from what the Python
// pipeline writes, the visitor's hour, and the lights-off picture of a strip.
import { art, size, windows } from '../../static/building/pixel/exterior.json';   // gen_exterior.art_json(), bundled: needed from the first strip
import PHASES from '../../data/phases.json';                       // the hours the art is baked for, checked against gen_floors.PHASES

export const [FW, FH] = art.frame;
export const FRAMES = art.frames;
export const ORDER = ['P', 'L', '1', '2', '3', '4', '5', '6', '7', 'R'];   // bottom to top
export const { door: DOOR, bayer: BAYER, look: LOOK } = art;
// Each room's hanging lamps, by strip x, the lift's own lamp first. The roof has none: it is outdoors, so it stays as
// bright as its sky.
export const LAMPS = art.lamps;
export { art as ART };
export const STREET = { size, windows };   // the street picture's size, and where each floor's window is in it
export const TIME = document.documentElement.dataset.time;   // picked once, in the page's head (#151): it never changes while the page is open
const PHASE = PHASES[TIME];
export const BAKED = PHASE?.baked;                              // the art with its own picture at this hour: the rooms with an outside view; none at dusk
export const HOUR = BAKED ? `-${TIME}` : '';                    // the file name's suffix
export const SKY_AT_LOAD = PHASE?.sky ?? PHASES.dusk.sky;       // above the roof, until its strip gives its own top row
const DARK = PHASE?.dark ?? PHASES.dusk.dark;                   // what a room's colours fall to with its lights off; by day its windows still let some in
export const SHADES = [16, 10, 5];                              // a lamp coming on: how many of 16 Bayer cells are still dark, step by step
// The phone layout: the same query as every phone rule in pixel.css, so the canvas and the cards always agree (#46).
export const narrow = matchMedia('(max-width: 760px), (max-aspect-ratio: 6/5)');
export const easeInOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);
export const clamp01 = (v) => Math.min(1, Math.max(0, v));

// A picture's colour at one pixel, as CSS.
export function colourAt(img, x, y) {
  const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  c.canvas.width = c.canvas.height = 1;
  c.drawImage(img, -x, -y);
  return `rgb(${[...c.getImageData(0, 0, 1, 1).data.slice(0, 3)]})`;
}

// A strip's rest frame and edge runs with its lights off, each colour fallen to the nearest of the room's own, so it
// stays on the palette; with lv of 16 Bayer cells of it left, to dither over the lit room. Laid out as the strip, with
// one frame. Kept on the image: made in idle time as a floor arrives (darkenSoon), or here, when first seen before that
// has finished. The street's picture is as wide as a strip, only taller.
export function shade(img, lv) {
  img.shades ??= {};
  if (img.shades[lv]) return img.shades[lv];
  if (lv < 16) {   // composited, not read back: this runs as a lamp comes on, and must not cost that frame
    const off = shade(img, 16), W = off.width, H = off.height;
    const c = document.createElement('canvas').getContext('2d');
    c.canvas.width = W; c.canvas.height = H;
    const tile = document.createElement('canvas').getContext('2d');
    tile.canvas.width = tile.canvas.height = 4;
    BAYER.forEach((row, y) => row.forEach((b, x) => { if (b < lv) tile.fillRect(x, y, 1, 1); }));
    c.drawImage(off, 0, 0);
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = c.createPattern(tile.canvas, 'repeat');
    c.fillRect(0, 0, W, H);
    return (img.shades[lv] = c.canvas);
  }
  img.darkening ??= darken(img);
  let step;
  while (!(step = img.darkening.next()).done);   // whatever idle time has not done yet
  img.darkening = null;
  return (img.shades[16] = step.value);
}

// shade()'s lights-off picture, a few rows per step, so idle time can make it without a long task on a slow phone (#184).
export function* darken(img) {
  const ROWS = 12;
  const runs = img.width - FRAMES * FW, H = img.height;
  const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true }), W = FW + runs;
  c.canvas.width = W; c.canvas.height = H;
  c.drawImage(img, 0, 0, FW, H, 0, 0, FW, H);
  if (runs) c.drawImage(img, FRAMES * FW, 0, runs, H, FW, 0, runs, H);
  const d = c.getImageData(0, 0, W, H), px = new Uint32Array(d.data.buffer);
  yield;
  const seen = new Set();   // the room's own colours, in the order they first appear
  for (let y = 0; y < H; y += ROWS) { for (let i = y * W, end = Math.min(H, y + ROWS) * W; i < end; i++) seen.add(px[i]); yield; }
  const rgb = (v) => [v & 255, (v >> 8) & 255, (v >> 16) & 255], own = [...seen].map((v) => [v, rgb(v)]);
  const fallen = new Map(own.map(([v, col]) => {
    const to = col.map((n, i) => n * DARK[i]);
    let best = v, far = Infinity;
    for (const [w, o] of own) { const e = (o[0] - to[0]) ** 2 + (o[1] - to[1]) ** 2 + (o[2] - to[2]) ** 2; if (e < far) { far = e; best = w; } }
    return [v, best];
  }));
  yield;
  let last, to;   // pixel art runs in one colour: look it up once per run
  for (let y = 0; y < H; y += ROWS) {
    for (let i = y * W, end = Math.min(H, y + ROWS) * W; i < end; i++) { if (px[i] !== last) to = fallen.get(last = px[i]); px[i] = to; }
    yield;
  }
  c.putImageData(d, 0, 0);
  return c.canvas;
}
