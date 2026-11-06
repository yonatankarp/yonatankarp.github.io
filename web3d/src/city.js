// The homepage's city (layouts/index.html): a wide panorama. Picking a district from a chip or a label zooms the map into
// its building and shows its text in the panel; picking it again, or "Whole city", zooms back out. A label goes into its
// district (the tower, the library, the workshops, the radio mast, the post office) on its second click. Any #floor-X address enters the
// building, which pixel.js mounts on city:enter; back at the bare address the page loads afresh on the city (guide.js).
import { cityFx } from './city-fx.js';
import { floorShaped } from './hash.js';
import './city.css';

const root = document.documentElement;
const city = document.querySelector('[data-city]');
if (city && root.classList.contains('at-city')) {
  const scene = city.querySelector('.city-scene'), map = scene.querySelector('.city-map'), panel = city.querySelector('.city-panel');
  const kicker = city.querySelector('[data-city-kicker]'), out = city.querySelector('[data-city-out]'), overview = kicker.textContent;
  const zoom = JSON.parse(map.dataset.zoom), maxPx = Number(map.dataset.maxPx), artH = scene.querySelector('.city-fx').height;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const floats = () => getComputedStyle(panel).position === 'fixed';
  cityFx(scene.querySelector('.city-fx'), scene.querySelector('img'));

  // The map moves and scales in one transform, clamped so no edge of the art shows; `smooth` glides there (city.css).
  let current = null, at = { x: 0, y: 0, s: 1 };
  const size = () => { const c = getComputedStyle(map); return [parseFloat(c.width), parseFloat(c.height)]; };   // unrounded, so no sliver of edge shows
  const place = (x, y, s, smooth) => {
    const [w, h] = size();
    at = { x: Math.min(0, Math.max(scene.clientWidth - w * s, x)), y: Math.min(0, Math.max(scene.clientHeight - h * s, y)), s };
    map.style.setProperty('--glide', smooth && !still.matches ? '1s' : '0s');
    map.style.setProperty('--inv', 1 / s);   // the labels keep their size on screen
    map.style.transform = `translate(${at.x}px, ${at.y}px) scale(${s})`;
  };
  // The picked building's middle (city.json's zoom) at the middle of the free view: right of a floating panel and a little
  // high, or the scene's middle where the panel stacks under it. Its zoom stops where an art pixel would pass maxPx screen
  // px, which a big screen reaches first, and never goes under 1. Unpicked, the whole city on the tower, as the page opens.
  const view = (smooth) => {
    const p = panel.getBoundingClientRect(), fx = floats() ? (p.right + scene.clientWidth) / 2 : scene.clientWidth / 2;
    if (!current) return place(fx - city.querySelector('.city-tag[data-pick=tower]').offsetLeft, 0, 1, smooth);
    const [w, h] = size(), [x, y, z] = zoom[current], s = Math.max(1, Math.min(z, maxPx / (h / artH)));
    place(fx - x / 100 * w * s, scene.clientHeight * (floats() ? 0.46 : 0.5) - y / 100 * h * s, s, smooth);
  };
  const pick = (key) => {
    current = key;
    city.classList.toggle('zoomed', !!key);
    for (const b of city.querySelectorAll('[data-pick]')) {
      if (b.matches('.city-tag')) b.classList.toggle('on', b.dataset.pick === key);
      if (b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', b.dataset.pick === key);
    }
    for (const d of city.querySelectorAll('[data-district]')) d.hidden = d.dataset.district !== (key ?? '');
    kicker.textContent = key ? city.querySelector(`.city-chips [data-pick="${key}"]`).textContent : overview;
    out.hidden = !key;
    view(true);
  };
  view(false);
  addEventListener('resize', () => view(false));
  // In the capture phase, so a label's first click, which only zooms, never reaches its link or its GoatCounter count.
  city.addEventListener('click', (e) => {
    if (e.target.closest('[data-city-out]')) return pick(null);
    const b = e.target.closest('[data-pick]');
    if (!b || (b.matches('a') && b.dataset.pick === current)) return;   // the picked label's second click goes in
    e.preventDefault();
    e.stopPropagation();
    pick(b.dataset.pick === current ? null : b.dataset.pick);
  }, true);

  // A wheel or a trackpad pans the map sideways, at any zoom. Where the panel stacks under the map, an up or down wheel
  // is the page's; a pinch stays the browser's. Instant, in step with the wheel, so no motion is added.
  scene.addEventListener('wheel', (e) => {
    const side = Math.abs(e.deltaX) >= Math.abs(e.deltaY);
    if (e.ctrlKey || (!side && !floats())) return;
    e.preventDefault();
    place(at.x - (side ? e.deltaX : e.deltaY) * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? scene.clientWidth : 1), at.y, at.s, false);
  }, { passive: false });
  // A finger pans it sideways too; up and down stay the page's scroll (touch-action: pan-y).
  let finger = null;
  scene.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') finger = e.clientX; });
  scene.addEventListener('pointermove', (e) => {
    if (finger === null) return;
    place(at.x + e.clientX - finger, at.y, at.s, false);
    finger = e.clientX;
  });
  for (const end of ['pointerup', 'pointercancel']) scene.addEventListener(end, () => { finger = null; });

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
