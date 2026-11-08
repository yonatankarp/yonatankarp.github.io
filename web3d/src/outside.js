// What is going on outside, which dresses the art: the visitor's season and where they are, picked in the page's head
// with their hour (html[data-season] and html[data-place], from their time zone's main city in data/timezones.json,
// Berlin when unknown: assets/js/time-pick.js), and the holidays (calendar.js), which the city's plaza shows (props.js).
// Like ?time= and ?season=, the address can pin the holidays for testing: ?holiday=none or a list such as
// hanukkah:3,christmas (the number is the day of it, from 0). The Hebrew holidays begin at sunset there: past
// it, the evening already counts as the next day's (the first Hanukkah candle). The fireworks on the night of 31 December go
// by it too, and by the afternoon (props.js's dressing): a pin skips both, as if it were that night, so any hour shows them.
import { sunAt } from '../../assets/js/sun.js';
import { fromQuery, holidaysOn, isEvening } from './calendar.js';

const root = document.documentElement, query = new URLSearchParams(location.search);
const [lat, lon] = (root.dataset.place || '52.5,13.4').split(',').map(Number);
const today = new Date();
const evening = isEvening(today, sunAt(today.getTime(), lat, lon)[0]), pinned = query.has('holiday');

export const OUTSIDE = {
  season: root.dataset.season,
  holidays: pinned ? fromQuery(query.get('holiday')) : holidaysOn(today, evening),
  evening: pinned || evening,
  afternoon: !pinned && today.getHours() >= 12,
};
