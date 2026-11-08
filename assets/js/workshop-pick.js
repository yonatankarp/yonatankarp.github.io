// Workshop Row's painting at the visitor's hour and, in winter, under snow (head.html's time pick, html[data-art]),
// preloaded in the head before the stylesheets hold the body's scripts back (#300); workshop-time.js, after the picture,
// sets it from here. layouts/projects/list.html writes ART, the painting's path, and VERSION in.
(function () {
  var l = document.createElement('link');
  l.id = 'workshop-art'; l.rel = 'preload'; l.as = 'image'; l.fetchPriority = 'high';
  l.href = ART + document.documentElement.dataset.art + '.webp?v=' + VERSION;   // eslint-disable-line no-undef
  document.head.appendChild(l);
})();
