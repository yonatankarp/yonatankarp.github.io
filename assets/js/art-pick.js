// A scene's painting at the visitor's hour and, in winter, under snow (head.html's time pick, html[data-art]): Workshop
// Row's, the Library's and the Radio Mast's and Post Office's rooms. Preloaded in the head before the stylesheets hold
// the body's scripts back (#300); art-time.js, after the picture, sets it from here. The page's template (or head.html,
// for a page whose front matter names its `art`) writes ART, the painting's path, and VERSION in.
(function () {
  var l = document.createElement('link');
  l.id = 'hour-art'; l.rel = 'preload'; l.as = 'image'; l.fetchPriority = 'high';
  l.href = ART + document.documentElement.dataset.art + '.webp?v=' + VERSION;   // eslint-disable-line no-undef
  document.head.appendChild(l);
})();
