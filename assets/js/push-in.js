// In from the city's push-in (web3d/src/city.js): a district's page takes the city's last frame, which the city left in
// sessionStorage just before it went, and marks html.iris before the first paint, so the old page's snapshot holds
// (custom.css) until web3d/src/iris.js lays the same frame over this page and opens it. Only on the page the frame was
// left for, and only fresh. Inline in the head, allowed by its hash (partials/head.html), so it is there for pagereveal.
(function () {
  try {
    var d = document.documentElement, z = JSON.parse(sessionStorage.getItem('push-in'));
    sessionStorage.removeItem('push-in');
    if (!z || z.to !== location.pathname || Date.now() - z.t > 5000 || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    window.pushIn = z;
    d.classList.add('iris');
    addEventListener('pagereveal', function (e) {
      z.revealed = true;
      z.vt = e.viewTransition;
      if (z.vt) ['ready', 'finished', 'updateCallbackDone'].forEach(function (p) { z.vt[p].catch(function () {}); });
    }, { once: true });
    // A script or a picture slow to come: the page as it is, soon after it is here, and in any case by 3 s, rather than
    // holding a page that is already readable behind the old one's snapshot.
    // (No shared helper: minifyOutput would reshape it, and the CSP hash with it.)
    setTimeout(function () { d.classList.remove('iris', 'iris-open'); }, 3000);
    addEventListener('DOMContentLoaded', function () { setTimeout(function () { if (!d.classList.contains('iris-open')) d.classList.remove('iris'); }, 700); }, { once: true });
  } catch { /* no storage: a plain arrival */ }
})();
