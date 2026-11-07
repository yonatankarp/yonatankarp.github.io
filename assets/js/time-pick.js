// The visitor's time of day for the art (#151), from the sun where they are, and their season, from the date and their
// latitude: layouts/partials/time-pick.html writes the zone table in for Z's placeholder. Tested by
// scripts/test/time-pick.test.js; check-phases.js runs it too.

// The page's minifier must leave this script as it is, or its CSP hash breaks: if check-generated-html says so, reshape
// these vars and functions, not the table.
var Z = ZONES, a = new URLSearchParams(location.search), q = a.get('time'), s = a.get('season'), at = place();   // eslint-disable-line no-undef
document.documentElement.dataset.time = /^(dawn|day|dusk|night)$/.test(q) ? q : sunPhase(Date.now(), ...at);
// seasonOn, from assets/js/season.js, which follows this script with sun.js. Only winter has art of its own.
document.documentElement.dataset.season = /^(spring|summer|autumn|winter)$/.test(s) ? s : seasonOn(new Date(), at[0]);   // eslint-disable-line no-undef
document.documentElement.dataset.place = at;   // "lat,lon", for the holidays' sunset (web3d/src/outside.js)

// Where the visitor is, roughly: their time zone's main city in Z, which groups "City<lat>,<lon>" by the zone's folder.
function place() {
  try {
    var z = Intl.DateTimeFormat().resolvedOptions().timeZone,
      m = (Z[z.slice(0, z.lastIndexOf('/') + 1)] || '').match(new RegExp('(^| )' + z.split('/').pop().replace(/\W/g, '\\$&') + '(-?\\d+),(-?\\d+)'));
    if (m) return [+m[2], +m[3]];
  } catch { /* no zone */ }
  return [52.5, 13.4];   // an unknown zone, or none: Berlin
}

// The phase at instant ms, from the sun's elevation at lat, lon (sunAt, from assets/js/sun.js, which follows this
// script): day above +6 degrees, night at -8 or below, dawn or dusk between, by whether noon has passed.
function sunPhase(ms, lat, lon) {
  var s = sunAt(ms, lat, lon);   // eslint-disable-line no-undef
  return s[0] > 6 ? 'day' : s[0] <= -8 ? 'night' : s[1] < 0 ? 'dawn' : 'dusk';
}

