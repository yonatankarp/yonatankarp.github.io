// The projects' Workshop Row (layouts/projects/list.html): a street that pans sideways to the workshop picked from a
// chip or a label, whose projects the panel lists, as the city does (pan.js). Apps first. Without it every workshop's
// list shows (workshop.css). In from the city's push-in, its frame opens from the Apps door, whose shutter rolls up.
import { arrive } from './iris.js';
import { panning } from './pan.js';
import { workshopFx } from './workshop-fx.js';
import './city.css';
import './workshop.css';
import ROW from '../../static/building/pixel/workshop.json';   // gen_workshop.py: the Apps door and its shutter

const row = document.querySelector('[data-workshop]');
if (row) {
  const panel = row.querySelector('.city-panel'), scene = row.querySelector('.city-scene');
  workshopFx(scene.querySelector('.city-fx'), scene.querySelector('img'));
  const tags = [...row.querySelectorAll('.city-tag')];
  // Every label whole on screen: one whose workshop is in view slides inside the edge, one whose workshop is not slides out.
  const fit = () => {
    const l = scene.scrollLeft, r = l + scene.clientWidth;
    const shifts = tags.map((t) => {
      const x = t.offsetLeft, half = t.offsetWidth / 2;
      if (x < l) return Math.min(0, l - x - half - 2);
      if (x > r) return Math.max(0, r - x + half + 2);
      return Math.min(Math.max(x - half, l + 8), r - 8 - 2 * half) - (x - half);
    });
    tags.forEach((t, i) => t.style.setProperty('--shift', `${shifts[i]}px`));
  };
  // The list fades at the panel's foot while more of it is below (workshop.css).
  const cue = () => panel.classList.toggle('more', panel.scrollTop + panel.clientHeight < panel.scrollHeight - 2);
  const said = panel.querySelector('[data-said]');
  panning(row, 'app', () => getComputedStyle(panel).position === 'absolute', (picked) => {
    // Counted here, as GoatCounter binds data-goatcounter-click when it loads, perhaps before these buttons exist (#307).
    window.goatcounter?.count?.({ path: `workshop-${picked.dataset.pick}`, title: picked.textContent.trim(), event: true });
    said.textContent = panel.querySelector(`[data-district="${picked.dataset.pick}"]`).dataset.say;   // its line, not its list
    requestAnimationFrame(cue);
  })(false);
  fit();
  cue();
  document.fonts?.ready.then(cue);   // the pixel font changes the list's height
  panel.addEventListener('scroll', cue, { passive: true });
  addEventListener('resize', cue);
  scene.addEventListener('scroll', fit, { passive: true });
  addEventListener('resize', fit);
  const map = scene.querySelector('.city-map'), img = map.querySelector('img');
  arrive(img, () => {
    const k = map.offsetHeight / ROW.size[1], [x, y] = ROW.door, m = map.getBoundingClientRect();
    shutter(map, img);
    return { at: [m.left + x * k, m.top + y * k], settle: [[map, x * k, y * k]] };
  });
}

// The Apps door's roller shutter, down as the city left it, rolls up into its box under the awning once the iris has
// opened, in the painting's own pixels, a whole one a step. Its greys are the dusk painting's, lit as the hour's painting
// lights the rolled-up door at the box's top (DUSK_ROLL: its brightness at dusk).
const DUSK_ROLL = 116;
function shutter(map, img) {
  const [x0, y0, x1, y1] = ROW.shutter, [W, H] = ROW.size, dw = x1 - x0, dh = y1 - y0;
  const c = document.createElement('canvas'), ctx = c.getContext('2d', { willReadFrequently: true });
  c.width = dw; c.height = dh;
  ctx.drawImage(img, x0, y0 - 8, dw, 6, 0, 0, dw, 6);
  const roll = ctx.getImageData(0, 0, dw, 6).data;
  let sum = 0;
  for (let i = 0; i < roll.length; i += 4) sum += 0.299 * roll[i] + 0.587 * roll[i + 1] + 0.114 * roll[i + 2];
  const k = sum / (roll.length / 4) / DUSK_ROLL, grey = (v) => `rgb(${v.map((n) => Math.min(255, Math.round(n * k)))})`;
  const [bottomC, edgeC, darkC, lightC] = [[61, 59, 56], [85, 88, 90], [122, 124, 122], [110, 113, 111]].map(grey);
  c.setAttribute('aria-hidden', 'true');
  Object.assign(c.style, { position: 'absolute', left: `${x0 / W * 100}%`, top: `${y0 / H * 100}%`, width: `${dw / W * 100}%`, height: `${dh / H * 100}%`,
    imageRendering: 'pixelated', pointerEvents: 'none' });
  img.after(c);
  const draw = (p) => {   // p: 0 down, 1 up
    ctx.clearRect(0, 0, dw, dh);
    const bottom = Math.round(dh * (1 - p));
    for (let y = 0; y < bottom; y++) {
      const slat = Math.floor((bottom - 1 - y) / 3), edge = (bottom - 1 - y) % 3 === 2;
      ctx.fillStyle = y >= bottom - 2 ? bottomC : edge ? edgeC : slat % 2 ? darkC : lightC;
      ctx.fillRect(0, y, dw, 1);
    }
    if (bottom > 0) { ctx.fillStyle = 'rgba(0, 0, 0, 0.18)'; ctx.fillRect(0, 0, 3, bottom); ctx.fillRect(dw - 3, 0, 3, bottom); }
  };
  draw(0);
  const t0 = performance.now() + 720, ease = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
  const tick = () => {
    const t = Math.min(1, Math.max(0, (performance.now() - t0) / 750));
    draw(ease(t));
    if (t < 1) requestAnimationFrame(tick); else c.remove();
  };
  requestAnimationFrame(tick);
}
