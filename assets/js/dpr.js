// The screen's device px a CSS px, as html's --dpr, before the first paint: the pixel-art scenes size their art by it
// (web3d/src/city.css, assets/css/custom.css), to a whole number of device px an art px. Again on a resize, as a
// browser zoom changes it. Inline in the head, allowed by its hash (partials/head.html; the homepage's layouts/index.html).
(function () {
  var set = function () { document.documentElement.style.setProperty('--dpr', devicePixelRatio || 1); };
  set();
  addEventListener('resize', set);
})();
