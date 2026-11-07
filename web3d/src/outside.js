// What is going on outside, which dresses the art: the visitor's season and where they are, picked in the page's head
// with their hour (html[data-season] and html[data-place], from their time zone's main city in data/timezones.json,
// Berlin when unknown: assets/js/time-pick.js), and the holidays (calendar.js), which the city's plaza shows (props.js).
// Like ?time= and ?season=, the address can pin the holidays for testing: ?holiday=none or a list such as
// hanukkah:3,christmas (the number is the day of it, from 0). The Hebrew and Islamic holidays begin at sunset there: past
// it, the evening already counts as the next day's (the first Hanukkah candle).
import { sunAt } from '../../assets/js/sun.js';
import { HOLIDAYS, holidaysOn } from './calendar.js';

const root = document.documentElement, query = new URLSearchParams(location.search);
const [lat, lon] = (root.dataset.place || '52.5,13.4').split(',').map(Number);
const today = new Date();
// Past sunset (the sun's top below the horizon, -0.833 degrees) and still the same date: the afternoon goes by the
// clock, not the sun's hour angle, since the holidays change at the date's midnight, which solar midnight is not.
// shortcut: in the polar night it is true from noon, and in the midnight sun never; give those a fixed hour if it matters.
const evening = today.getHours() >= 12 && sunAt(today.getTime(), lat, lon)[0] < -0.833;

function fromQuery(list) {
  const out = {};
  for (const item of list.split(',')) {
    const [name, day] = item.trim().split(':');
    if (HOLIDAYS[name]) out[name] = Math.max(0, Number(day) || 0);
  }
  return out;
}

export const OUTSIDE = {
  season: root.dataset.season,
  // shortcut: the visitor's country is not looked up (placeOf and data/timezones.json would add 7 KB to the city's
  // bundle), so only his holidays (HOME's) and everyone's come up; look it up once a prop for another country's is painted.
  holidays: query.has('holiday') ? fromQuery(query.get('holiday')) : holidaysOn(today, [], evening),
};
