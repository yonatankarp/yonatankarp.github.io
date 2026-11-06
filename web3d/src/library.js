// The blog's Library (layouts/blog/list.html): a reading room that pans sideways to the shelf picked from a chip or a
// label, whose posts the panel lists, as the city does (pan.js). Without it every shelf's list shows (library.css).
import { panning } from './pan.js';
import './city.css';
import './library.css';

const library = document.querySelector('[data-library]');
if (library) {
  const panel = library.querySelector('.city-panel'), scene = library.querySelector('.city-scene');
  const tags = [...library.querySelectorAll('.city-tag')];
  // Every label whole on screen: one whose shelf is in view slides inside the edge, one whose shelf is not slides out.
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
  panning(library, 'all', () => getComputedStyle(panel).position === 'absolute')(false);
  fit();
  scene.addEventListener('scroll', fit, { passive: true });
  addEventListener('resize', fit);
}
