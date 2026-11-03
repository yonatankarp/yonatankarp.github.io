// What is going on outside the building, for decor.js to draw on the street: the visitor's season, their holidays and
// his own (calendar.js), and the weather where they are. The visitor is placed by their browser's timezone alone
// (data/timezones.json: its country and its main city), so nobody is asked for their location; an unknown zone gets his
// city, Berlin. The weather is the one request: Open-Meteo, at most once an hour a browser session, after the page has
// loaded, and the street just goes on without it if it fails. Like ?time=, the address can pin each of them for testing:
// ?season=spring|summer|autumn|winter, ?weather=clear|cloudy|fog|rain|snow, ?holiday=none or a list such as
// hanukkah:3,christmas (the number is the day of it, from 0).
import TZ from '../../data/timezones.json';
import { HOLIDAYS, holidaysOn, seasonOn, placeOf, weatherOf } from './calendar.js';

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
export const SKIES = ['clear', 'cloudy', 'fog', 'rain', 'snow'];
const WEATHER_KEY = 'building-weather', WEATHER_TTL = 3600000;

const query = new URLSearchParams(location.search);
const pinned = (name, list) => (list.includes(query.get(name)) ? query.get(name) : null);
let zone = '';
try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''; } catch { /* no Intl timezone: placed in Berlin */ }
const visitor = placeOf(zone, TZ);
const place = visitor ?? placeOf('Europe/Berlin', TZ);
const today = new Date();

function fromQuery(list) {
  const out = {};
  for (const item of list.split(',')) {
    const [name, day] = item.trim().split(':');
    if (HOLIDAYS[name]) out[name] = Math.max(0, Number(day) || 0);
  }
  return out;
}

const listeners = [];
export const OUTSIDE = {
  season: pinned('season', SEASONS) ?? seasonOn(today, place.lat),
  holidays: query.has('holiday') ? fromQuery(query.get('holiday')) : holidaysOn(today, visitor ? [visitor.country] : []),
  sky: pinned('weather', SKIES),   // null until the weather comes, if it does
  temp: null,                      // °C, from the same call
  lat: place.lat,
  // Snow lies on the roofs and the pavement: while it snows, or in a winter cold enough, which without a reading is a
  // winter far enough north (or south) to have one.
  get cold() { return this.sky === 'snow' || (this.season === 'winter' && (this.temp ?? (Math.abs(this.lat) >= 50 ? -1 : 5)) <= 1); },
  changed(fn) { listeners.push(fn); },
};

const root = document.documentElement.dataset;
const mark = () => {   // for the visual captures and the CSP check, which wait on them
  root.season = OUTSIDE.season;
  root.holiday = Object.keys(OUTSIDE.holidays).join(' ') || 'none';
  if (OUTSIDE.sky) root.weather = OUTSIDE.sky;
};
mark();

function apply(w) {
  OUTSIDE.sky = w.sky; OUTSIDE.temp = w.temp;
  mark();
  listeners.forEach((fn) => fn());
}

if (!OUTSIDE.sky) {
  let kept = null;
  try { kept = JSON.parse(sessionStorage.getItem(WEATHER_KEY)); } catch { /* blocked storage: ask again */ }
  if (kept && kept.zone === zone && Date.now() - kept.at < WEATHER_TTL && SKIES.includes(kept.sky)) apply(kept);
  else {
    const ask = () => fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=weather_code,temperature_2m`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((j) => {
        const w = { sky: weatherOf(j.current.weather_code), temp: j.current.temperature_2m, at: Date.now(), zone };
        try { sessionStorage.setItem(WEATHER_KEY, JSON.stringify(w)); } catch { /* asked again next load */ }
        apply(w);
      })
      .catch((err) => console.warn('No weather for the street:', err.message));
    if (document.readyState === 'complete') ask(); else addEventListener('load', ask, { once: true });
  }
}
