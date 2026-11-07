// The projects' Workshop Row (layouts/projects/list.html): a street that pans sideways to the workshop picked from a
// chip or a label, whose projects the panel lists, as the city does (pan.js). Apps first. Without it every workshop's
// list shows (workshop.css).
import { panning } from './pan.js';
import { workshopFx } from './workshop-fx.js';
import './city.css';
import './workshop.css';

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
}
