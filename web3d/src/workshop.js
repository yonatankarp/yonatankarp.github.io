// The projects' Workshop Row (layouts/projects/list.html): a street that pans sideways to the workshop picked from a
// chip or a label, whose projects the panel lists, as the city does (pan.js). Apps first. Without it every workshop's
// list shows (workshop.css).
import { panning } from './pan.js';
import './city.css';
import './workshop.css';

const row = document.querySelector('[data-workshop]');
if (row) {
  const panel = row.querySelector('.city-panel'), scene = row.querySelector('.city-scene');
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
  panning(row, 'app', () => getComputedStyle(panel).position === 'absolute')(false);
  fit();
  scene.addEventListener('scroll', fit, { passive: true });
  addEventListener('resize', fit);
}
