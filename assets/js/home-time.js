// After the time pick (partials/time-pick.html), in one script with it (layouts/index.html, which writes FLOOR_HASH,
// ART and VERSION in): the city's picture at the hour preloaded before the stylesheet, which would hold this script
// back, so it starts at once; a static preload tag would fetch the dusk city at every hour. A floor's address has no city.
if (!FLOOR_HASH.test(location.hash)) {   // eslint-disable-line no-undef
  var l = document.createElement('link');
  l.rel = 'preload'; l.as = 'image'; l.fetchPriority = 'high';
  l.href = ART + 'pixel/city' + document.documentElement.dataset.art + '.webp?v=' + VERSION;   // eslint-disable-line no-undef
  document.head.appendChild(l);
}
