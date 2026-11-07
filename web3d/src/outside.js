// What is going on outside, for a later pass that dresses the art for it: the visitor's season, their holidays and his
// own (calendar.js). Parked: nothing imports this module now (CLAUDE.md). The visitor is placed by their browser's
// timezone alone (data/timezones.json: its country and its main city), so nobody is asked for their location; an unknown
// zone gets his city, Berlin. Like ?time=, the address can pin each for testing: ?season=spring|summer|autumn|winter,
// ?holiday=none or a list such as hanukkah:3,christmas (the number is the day of it, from 0). The Hebrew and Islamic
// holidays begin at sunset there: past it, the evening already counts as the next day's (the first Hanukkah candle).
import TZ from '../../data/timezones.json';
import { sunAt } from '../../assets/js/sun.js';
import { HOLIDAYS, holidaysOn, seasonOn, placeOf } from './calendar.js';

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

const query = new URLSearchParams(location.search);
const pinned = (name, list) => (list.includes(query.get(name)) ? query.get(name) : null);
let zone = '';
try { zone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ''; } catch { /* no Intl timezone: placed in Berlin */ }
const visitor = placeOf(zone, TZ);
const place = visitor ?? placeOf('Europe/Berlin', TZ);
const today = new Date();
// Past sunset (the sun's top below the horizon, -0.833 degrees) and still the same date: the afternoon goes by the
// clock, not the sun's hour angle, since the holidays change at the date's midnight, which solar midnight is not.
// shortcut: in the polar night it is true from noon, and in the midnight sun never; give those a fixed hour if it matters.
const evening = today.getHours() >= 12 && sunAt(today.getTime(), place.lat, place.lon)[0] < -0.833;

function fromQuery(list) {
  const out = {};
  for (const item of list.split(',')) {
    const [name, day] = item.trim().split(':');
    if (HOLIDAYS[name]) out[name] = Math.max(0, Number(day) || 0);
  }
  return out;
}

export const OUTSIDE = {
  season: pinned('season', SEASONS) ?? seasonOn(today, place.lat),
  holidays: query.has('holiday') ? fromQuery(query.get('holiday')) : holidaysOn(today, visitor ? [visitor.country] : [], evening),
  lat: place.lat,
};
