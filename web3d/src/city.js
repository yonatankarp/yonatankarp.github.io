// The homepage's city (layouts/index.html): a wide panorama that pans sideways to the district picked from a chip or a
// label, whose text the panel shows. Any #floor-X address enters the building, which pixel.js mounts on city:enter;
// back at the bare address the page loads afresh on the city (guide.js).
import { cityFx } from './city-fx.js';
import { floorShaped } from './hash.js';
import { panning } from './pan.js';
import './city.css';

const root = document.documentElement;
const city = document.querySelector('[data-city]');
if (city && root.classList.contains('at-city')) {
  const scene = city.querySelector('.city-scene'), panel = city.querySelector('.city-panel'), kicker = city.querySelector('[data-city-kicker]');
  cityFx(scene.querySelector('.city-fx'), scene.querySelector('img'));
  // The first view is the tower, which layouts/index.html pans to before the first paint.
  panning(city, 'tower', () => getComputedStyle(panel).position === 'fixed', (picked) => { kicker.textContent = picked.textContent; });
  // A mouse wheel pans the map where the page has nothing to scroll: the panel floating over it. Where they stack, the
  // wheel is the page's; sideways swipes and pinches stay the browser's. Instant, in step with the wheel, so no motion is added.
  scene.addEventListener('wheel', (e) => {
    if (e.ctrlKey || Math.abs(e.deltaX) >= Math.abs(e.deltaY) || getComputedStyle(panel).position !== 'fixed') return;
    e.preventDefault();
    scene.scrollBy({ left: e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? scene.clientWidth : 1), behavior: 'instant' });
  }, { passive: false });
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
