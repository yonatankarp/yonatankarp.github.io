// What the tower (pixel.js) draws by: the art's own numbers, read from what the Python pipeline writes, the visitor's
// hour, and the lights-off picture of a strip.
import art from '../../static/building/pixel/floors.json';   // gen_floors.py, bundled: needed from the first strip
import PHASES from '../../data/phases.json';                 // the hours the art is baked for, checked by gen_floors.py
import catSheet from '../../static/building/pixel/cats-lobby.json';   // gen_walkers.py: the lobby's cats' frames

export const [FW, FH] = art.frame;
export const FRAMES = art.frames;
export const EDGE = art.edge;                // a run's columns, tiled past the strip on a wide screen
export const [ROOM_X0, ROOM_X1] = art.room;  // the painting's span in the strip: the runs go on from there
export const ORDER = art.order;              // the floors bottom to top, L to R: gen_floors.FLOORS
export const ANIM = art.anim;                // each strip's moving box, x, y, w, h: its other frames start at BOXES
export const { cab: CAB, boxes: BOXES } = art;   // in a strip, the lift's cab (the doorway's size, behind the doors), and those frames
export const { door: DOOR, bayer: BAYER } = art;
// Each room's hanging lamps, by strip x, the lift's own lamp first. The roof has none: it is outdoors, so it stays as
// bright as its sky.
export const LAMPS = art.lamps;
export const CAPSULE = art.capsule;           // floor 7's payment, drawn live (capsule.js): its path, size, timing and clip, in strip pixels
export const RECEPTION = art.reception;       // the lobby's receptionist, drawn live (reception.js): the sheet, the spot, the desk, weights and times, in strip pixels
export const CATS = art.cats;                 // the lobby's cats, drawn live (cats.js): their perches, floor, edges, starts, scale, still poses and clip, in strip pixels
export const CAT_SHEET = catSheet;            // ... and cats-lobby.webp's frame size, feet and strides
export const TIME = document.documentElement.dataset.time;   // picked once, in the page's head (#151): it never changes while the page is open
const PHASE = PHASES[TIME];
export const BAKED = PHASE?.baked;                              // the rooms with their own picture at this hour (the roof, the lobby's door); none at dusk
export const HOUR = BAKED ? `-${TIME}` : '';                    // the file name's suffix
export const SKY_AT_LOAD = PHASE?.sky ?? PHASES.dusk.sky;       // above the roof, until its strip gives its own top row
export const DARK = PHASE?.dark ?? PHASES.dusk.dark;            // what a room's colours fall to with its lights off; by day its windows still let some in
export const SHADES = [16, 10, 5];                              // a lamp coming on: how many of 16 Bayer cells are still dark, step by step
// The phone layout: the same query as every phone rule in pixel.css, so the canvas and the cards always agree (#46).
export const narrow = matchMedia('(max-width: 760px), (max-aspect-ratio: 6/5)');
export const clamp01 = (v) => Math.min(1, Math.max(0, v));

// A picture's colour at one pixel, as CSS.
export function colourAt(img, x, y) {
  const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  c.canvas.width = c.canvas.height = 1;
  c.drawImage(img, -x, -y);
  return `rgb(${[...c.getImageData(0, 0, 1, 1).data.slice(0, 3)]})`;
}

// A strip's rest frame and runs with its lights off; with lv of 16 Bayer cells of it left, to dither over the lit room.
// Laid out as the strip without its moving box. Kept on the image: made in idle time as a floor arrives (darkenSoon), or
// here, when first seen before that has finished.
export function shade(img, lv) {
  img.shades ??= {};
  if (img.shades[lv]) return img.shades[lv];
  if (lv < 16) {   // composited, not read back: this runs as a lamp comes on, and must not cost that frame
    const off = shade(img, 16), W = off.width, H = off.height;
    const c = document.createElement('canvas').getContext('2d');
    c.canvas.width = W; c.canvas.height = H;
    c.drawImage(off, 0, 0);
    c.globalCompositeOperation = 'destination-in';
    c.fillStyle = c.createPattern(bayer(lv), 'repeat');
    c.fillRect(0, 0, W, H);
    return (img.shades[lv] = c.canvas);
  }
  img.darkening ??= darken(img);
  let step;
  while (!(step = img.darkening.next()).done);   // whatever idle time has not done yet
  img.darkening = null;
  return (img.shades[16] = step.value);
}

// The 4x4 Bayer tile with lv of its 16 cells set: what of a lights-off picture is kept, from the strip's own (0, 0).
export function bayer(lv) {
  const tile = document.createElement('canvas').getContext('2d');
  tile.canvas.width = tile.canvas.height = 4;
  BAYER.forEach((row, y) => row.forEach((b, x) => { if (b < lv) tile.fillRect(x, y, 1, 1); }));
  return tile.canvas;
}

// shade()'s lights-off picture, a few rows per step, so idle time can make it without a long task on a slow phone (#184).
// Each colour falls by the hour's DARK: the paintings' colours are their own, so there is no ramp to step down.
export function* darken(img) {
  const ROWS = 24, W = FW + 2 * EDGE, H = img.height;
  const c = document.createElement('canvas').getContext('2d', { willReadFrequently: true });
  c.canvas.width = W; c.canvas.height = H;
  c.drawImage(img, 0, 0, W, H, 0, 0, W, H);
  const d = c.getImageData(0, 0, W, H), px = d.data;
  yield;
  for (let y = 0; y < H; y += ROWS) {
    for (let i = y * W * 4, end = Math.min(H, y + ROWS) * W * 4; i < end; i += 4) {
      px[i] *= DARK[0]; px[i + 1] *= DARK[1]; px[i + 2] *= DARK[2];
    }
    yield;
  }
  c.putImageData(d, 0, 0);
  return c.canvas;
}
