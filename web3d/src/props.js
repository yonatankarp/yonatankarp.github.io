// The holidays' props on the city's tower plaza (city-fx.js): a hanukkiah through Hanukkah, a Christmas tree through
// Advent and jack-o'-lanterns through Halloween's last week, from the visitor's calendar (outside.js); and the new year's
// fireworks over the city. Painted and baked by web3d/pixel/gen_props.py into props.webp (with props.json: where each
// stands, its candle tops, bulbs and star), halloween.webp and fireworks.webp (each with its .json). The candles, the
// tree's lights and the lanterns' faces burn at dusk and night only (phases.json's `lit`), drawn here: flickering and twinkling in the loop,
// steady in a still frame (draw's t null), which has no fireworks: a burst held still reads as a stain on the sky.
import { loadSheet, rnd } from './scene-fx.js';

// Each prop multiplied by the hour's light, as the tower's rooms darken with it: they were painted in dusk's.
const TINT = { dawn: [0.86, 0.86, 0.96], day: [1, 1, 1], dusk: [1, 1, 1], night: [0.6, 0.63, 0.78] };
const SHAMASH = 4;   // the raised middle cup
const COLOURS = ['#ffe9a8', '#ff5a4a', '#ffd04a', '#7fc2ff', '#fff6dc'];
// How long each of a burst's frames shows, in ms: the growing ones (fireworks.json's `grow`), then the fading ones. The
// city draws at least 15 times a second (city-fx.js), so a frame of 67 ms or more is never skipped.
export const BURST = { grow: 70, fade: 240 };
// Each burst's rising spark: it climbs `rise` art px to the burst at `speed` px a second (gen_props.py's RISE checks its
// sky). The city draws at least fireworksFps that night: a pixel of the spark a frame, and every burst frame.
export const SPARK = { rise: 30, speed: 30 };
export const fireworksFps = Math.max(1000 / BURST.grow, SPARK.speed);

// The cups lit on day `day` of Hanukkah (from 0), as indexes into flames (its nine candle tops, left to right as you face
// it): the shamash, and day + 1 candles, which are added from the right.
export function candles(flames, day) {
  const order = flames.map((_, i) => i).filter((i) => i !== SHAMASH).sort((a, b) => flames[b][0] - flames[a][0]);
  return [SHAMASH, ...order.slice(0, Math.min(8, day + 1))];
}

// Which of a burst's frames shows `ms` after it went up, or -1 once it is gone: `grow` growing frames, then the rest fading.
export function burstFrame(ms, grow, frames) {
  if (ms < grow * BURST.grow) return Math.floor(ms / BURST.grow);
  const k = grow + Math.floor((ms - grow * BURST.grow) / BURST.fade);
  return k < frames ? k : -1;
}

// What the city shows for these holidays, at this hour and season, apart from drawing it: the hanukkiah through Hanukkah,
// the tree through Advent (snowy in winter; in any other season, a southern Christmas in summer, the tree without snow),
// the jack-o'-lanterns through Halloween's last week, and its ghosts and bats (for the birds) at its dusk and night; the
// fireworks on the night of 31 December, from its evening (past sunset where the visitor is) through the small hours of
// 1 January, in the dark (1 January's own evening is an ordinary night: the party is over); whether the candles, the
// lights and the lanterns burn (`lit`, the hour's in data/phases.json: dusk and night) and the hour's tint. `evening` and
// `afternoon` are outside.js's.
export function dressing({ holidays, time, lit, season, evening, afternoon }) {
  const halloween = 'halloween' in holidays, nye = holidays['new-year'];
  return {
    hanukkiah: 'hanukkah' in holidays,
    tree: 'christmas' in holidays ? (season === 'winter' ? 'tree' : 'tree-plain') : null,
    pumpkins: halloween, ghosts: halloween && lit, bats: halloween && lit,
    fireworks: lit && (nye === 0 ? !!evening : nye === 1 && !afternoon),
    lit, night: time === 'night', tint: TINT[time],
  };
}

// A part {sx, w, h} of a sheet, in the hour's light, its alpha kept.
function sprite(sheet, { sx, w, h }, tint) {
  const c = new OffscreenCanvas(w, h), g = c.getContext('2d');
  g.drawImage(sheet, sx, 0, w, h, 0, 0, w, h);
  g.globalCompositeOperation = 'multiply';
  g.fillStyle = `rgb(${tint.map((v) => v * 255 | 0)})`;
  g.fillRect(0, 0, w, h);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(sheet, sx, 0, w, h, 0, 0, w, h);
  return c;
}
const stand = (ctx, [x, y], w) => {   // a soft contact shadow, so it stands on the paving
  ctx.fillStyle = 'rgba(30,34,52,.32)'; ctx.fillRect(x - (w >> 1), y - 1, w, 2);
  ctx.fillStyle = 'rgba(30,34,52,.16)'; ctx.fillRect(x - (w >> 1) - 2, y, w + 4, 1);
};

// The sheet each prop is painted on, fetched only when one of its props is up.
export const SHEETS = { props: ['hanukkiah', 'tree'], halloween: ['pumpkins'], fireworks: ['fireworks'] };

// The props up for these holidays, at this hour and season: a promise of [{ y, draw(ctx, t) }], y its foot's row, so the
// city draws them among its walkers, nearer over farther (the fireworks, in the sky, first). url(name) gives a sheet's
// url(ext). Each goes without its art.
export function props(url, options) {
  const d = dressing(options), { lit, night, tint } = d, names = Object.keys(SHEETS);
  return Promise.all(names.map((name) => (SHEETS[name].some((key) => d[key]) ? loadSheet(url(name)) : Promise.resolve([]))))
    .then((loaded) => Object.fromEntries(names.map((name, i) => [name, loaded[i]])))
    .then(({ props: [P, img], halloween: [J, lanterns], fireworks: [F, bursts] }) => {
      const out = [];
      if (P && img && d.hanukkiah) {
        const H = P.hanukkiah, pic = sprite(img, H, tint), x0 = H.at[0] - (H.w >> 1), y0 = H.at[1] - H.h;
        const on = lit ? candles(H.flames, options.holidays.hanukkah) : [];
        out.push({ y: H.at[1], draw(ctx, t) {
          stand(ctx, H.at, 12);
          ctx.drawImage(pic, x0, y0);
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
      if (P && img && d.tree) {
        const T = P[d.tree], pic = sprite(img, T, tint), x0 = T.at[0] - (T.w >> 1), y0 = T.at[1] - T.h;
        const bulbs = T.bulbs.map(([x, y], k) => ({ x: x0 + x, y: y0 + y, c: COLOURS[k % COLOURS.length], w: 0.6 + Math.random() * 1.6, p: Math.random() * 6.3 }));
        out.push({ y: T.at[1], draw(ctx, t) {
          stand(ctx, T.at, 18);
          ctx.drawImage(pic, x0, y0);
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
      if (J && lanterns) {
        for (const [name, x, y] of J.places) {   // each lantern's carved face (glow, painted dark) lit by a candle inside
          const S = J.pumpkins[name], pic = sprite(lanterns, S, tint), x0 = x - (S.w >> 1), y0 = y - S.h, p = Math.random() * 6.3;
          out.push({ y, draw(ctx, t) {
            stand(ctx, [x, y], S.w - 2);
            ctx.drawImage(pic, x0, y0);
            if (!lit) return;
            const f = t === null ? 1 : Math.sin(t * 11 + p) + Math.sin(t * 6.7 + 2 * p);
            ctx.globalCompositeOperation = 'lighter';   // its light on the paving at its foot
            ctx.fillStyle = `rgba(255,150,50,${night ? 0.16 : 0.08})`; ctx.fillRect(x0 - 1, y - 2, S.w + 2, 3);
            ctx.globalCompositeOperation = 'source-over';
            ctx.fillStyle = f > -0.8 ? '#ffc861' : '#f08a2a';
            for (const [gx, gy] of S.glow) ctx.fillRect(x0 + gx, y0 + gy, 1, 1);
          } });
        }
      }
      if (F && bursts) {   // a few at a time, each in fireworks.json's sky box after its spark climbs, now and then two close together
        // Drawn on a layer over their box, from which the tower and the crane, nearer than the sky (fronts), are cut out,
        // then added to the sky's light. A burst's middle keeps `core` px off the crane's lights (avoid).
        const [sx0, sy0, sx1, sy1] = F.sky, [bx, by, bx1, by1] = F.box, live = [];
        const layer = new OffscreenCanvas(bx1 - bx + 1, by1 - by + 1).getContext('2d'), fronts = new OffscreenCanvas(bx1 - bx + 1, by1 - by + 1);
        const fg = fronts.getContext('2d');
        for (const [y, x0, x1] of F.fronts) fg.fillRect(x0 - bx, y - by, x1 - x0 + 1, 1);
        const clear = (x, y) => F.avoid.every(([ax, ay]) => Math.hypot(x - ax, y - ay) > F.core);
        let next = null;
        out.push({ y: -1, draw(ctx, t) {
          if (t === null) return;
          next ??= t + rnd(0.3, 1.5);
          if (t >= next && live.length < 3) {
            for (let n = 0; n < 20; n++) {
              const x = Math.round(rnd(sx0, sx1)), y = Math.round(rnd(sy0, sy1));
              if (clear(x, y)) { live.push({ S: F.bursts[Math.random() * F.bursts.length | 0], x, y, t0: t + SPARK.rise / SPARK.speed }); break; }
            }
            next = t + (Math.random() < 0.2 ? rnd(0.12, 0.3) : rnd(0.7, 2.4));
          }
          if (!live.length) return;
          layer.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
          layer.globalCompositeOperation = 'lighter';
          for (let i = live.length - 1; i >= 0; i--) {
            const { S, x, y, t0 } = live[i];
            if (t < t0) {   // the spark, a pixel with a fading two-pixel tail
              const sy = y + Math.round((t0 - t) * SPARK.speed);
              layer.fillStyle = 'rgba(255,230,170,.35)'; layer.fillRect(x - bx, sy + 1 - by, 1, 2);
              layer.fillStyle = '#fff1c8'; layer.fillRect(x - bx, sy - by, 1, 1);
              continue;
            }
            const k = burstFrame((t - t0) * 1000, F.grow, F.frames);
            if (k < 0) { live.splice(i, 1); continue; }
            layer.drawImage(bursts, S.sx + k * S.w, 0, S.w, S.h, x - (S.w >> 1) - bx, y - (S.h >> 1) - by, S.w, S.h);
          }
          layer.globalCompositeOperation = 'destination-out';
          layer.drawImage(fronts, 0, 0);
          ctx.globalCompositeOperation = 'lighter';   // light, added to the sky's
          ctx.drawImage(layer.canvas, bx, by);
          ctx.globalCompositeOperation = 'source-over';
        } });
      }
      return out;
    });
}
