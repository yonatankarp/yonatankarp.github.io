// The visitor's time of day for the art (#151), from the sun where they are: layouts/partials/time-pick.html writes the
// zone table in for Z's placeholder. Tested by scripts/test/time-pick.test.js; check-phases.js runs it too.

var Z = ZONES, q = new URLSearchParams(location.search).get('time');   // eslint-disable-line no-undef
document.documentElement.dataset.time = /^(dawn|day|dusk|night)$/.test(q) ? q : sunPhase(Date.now(), ...place());

// Where the visitor is, roughly: their time zone's main city in Z, which groups "City<lat>,<lon>" by the zone's folder.
function place() {
  try {
    var z = Intl.DateTimeFormat().resolvedOptions().timeZone,
      m = (Z[z.slice(0, z.lastIndexOf('/') + 1)] || '').match(new RegExp('(^| )' + z.split('/').pop().replace(/\W/g, '\\$&') + '(-?\\d+),(-?\\d+)'));
    if (m) return [+m[2], +m[3]];
  } catch { /* no zone */ }
  return [52.5, 13.4];   // an unknown zone, or none: Berlin
}

// The phase at instant ms, from the sun's elevation at lat, lon (the standard low-precision solar position, a few
// minutes off at most): day above +6 degrees, night at -8 or below, dawn or dusk between, by whether noon has passed.
function sunPhase(ms, lat, lon) {
  var r = Math.PI / 180, n = ms / 864e5 - 10957.5,   // days since J2000.0
    g = (357.528 + 0.9856003 * n) * r, l = (280.46 + 0.9856474 * n + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * r,
    e = (23.439 - 4e-7 * n) * r, dec = Math.asin(Math.sin(e) * Math.sin(l)),
    ra = Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l)) / r,
    h = (((280.46061837 + 360.98564736629 * n + lon - ra) % 360) + 540) % 360 - 180,   // hour angle, negative before noon
    alt = Math.asin(Math.sin(lat * r) * Math.sin(dec) + Math.cos(lat * r) * Math.cos(dec) * Math.cos(h * r)) / r;
  return alt > 6 ? 'day' : alt <= -8 ? 'night' : h < 0 ? 'dawn' : 'dusk';
}

