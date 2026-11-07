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
    setTimeout(function () { d.classList.remove('iris', 'iris-open'); }, 3000);   // a script that never came: the page as it is
  } catch { /* no storage: a plain arrival */ }
})();
