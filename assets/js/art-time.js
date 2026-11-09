// Right after a scene's picture: the hour's painting, from art-pick.js's preload. src before eager, so the dusk one is
// never asked for; lazy in the markup only so that it waits for this, as a page without a script loads it at once.
(function () {
  var i = document.currentScript.previousElementSibling;
  i.src = document.getElementById('hour-art').href;
  i.loading = 'eager';
})();
