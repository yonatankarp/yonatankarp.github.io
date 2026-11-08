/* global freeMid, cityView, districtView, clampView */
// The city's picture at the hour, and its first view before the first paint, as web3d/src/city.js places it, by the same
// maths (home-view.js, which layouts/index.html inlines before this): on the tower, or back from a district (#305) zoomed
// on it, as city.js's pick() does. The district is the back link's #KEY (moved into this entry's history.state and off
// the address), or that state on a Back that reloads, which city.js keeps. Runs right after the city's section.
var c = document.currentScript.previousElementSibling;
if (document.documentElement.classList.contains('at-city')) {
  var s = c.querySelector('.city-scene'), i = s.querySelector('img'), p = c.querySelector('.city-panel'), m = s.firstElementChild;
  var f = getComputedStyle(p).position === 'fixed', r = f ? p.getBoundingClientRect().right : null, mid = freeMid(s.clientWidth, r);
  var j, b, v, e = c.querySelectorAll('.city-tag'), h = location.hash.slice(1), mh = m.getBoundingClientRect().height;
  for (j = 0; j < e.length; j++) if (e[j].dataset.pick === h) history.replaceState({ at: h }, '', location.pathname + location.search);
  for (j = 0; j < e.length; j++) if (history.state && e[j].dataset.pick === history.state.at) b = e[j];
  i.src = i.dataset.base + document.documentElement.dataset.art + '.webp?v=' + i.dataset.version;   // the hour's (time-pick.js)
  i.loading = 'eager';
  if (b) {
    var key = b.dataset.pick, chip = c.querySelector('.city-chips [data-pick=' + key + ']');
    v = districtView(JSON.parse(m.dataset.zoom)[key], mid, s.clientHeight, m.offsetWidth, mh, s.querySelector('.city-fx').height, devicePixelRatio || 1, m.dataset.maxPx, f);
    m.style.setProperty('--inv', 1 / v[2]);
    c.classList.add('zoomed');
    b.classList.add('on');
    b.setAttribute('aria-current', 'true');
    b.setAttribute('aria-describedby', 'city-again');
    chip.setAttribute('aria-pressed', 'true');
    c.querySelector('[data-city-kicker]').textContent = chip.textContent;
    e = c.querySelectorAll('[data-district]');
    for (j = 0; j < e.length; j++) e[j].hidden = e[j].dataset.district !== key;
    e = c.querySelectorAll('[data-city-out]');
    for (j = 0; j < e.length; j++) e[j].hidden = false;
  } else {
    v = cityView(mid, s.clientWidth, c.querySelector('.city-tag[data-pick=tower]'), c.querySelector('.city-tag[data-pick=library]'), r);
  }
  v = clampView(v, s.clientWidth, s.clientHeight, m.offsetWidth, mh);
  m.style.transform = 'translate(' + v[0] + 'px, ' + v[1] + 'px) scale(' + v[2] + ')';
}
