// The homepage's city (layouts/index.html): a wide panorama. Picking a district from a chip or a label zooms the map into
// its building and shows its text in the panel; picking it again, or "Whole city", zooms back out. A label goes into its
// district (the tower, the library, the workshops, the radio mast, the post office) on its second click. Any #floor-X address enters the
// building, which pixel.js mounts on city:enter; back at the bare address the page loads afresh on the city (guide.js).
// Going in, the map pushes on through the district's door into the next view (iris.js).
import { ENTRANCE, BAKED, HOUR, lay } from './art.js';
import { cityFx } from './city-fx.js';
import { roomy } from './guide.js';
import { floorShaped } from './hash.js';
import { cover, iris } from './iris.js';
import CITY from '../../static/building/pixel/city.json';       // gen_city.py: the doors the push-in goes through
import ROW from '../../static/building/pixel/workshop.json';    // gen_workshop.py: Workshop Row's Apps door, where it lands
import './city.css';

const root = document.documentElement;
const city = document.querySelector('[data-city]');
if (city && root.classList.contains('at-city')) {
  const scene = city.querySelector('.city-scene'), map = scene.querySelector('.city-map'), panel = city.querySelector('.city-panel');
  const kicker = city.querySelector('[data-city-kicker]'), out = city.querySelectorAll('[data-city-out]'), overview = kicker.textContent;
  const zoom = JSON.parse(map.dataset.zoom), maxPx = Number(map.dataset.maxPx), artH = scene.querySelector('.city-fx').height;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const floats = () => getComputedStyle(panel).position === 'fixed';
  cityFx(scene.querySelector('.city-fx'), scene.querySelector('img'));

  // The map moves and scales in one transform, clamped so no edge of the art shows; `smooth` glides there (city.css).
  let current = null, at = { x: 0, y: 0, s: 1 };
  const size = () => { const c = getComputedStyle(map); return [parseFloat(c.width), parseFloat(c.height)]; };   // unrounded, so no sliver of edge shows
  // push: going in, the push-in's 450 ms, past the art's edges.
  const place = (x, y, s, smooth, push) => {
    const [w, h] = size();
    at = push ? { x, y, s } : { x: Math.min(0, Math.max(scene.clientWidth - w * s, x)), y: Math.min(0, Math.max(scene.clientHeight - h * s, y)), s };
    map.style.setProperty('--glide', push ? '450ms' : smooth && !still.matches ? '1s' : '0s');
    map.style.setProperty('--inv', 1 / s);   // the labels keep their size on screen
    map.style.transform = `translate(${at.x}px, ${at.y}px) scale(${s})`;
    fit();
  };
  // Every label whole in the free view (#295), from where the map is going: one whose district is in it slides inside its
  // edges by --shift, as on Workshop Row (workshop.js); one whose district is not, or that would sit under a floating
  // panel, is away (city.css), still in the tab order, and focusing it brings it into view.
  const tags = [...city.querySelectorAll('.city-tag')];
  function fit() {
    const p = panel.getBoundingClientRect(), r = scene.clientWidth - 8;
    for (const t of tags) {
      const x = at.x + t.offsetLeft * at.s, half = t.offsetWidth / 2, l = floats() && at.y + t.offsetTop * at.s > p.top ? p.right + 8 : 8;
      t.style.setProperty('--shift', `${Math.min(Math.max(x - half, l), r - 2 * half) - (x - half)}px`);
      t.classList.toggle('away', x < l || x > r);
    }
  }
  const free = () => floats() ? (panel.getBoundingClientRect().right + scene.clientWidth) / 2 : scene.clientWidth / 2;
  city.addEventListener('focusin', (e) => {
    if (e.target.matches('.city-tag.away')) place(free() - e.target.offsetLeft * at.s, at.y, at.s, true);
  });
  // The picked building's middle (city.json's zoom) at the middle of the free view: right of a floating panel and a little
  // high, or the scene's middle where the panel stacks under it. Its zoom stops where an art pixel would pass maxPx screen
  // px, which a big screen reaches first, and never goes under 1. Unpicked, the whole city on the tower, as the page opens,
  // moved right until the Library's label clears a floating panel, as far as the tower's stays whole (and home-city.js).
  const view = (smooth) => {
    const fx = free();
    if (!current) {
      const tower = city.querySelector('.city-tag[data-pick=tower]'), lib = city.querySelector('.city-tag[data-pick=library]');
      const clear = floats() ? panel.getBoundingClientRect().right + 8 + lib.offsetWidth / 2 - lib.offsetLeft : -Infinity;
      return place(Math.min(Math.max(fx - tower.offsetLeft, clear), scene.clientWidth - 8 - tower.offsetWidth / 2 - tower.offsetLeft), 0, 1, smooth);
    }
    const [w, h] = size(), [x, y, z] = zoom[current], s = Math.max(1, Math.min(z, maxPx / (h / artH)));
    place(fx - x / 100 * w * s, scene.clientHeight * (floats() ? 0.46 : 0.5) - y / 100 * h * s, s, smooth);
  };
  const pick = (key) => {
    // "Whole city" hides as it zooms out, so its focus goes to the chip that was picked (#301).
    if (!key && [...out].some((o) => o.contains(document.activeElement))) city.querySelector(`.city-chips [data-pick="${current}"]`).focus();
    current = key;
    city.classList.toggle('zoomed', !!key);
    for (const b of city.querySelectorAll('[data-pick]')) {
      if (b.matches('.city-tag')) b.classList.toggle('on', b.dataset.pick === key);
      if (b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', b.dataset.pick === key);
    }
    for (const d of city.querySelectorAll('[data-district]')) d.hidden = d.dataset.district !== (key ?? '');
    kicker.textContent = key ? city.querySelector(`.city-chips [data-pick="${key}"]`).textContent : overview;
    for (const o of out) o.hidden = !key;
    if (key) ready(key);
    view(true);
  };

  // ---- going in ----
  // A district's go link, or its picked label's second click, pushes on into it: the map zooms on, gathering speed, until
  // what it goes into fills the view, then hands its last frame to the next view, which opens it in an iris (iris.js).
  // The tower and Workshop Row have doors (city.json's doors): the city's ends where the next view's is, at its size, to
  // 14 screen px a city art px; the tower's opens first (door-open[-winter][-PHASE].webp, gen_city.py). The others push into the
  // building's middle, which ends on the middle of their page's room header. A plain link under reduced motion, with
  // ?fx=off (the visual captures), where the tower is the plain page, or for a click that opens a tab.
  const fxOff = new URLSearchParams(location.search).get('fx') === 'off';
  const canvas = document.querySelector('#pixel-canvas'), img = scene.querySelector('img'), fx = scene.querySelector('.city-fx');
  const artW = CITY.size[0], hour = `${root.dataset.season === 'winter' ? '-winter' : ''}${root.dataset.time === 'dusk' ? '' : `-${root.dataset.time}`}`;   // as the city's picture is picked
  const art = (name) => `${img.dataset.base.replace(/city$/, name)}.webp?v=${img.dataset.version}`;
  const [ox, oy, ow, oh] = CITY.doorOpen, door = new Image();
  Object.assign(door.style, { position: 'absolute', left: `${ox / artW * 100}%`, top: `${oy / artH * 100}%`, width: `${ow / artW * 100}%`,
    height: `${oh / artH * 100}%`, objectFit: 'fill', visibility: 'hidden', pointerEvents: 'none' });
  door.alt = '';
  // What going in needs, fetched while the panel is read: the tower's open doors and its lobby, as pixel.js asks for it,
  // or the district's page.
  const readied = new Set();
  function ready(key) {
    if (readied.has(key)) return;
    readied.add(key);
    if (key === 'tower') {
      door.src = art(`door-open${hour}`);
      img.after(door);   // under the city's life, so a walker in front stays in front
      for (const name of ['floor-L', 'floor-L-open']) fetch(art(`${name}${BAKED?.includes('L') ? HOUR : ''}`)).then((r) => r.blob()).catch(() => {});
    } else document.head.append(Object.assign(document.createElement('link'), { rel: 'prefetch', href: city.querySelector(`[data-go="${key}"]`).href }));
  }
  for (const type of ['pointerover', 'focusin']) city.addEventListener(type, (e) => { const k = e.target.closest?.('[data-go]')?.dataset.go; if (k) ready(k); }, { passive: true });
  // Where the next view puts what the push-in goes into, on this screen: its middle x, y and, for a door, its width w.
  const next = {
    // The lobby's glass entrance, where pixel.js lays the lobby out (art.js), a phone's starting on it.
    tower() {
      const E = ENTRANCE, dpr = devicePixelRatio || 1, cardTop = parseFloat(getComputedStyle(canvas).getPropertyValue('--card-top')) || 0;
      const { s, x0, ry } = lay(innerWidth, innerHeight, dpr, cardTop, E.mid);
      return { x: (x0 + (E.x0 + E.x1) / 2 * s) / dpr, y: (ry + (E.y0 + E.y1) / 2 * s) / dpr, w: (E.x1 - E.x0) * s / dpr };
    },
    // Workshop Row's Apps door, where /projects/ pans it as it loads (pan.js): its label mid-way across the free view. The
    // street is laid out as the city is, the same height at the top of its page, its panel the city's.
    workshop(r) {
      const k = r.height / ROW.size[1], mapW = ROW.size[0] * k, [x, y, w] = ROW.door;
      if (mapW < r.width) return null;   // a screen wider than the street stretches it: there is no door to land on
      const focus = floats() ? (panel.getBoundingClientRect().right + r.width) / 2 : r.width / 2;
      const left = Math.min(mapW - r.width, Math.max(0, Math.round(ROW.labels['bay-1'][0] / 100 * mapW) - focus));
      return { x: x * k - left, y: y * k, w: w * k };
    },
    // The room headers' middles (custom.css: .library-hero, .room-map), at the top of their pages.
    library: () => ({ x: innerWidth / 2, y: (innerWidth <= 760 ? innerHeight * 0.38 : Math.min(innerHeight * 0.52, 470)) / 2 }),
    radio: () => ({ x: innerWidth / 2, y: Math.min(480, Math.max(230, innerWidth * 0.241)) / 2 }),
  };
  next.post = next.radio;
  let entering = false;
  const through = (key, href) => {
    if (still.matches || fxOff || (key === 'tower' && !roomy.matches)) return false;
    const r = scene.getBoundingClientRect(), to = next[key](r);
    if (!to) return false;
    ready(key);
    const [w, h] = size(), k = h / artH, d = CITY.doors[key];
    const [dx, dy] = d ?? [zoom[key][0] / 100 * artW, zoom[key][1] / 100 * artH];
    const s = d ? Math.min(14, to.w / d[2]) / k : at.s * 4;
    // A phone's map, in the page's flow, is held where it is, fixed, so the push grows over the page without widening it
    // (a phone zooms out to fit a page that overflows); its panel keeps its place.
    if (!floats()) {
      Object.assign(scene.style, { position: 'fixed', top: `${r.top}px`, left: `${r.left}px`, width: `${r.width}px`, height: `${r.height}px` });
      panel.style.marginTop = `${r.height + parseFloat(getComputedStyle(panel).marginTop)}px`;
    }
    city.classList.add('going');
    place(to.x - r.left - dx * k * s, to.y - r.top - dy * k * s, s, false, true);
    const end = { x: r.left + at.x, y: r.top + at.y, w: w * s, h: h * s }, frame = () => end;   // the frame it ends on, on the screen
    const leave = () => {   // to a page of its own, which takes the frame from here (assets/js/push-in.js)
      try { sessionStorage.setItem('push-in', JSON.stringify({ to: new URL(href).pathname, t: Date.now(), src: img.currentSrc, ...frame() })); } catch { /* a plain arrival */ }
      location.href = href;
    };
    const enter = () => {   // the tower, on this page: the frame over it until its lobby is here
      const f = frame();
      const c = cover((ctx) => {
        ctx.drawImage(img, f.x, f.y, f.w, f.h);
        if (door.style.visibility === 'visible') ctx.drawImage(door, f.x + ox / artW * f.w, f.y + oy / artH * f.h, ow / artW * f.w, oh / artH * f.h);
        ctx.drawImage(fx, f.x, f.y, f.w, f.h);
      }, 4);
      let opened = false;
      const open = () => { if (!opened) { opened = true; iris(c, [to.x, to.y], [[canvas, to.x, to.y]]); } };
      document.addEventListener('building:shown', open, { once: true });
      setTimeout(open, 3000);   // a lobby slow to come is shown as it comes
      entering = true;
      location.hash = '#floor-L';
    };
    // The tower's doors open as it arrives, then in.
    const doors = () => door.decode().then(() => setTimeout(() => { door.style.visibility = 'visible'; setTimeout(enter, 380); }, 140), enter);
    let late = 0;
    const pushed = (e) => {
      if (e && (e.target !== map || e.propertyName !== 'transform')) return;   // the labels' own transitions bubble up here
      map.removeEventListener('transitionend', pushed);
      clearTimeout(late);
      if (key === 'tower') doors(); else leave();
    };
    map.addEventListener('transitionend', pushed);
    late = setTimeout(pushed, 600);
    return true;
  };
  // Back from a district (bfcache): the city as it was before the push.
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    city.classList.remove('going');
    scene.removeAttribute('style'); panel.style.marginTop = '';
    door.style.visibility = 'hidden';
    try { sessionStorage.removeItem('push-in'); } catch { /* none was kept */ }
    view(false);
  });

  view(false);
  // Only a new width re-centres: iOS resizes as its toolbar collapses, and the visitor's pan stays, re-clamped (#301).
  const layoutWidth = () => root.clientWidth;   // not innerWidth, which a pinch changes in WebKit
  let wide = layoutWidth();
  addEventListener('resize', () => city.classList.contains('going') || (layoutWidth() === wide ? place(at.x, at.y, at.s, false) : (wide = layoutWidth(), view(false))));
  // In the capture phase, so a label's first click, which only zooms, never reaches its link or its GoatCounter count.
  // Going in is only kept from its link's default, so its count goes on to the link.
  city.addEventListener('click', (e) => {
    if (city.classList.contains('going')) return e.preventDefault();
    if (e.target.closest('[data-city-out]')) return pick(null);
    const b = e.target.closest('[data-pick]');
    const go = e.target.closest('a[data-go]') ?? (b?.matches('a') && b.dataset.pick === current ? b : null);   // the picked label's second click goes in
    if (go) {
      if (!e.button && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && through(go.dataset.go ?? go.dataset.pick, go.href)) e.preventDefault();
      return;
    }
    if (!b) return;
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
  // A finger pans it sideways too; up and down stay the page's scroll, and a pinch the browser's zoom (touch-action).
  let finger = null;
  scene.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'mouse') finger = e.isPrimary ? e.clientX : null; });   // a second finger: a pinch
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
    scrollTo(0, 0);   // a phone may have scrolled down to the panel; the building's page does not scroll
    document.dispatchEvent(new CustomEvent('city:enter', { detail: { through: entering } }));
  });
}
