// The season at a latitude, shared by the pick in the page's head (time-pick.js, which layouts/partials/time-pick.html and
// scripts/lib.js follow with this file, without its export) and web3d/src/calendar.js, which exports it. Kept to vars and
// a plain function, as the pick's minifier needs; no other line may hold "export" and a space.

// Meteorological, by whole months, flipped south of the equator. Within the tropics none of them really shows, so it is
// summer there all year.
export function seasonOn(date, lat) {
  if (Math.abs(lat) < 23.5) return 'summer';
  return ['winter', 'winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter'][(date.getMonth() + (lat < 0 ? 6 : 0)) % 12];
}
