// The holidays' props on the city's tower plaza (city-fx.js): a hanukkiah through Hanukkah and a Christmas tree through
// Advent, from the visitor's calendar (outside.js). Painted and baked by web3d/pixel/gen_props.py into props.webp, with
// props.json: where each stands, its candle tops, bulbs and star. The candles and the tree's lights burn at dusk and
// night only, drawn here: flickering and twinkling in the loop, steady in a still frame (draw's t null).
import { asset } from './scene-fx.js';

// Each prop multiplied by the hour's light, as the tower's rooms darken with it: they were painted in dusk's.
const TINT = { dawn: [0.86, 0.86, 0.96], day: [1, 1, 1], dusk: [1, 1, 1], night: [0.6, 0.63, 0.78] };
const SHAMASH = 4;   // the raised middle cup
const COLOURS = ['#ffe9a8', '#ff5a4a', '#ffd04a', '#7fc2ff', '#fff6dc'];

// The cups lit on day `day` of Hanukkah (from 0), as indexes into flames (its nine candle tops, left to right as you face
// it): the shamash, and day + 1 candles, which are added from the right.
export function candles(flames, day) {
  const order = flames.map((_, i) => i).filter((i) => i !== SHAMASH).sort((a, b) => flames[b][0] - flames[a][0]);
  return [SHAMASH, ...order.slice(0, Math.min(8, day + 1))];
}

// What the plaza shows for these holidays, at this hour and season, apart from drawing it, from props.json (P): the
// hanukkiah through Hanukkah and its candles that burn, the tree through Advent (snowy in winter; in any other season,
// a southern Christmas in summer, the tree without snow), whether the candles and the lights burn (at dusk and night
// only) and the hour's tint.
export function dressing(P, { holidays, time, season }) {
  const lit = time === 'dusk' || time === 'night', hanukkiah = 'hanukkah' in holidays;
  return {
    hanukkiah,
    candles: hanukkiah && lit ? candles(P.hanukkiah.flames, holidays.hanukkah) : [],
    tree: 'christmas' in holidays ? (season === 'winter' ? 'tree' : 'tree-plain') : null,
    lit, night: time === 'night', tint: TINT[time],
  };
}

// The props up for these holidays, at this hour and season: a promise of [{ y, draw(ctx, t) }], y its foot's row, so the
// city draws them among its walkers, nearer over farther. Empty without its art.
export function props(url, options) {
  if (!('hanukkah' in options.holidays) && !('christmas' in options.holidays)) return Promise.resolve([]);
  return Promise.all([
    asset(url('json')).then((r) => r && r.json()),
    asset(url('webp')).then((r) => r && r.blob()).then((b) => b && createImageBitmap(b)),
  ]).then(([P, sheet]) => {
    if (!P || !sheet) return [];
    const { hanukkiah, candles: on, tree, lit, night, tint } = dressing(P, options), out = [];
    const sprite = ({ sx, w, h }) => {   // its part of the sheet, in the hour's light, its alpha kept
      const c = new OffscreenCanvas(w, h), g = c.getContext('2d');
      g.drawImage(sheet, sx, 0, w, h, 0, 0, w, h);
      g.globalCompositeOperation = 'multiply';
      g.fillStyle = `rgb(${tint.map((v) => v * 255 | 0)})`;
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'destination-in';
      g.drawImage(sheet, sx, 0, w, h, 0, 0, w, h);
      return c;
    };
    const stand = (ctx, [x, y], w) => {   // a soft contact shadow, so it stands on the paving
      ctx.fillStyle = 'rgba(30,34,52,.32)'; ctx.fillRect(x - (w >> 1), y - 1, w, 2);
      ctx.fillStyle = 'rgba(30,34,52,.16)'; ctx.fillRect(x - (w >> 1) - 2, y, w + 4, 1);
    };
    if (hanukkiah) {
      const H = P.hanukkiah, img = sprite(H), x0 = H.at[0] - (H.w >> 1), y0 = H.at[1] - H.h;
      out.push({ y: H.at[1], draw(ctx, t) {
        stand(ctx, H.at, 12);
        ctx.drawImage(img, x0, y0);
        for (const i of on) {   // a 1-2 px flame over its wick, flickering, and a small warm glow round it
          const [x, y] = H.flames[i], f = t === null ? 1 : Math.sin(t * 13 + i * 2.1) + Math.sin(t * 7.3 + i);
          ctx.globalCompositeOperation = 'lighter';
          ctx.fillStyle = `rgba(255,170,60,${night ? 0.22 : 0.12})`; ctx.fillRect(x0 + x - 1, y0 + y - 3, 3, 3);
          ctx.globalCompositeOperation = 'source-over';
          ctx.fillStyle = f > 0.6 ? '#fff4c8' : '#ffcf5a'; ctx.fillRect(x0 + x, y0 + y - 1, 1, 1);
          if (f > -1.2) { ctx.fillStyle = 'rgba(255,190,80,.75)'; ctx.fillRect(x0 + x, y0 + y - 2, 1, 1); }
        }
      } });
    }
    if (tree) {
      const T = P[tree], img = sprite(T), x0 = T.at[0] - (T.w >> 1), y0 = T.at[1] - T.h;
      const bulbs = T.bulbs.map(([x, y], k) => ({ x: x0 + x, y: y0 + y, c: COLOURS[k % COLOURS.length], w: 0.6 + Math.random() * 1.6, p: Math.random() * 6.3 }));
      out.push({ y: T.at[1], draw(ctx, t) {
        stand(ctx, T.at, 18);
        ctx.drawImage(img, x0, y0);
        if (!lit) return;
        for (const b of bulbs) {   // each bulb twinkles at its own pace; at night a faint glow round the lit ones
          const bright = t === null || Math.sin(t * b.w * 2 + b.p) > -0.35;
          ctx.globalAlpha = bright ? 1 : 0.35; ctx.fillStyle = b.c; ctx.fillRect(b.x, b.y, 1, 1);
          if (bright && night) { ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.12; ctx.fillRect(b.x - 1, b.y - 1, 3, 3); ctx.globalCompositeOperation = 'source-over'; }
        }
        ctx.globalAlpha = 1;
        const g = t === null ? 1 : 0.75 + 0.25 * Math.sin(t * 2.2);   // the star glows, breathing slowly
        ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = `rgba(255,220,120,${(night ? 0.35 : 0.2) * g})`;
        for (const [x, y] of T.star) ctx.fillRect(x0 + x - 1, y0 + y - 1, 3, 3);
        ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = '#fff2b8';
        for (const [x, y] of T.star) ctx.fillRect(x0 + x, y0 + y, 1, 1);
      } });
    }
    return out;
  });
}
