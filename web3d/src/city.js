// The homepage's city (layouts/index.html): a wide panorama. Picking a district from a chip or a label zooms the map into
// its building and shows its text in the panel; picking it again, or "Whole city", zooms back out. A label goes into its
// district (the tower, the library, the workshops, the radio mast, the post office) on its second click, or at once from
// the keyboard; back from one, the city opens zoomed on it (the pre-paint in layouts/index.html). Any #floor-X address enters the
// building, which pixel.js mounts on city:enter; back at the bare address the page loads afresh on the city (guide.js).
// Going in, the map pushes on through the district's door into the next view (iris.js).
import { ENTRANCE, lay, strip } from './art.js';
import { cityFx } from './city-fx.js';
import { roomy } from './guide.js';
import { floorShaped } from './hash.js';
import { cover, iris } from './iris.js';
import { freeMid, cityView, districtView, clampView } from '../../assets/js/home-view.js';   // the pre-paint's too
import CITY from '../../static/building/pixel/city.json';       // gen_city.py: the doors the push-in goes through
import ROW from '../../static/building/pixel/workshop.json';    // gen_workshop.py: Workshop Row's first door, where it lands
import './city.css';

const root = document.documentElement;
const city = document.querySelector('[data-city]');
if (city && root.classList.contains('at-city')) {
  city.setAttribute('role', 'main');   // the page's main while it shows (#305): the tower's <main> is hidden, and without a script the city is not the page
  const scene = city.querySelector('.city-scene'), map = scene.querySelector('.city-map'), panel = city.querySelector('.city-panel');
  const kicker = city.querySelector('[data-city-kicker]'), out = city.querySelectorAll('[data-city-out]'), overview = kicker.dataset.cityKicker;   // the pre-paint may have set its text
  const zoom = JSON.parse(map.dataset.zoom), maxPx = Number(map.dataset.maxPx), artH = scene.querySelector('.city-fx').height;
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const fxOff = new URLSearchParams(location.search).get('fx') === 'off';   // the visual captures: no glide, no push-in
  const floats = () => getComputedStyle(panel).position === 'fixed';
  cityFx(scene.querySelector('.city-fx'), scene.querySelector('img'));

  // The map moves and scales in one transform, clamped so no edge of the art shows; `smooth` glides there (city.css).
  let current = null, at = { x: 0, y: 0, s: 1 };
  const size = () => { const c = getComputedStyle(map); return [parseFloat(c.width), parseFloat(c.height)]; };   // unrounded, so no sliver of edge shows
  // push: going in, the push-in's 450 ms, past the art's edges.
  const place = (x, y, s, smooth, push) => {
    const [w, h] = size();
    if (!push) [x, y] = clampView([x, y, s], scene.clientWidth, scene.clientHeight, w, h);
    at = { x, y, s };
    map.style.setProperty('--glide', push ? '450ms' : smooth && !still.matches && !fxOff ? '600ms' : '0s');
    map.style.setProperty('--inv', 1 / s);   // the labels keep their size on screen
    map.style.transform = `translate(${at.x}px, ${at.y}px) scale(${s})`;
    fit();
  };
  // Every label whole in the free view (#295), from where the map is going: one whose district is in it slides inside its
  // edges by --shift, as on Workshop Row (workshop.js); one whose district is not, or that would sit under a floating
  // panel, is away (city.css). Out of the Tab order (the chips are the keyboard's), but a screen reader may still focus it,
  // which brings it into view.
  const tags = [...city.querySelectorAll('.city-tag')];
  function fit() {
    const p = panel.getBoundingClientRect(), r = scene.clientWidth - 8, over = floats();
    for (const t of tags) {
      const x = at.x + t.offsetLeft * at.s, half = t.offsetWidth / 2, l = over && at.y + t.offsetTop * at.s > p.top ? p.right + 8 : 8;
      t.style.setProperty('--shift', `${Math.min(Math.max(x - half, l), r - 2 * half) - (x - half)}px`);
      t.classList.toggle('away', x < l || x > r);
    }
  }
  const panelRight = () => (floats() ? panel.getBoundingClientRect().right : null);   // null: the panel stacks under the map
  const free = () => freeMid(scene.clientWidth, panelRight());
  city.addEventListener('focusin', (e) => {
    if (e.target.matches('.city-tag.away')) place(free() - e.target.offsetLeft * at.s, at.y, at.s, true);
  });
  // The picked building's middle (city.json's zoom) at the middle of the free view: right of a floating panel and a little
  // high, or the scene's middle where the panel stacks under it. Its zoom, to the nearest whole number of device px an
  // art px as the whole city's is (city.css), stops where one would pass maxPx screen px, which a big screen reaches
  // first, and never goes under the whole city's. Unpicked, the whole city on the tower, as the page opens,
  // moved right until the Library's label clears a floating panel, as far as the tower's stays whole. The maths is
  // assets/js/home-view.js, which the pre-paint (home-city.js) places the first paint by.
  const view = (smooth) => {
    const r = panelRight(), mid = freeMid(scene.clientWidth, r);
    if (!current) {
      const tower = city.querySelector('.city-tag[data-pick=tower]'), lib = city.querySelector('.city-tag[data-pick=library]');
      return place(...cityView(mid, scene.clientWidth, tower, lib, r), smooth);
    }
    const [w, h] = size();
    place(...districtView(zoom[current], mid, scene.clientHeight, w, h, artH, devicePixelRatio || 1, maxPx, r !== null), smooth);
  };
  const pick = (key, { fromOut = false, smooth = true } = {}) => {
    // "Whole city" hides as it zooms out, so its focus goes to the chip that was picked (#301). Told by the click, not by
    // document.activeElement: Safari does not focus a button it clicks.
    if (fromOut) city.querySelector(`.city-chips [data-pick="${current}"]`).focus();
    current = key;
    city.classList.toggle('zoomed', !!key);
    for (const b of city.querySelectorAll('[data-pick]')) {
      if (b.matches('.city-tag')) {
        const on = b.dataset.pick === key;
        b.classList.toggle('on', on);
        // A picked label says so to a screen reader, and that its next click goes in (#305).
        if (on) { b.setAttribute('aria-current', 'true'); b.setAttribute('aria-describedby', 'city-again'); }
        else { b.removeAttribute('aria-current'); b.removeAttribute('aria-describedby'); }
      }
      if (b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', b.dataset.pick === key);
    }
    for (const d of city.querySelectorAll('[data-district]')) d.hidden = d.dataset.district !== (key ?? '');
    kicker.textContent = key ? city.querySelector(`.city-chips [data-pick="${key}"]`).textContent : overview;
    for (const o of out) o.hidden = !key;
    if (key) ready(key);
    history.replaceState({ ...history.state, at: key }, '');   // so a Back that reloads opens on it again (the pre-paint)
    view(smooth);
  };

  // ---- going in ----
  // A district's go link, or its picked label's second click, pushes on into it: the map zooms on, gathering speed, until
  // what it goes into fills the view, then hands its last frame to the next view, which opens it in an iris (iris.js).
  // The tower and Workshop Row have doors (city.json's doors): the city's ends where the next view's is, at its size, to
  // 14 screen px a city art px; the tower's opens first (door-open[-winter][-PHASE].webp, gen_city.py). The others push into the
  // building's middle, which ends on the middle of their page's room header. A plain link under reduced motion, with
  // ?fx=off (the visual captures), where the tower is the plain page, or for a click that opens a tab.
  const canvas = document.querySelector('#pixel-canvas'), img = scene.querySelector('img'), fx = scene.querySelector('.city-fx');
  const artW = CITY.size[0], hour = root.dataset.art;   // as the city's picture is picked (time-pick.js)
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
      for (const kind of ['', '-open']) fetch(art(strip('L', kind))).then((r) => r.blob()).catch(() => {});
    } else {
      document.head.append(Object.assign(document.createElement('link'), { rel: 'prefetch', href: city.querySelector(`[data-go="${key}"]`).href }));
      // Its room's painting too, which the iris waits for there (iris.js): the same URL as the page asks for.
      const room = { library: 'library', workshop: `workshop${hour}`, radio: 'radio', post: 'post' }[key];
      if (room) fetch(art(room)).then((r) => r.blob()).catch(() => {});
    }
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
    // Workshop Row's first door, where /projects/ pans it as it loads (pan.js): its label mid-way across the free view. The
    // street is laid out as the city is, the same size at the top of its page, its panel the city's, and its art pixels
    // are the city's (city.css).
    workshop(r) {
      const k = size()[1] / artH, mapW = ROW.size[0] * k, [x, y, w] = ROW.door;
      if (mapW < r.width) return null;   // a screen wider than the street stretches it: there is no door to land on
      const focus = floats() ? (panel.getBoundingClientRect().right + r.width) / 2 : r.width / 2;
      // bay-1: the first workshop's label (data/rooms.yaml's groups, open-source contributions), which workshop.js opens on.
      const left = Math.min(mapW - r.width, Math.max(0, Math.round(ROW.labels['bay-1'][0] / 100 * mapW) - focus));
      return { x: x * k - left, y: y * k, w: w * k };
    },
    // The room headers' middles (custom.css: .library-hero, .room-hero), at the top of their pages: its numbers, which
    // scripts/test/push-in.test.js holds to custom.css's.
    library: () => ({ x: innerWidth / 2, y: (innerWidth <= 760 ? innerHeight * 0.38 : Math.min(innerHeight * 0.52, 173 * Math.ceil(devicePixelRatio * innerWidth / 720) / devicePixelRatio + 3)) / 2 }),
    radio: () => ({ x: innerWidth / 2, y: Math.min(480, Math.max(230, innerWidth * 347 / 1440)) / 2 }),
  };
  next.post = next.radio;
  let entering = false;
  const through = (key, href) => {
    if (still.matches || fxOff || (key === 'tower' && !roomy.matches)) return false;
    const r = scene.getBoundingClientRect(), to = next[key]?.(r);
    if (!to) return false;   // nothing to land on: the plain link's wipe
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
    const doors = () => door.decode().then(() => setTimeout(() => { door.style.visibility = 'visible'; setTimeout(enter, 140); }, 40), enter);
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

  const back = history.state?.at;   // back from a district: the pre-paint opened on it
  if (Object.hasOwn(zoom, back)) pick(back, { smooth: false }); else view(false);
  // Only a new width re-centres: iOS resizes as its toolbar collapses, and the visitor's pan stays, re-clamped (#301).
  const layoutWidth = () => root.clientWidth;   // not innerWidth, which a pinch changes in WebKit
  let wide = layoutWidth();
  addEventListener('resize', () => city.classList.contains('going') || (layoutWidth() === wide ? place(at.x, at.y, at.s, false) : (wide = layoutWidth(), view(false))));
  // In the capture phase, so a label's first click, which only zooms, never reaches its link or its GoatCounter count.
  // Going in is only kept from its link's default, so its count goes on to the link.
  city.addEventListener('click', (e) => {
    if (city.classList.contains('going')) return e.preventDefault();
    if (e.target.closest('[data-city-out]')) return pick(null, { fromOut: true });
    const b = e.target.closest('[data-pick]');
    // The picked label's second click goes in, and so does a label's Enter or Space at once (#305), a click with no pointer.
    const go = e.target.closest('a[data-go]') ?? (b?.matches('a') && (b.dataset.pick === current || !e.detail) ? b : null);
    if (go) {
      const key = go.dataset.go ?? go.dataset.pick;
      if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (key !== current) pick(key);   // where Back comes back to
      if (through(key, go.href)) e.preventDefault();
      return;
    }
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    pick(b.dataset.pick === current ? null : b.dataset.pick);
  }, true);
  // Space on a label goes in as Enter does (a link's Space would scroll the page), through the click above and its count.
  city.addEventListener('keydown', (e) => {
    if (e.key !== ' ' || !e.target.matches('.city-tag')) return;
    e.preventDefault();
    e.target.click();
  });

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
