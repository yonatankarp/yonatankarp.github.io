// What is going on outside, for a later pass that dresses the art for it: the visitor's season, their holidays and his
// own (calendar.js). Parked: nothing imports this module now (CLAUDE.md). The visitor is placed by their browser's
// timezone alone (data/timezones.json: its country and its main city), so nobody is asked for their location; an unknown
// zone gets his city, Berlin. Like ?time=, the address can pin each for testing: ?season=spring|summer|autumn|winter,
// ?holiday=none or a list such as hanukkah:3,christmas (the number is the day of it, from 0).
import TZ from '../../data/timezones.json';
import { HOLIDAYS, holidaysOn, seasonOn, placeOf } from './calendar.js';

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

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

export const OUTSIDE = {
  season: pinned('season', SEASONS) ?? seasonOn(today, place.lat),
  holidays: query.has('holiday') ? fromQuery(query.get('holiday')) : holidaysOn(today, visitor ? [visitor.country] : []),
  lat: place.lat,
};
