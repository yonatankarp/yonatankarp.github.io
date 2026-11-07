// The sun's elevation, shared by the time-of-day pick (time-pick.js, which layouts/partials/time-pick.html and
// scripts/lib.js follow with this file, without its export) and the holidays' sunset (web3d/src/outside.js, which imports
// it: past sunset a Hebrew or Islamic holiday's evening counts as its next day). Kept to vars and a plain function, as
// the pick's minifier needs; no other line may hold "export" and a space.

// The sun at instant ms seen from lat, lon (the standard low-precision solar position, a few minutes off at most): its
// elevation in degrees, and its hour angle, negative before noon.
export function sunAt(ms, lat, lon) {
  var r = Math.PI / 180, n = ms / 864e5 - 10957.5,   // days since J2000.0
    g = (357.528 + 0.9856003 * n) * r, l = (280.46 + 0.9856474 * n + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * r,
    e = (23.439 - 4e-7 * n) * r, dec = Math.asin(Math.sin(e) * Math.sin(l)),
    ra = Math.atan2(Math.cos(e) * Math.sin(l), Math.cos(l)) / r,
    h = (((280.46061837 + 360.98564736629 * n + lon - ra) % 360) + 540) % 360 - 180;
  return [Math.asin(Math.sin(lat * r) * Math.sin(dec) + Math.cos(lat * r) * Math.cos(dec) * Math.cos(h * r)) / r, h];
}
