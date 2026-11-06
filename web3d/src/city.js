// The homepage's city (layouts/index.html): a wide panorama that pans sideways to the district picked from a chip or a
// label, whose text the panel shows. Any #floor-X address enters the building, which pixel.js mounts on city:enter;
// back at the bare address the page loads afresh on the city (guide.js).
import { floorShaped } from './hash.js';
import './city.css';

const root = document.documentElement;
const city = document.querySelector('[data-city]');
if (city && root.classList.contains('at-city')) {
  const scene = city.querySelector('.city-scene'), panel = city.querySelector('.city-panel'), kicker = city.querySelector('[data-city-kicker]');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let current = 'tower';   // the first view, which layouts/index.html pans to before the first paint
  // The picked district in the middle of the free view: right of the panel where it floats over the map, else the full width.
  const pan = (smooth) => {
    const tag = city.querySelector(`.city-tag[data-pick="${current}"]`), p = panel.getBoundingClientRect();
    const focus = getComputedStyle(panel).position === 'fixed' ? (p.right + scene.clientWidth) / 2 : scene.clientWidth / 2;
    scene.scrollTo({ left: tag.offsetLeft - focus, behavior: smooth && !still.matches ? 'smooth' : 'instant' });
  };
  city.addEventListener('click', (e) => {
    const picked = e.target.closest('button[data-pick]');
    if (!picked) return;
    current = picked.dataset.pick;
    kicker.textContent = picked.textContent;
    for (const b of city.querySelectorAll('button[data-pick]')) {
      if (b.matches('.city-tag')) b.classList.toggle('on', b.dataset.pick === current);
      else b.setAttribute('aria-pressed', b.dataset.pick === current);
    }
    for (const d of city.querySelectorAll('[data-district]')) d.hidden = d.dataset.district !== current;
    pan(true);
  });
  addEventListener('resize', () => pan(false));
  // No building here for the arrival from another page to land in (pixel.js): its view transition just ends.
  const landed = () => root.classList.remove('px-arrive');
  landed();
  document.addEventListener('building:reveal', landed);
  addEventListener('hashchange', function enter() {
    if (!floorShaped(location.hash)) return;
    removeEventListener('hashchange', enter);
    root.classList.remove('at-city');
    root.classList.toggle('at-street', /^#floor-e$/i.test(location.hash));
    scrollTo(0, 0);   // a phone may have scrolled down to the panel; the building's page does not scroll
    document.dispatchEvent(new Event('city:enter'));
  });
}
