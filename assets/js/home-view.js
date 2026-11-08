// Where the homepage's city map sits, as numbers: web3d/src/city.js places it by these, and so does the pre-paint
// (home-city.js, which layouts/index.html inlines after this file, its exports dropped), so the first paint is where the
// city then is. No DOM, so scripts/test/home-view.test.js tests it. Each caller measures as it always has. Plain
// functions and vars, as the pre-paint is.

// The middle of the free view: right of a floating panel (panelRight, its right edge; null where it stacks under the
// map), or the scene's middle.
export function freeMid(sceneW, panelRight) {
  return panelRight === null ? sceneW / 2 : (panelRight + sceneW) / 2;
}

// The whole city: its tower's label (tower: its offsetLeft, its middle's x in the map, and its offsetWidth) at mid,
// moved right until the Library's label (lib) clears a floating panel by 8 px, as far as the tower's stays 8 px inside
// the scene's right edge.
export function cityView(mid, sceneW, tower, lib, panelRight) {
  var x = mid - tower.offsetLeft;
  if (panelRight !== null) x = Math.max(x, panelRight + 8 + lib.offsetWidth / 2 - lib.offsetLeft);
  return [Math.min(x, sceneW - 8 - tower.offsetWidth / 2 - tower.offsetLeft), 0, 1];
}

// A district, zoomed: its building's middle (city.json's zoom, z: x and y in % of the map, and how far to zoom) at mid,
// a little high beside a floating panel. The map is w x h px for artH art px: its zoom is the nearest whole number of
// device px an art px, as the whole city's is (city.css), stopping where one would pass maxPx screen px, which a big
// screen reaches first, and never under the whole city's.
export function districtView(z, mid, sceneH, w, h, artH, dpr, maxPx, floating) {
  var n = dpr * h / artH, s = Math.max(Math.round(n), Math.min(Math.round(n * z[2]), Math.floor(maxPx * dpr))) / n;
  return [mid - z[0] / 100 * w * s, sceneH * (floating ? 0.46 : 0.5) - z[1] / 100 * h * s, s];
}

// A view [x, y, s] clamped so no edge of the w x h map shows in the scene.
export function clampView(v, sceneW, sceneH, w, h) {
  return [Math.min(0, Math.max(sceneW - w * v[2], v[0])), Math.min(0, Math.max(sceneH - h * v[2], v[1])), v[2]];
}
