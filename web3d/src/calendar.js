// The calendar behind the seasonal and holiday dressing (outside.js): the season at a latitude and the holidays on
// a date, worked out in the browser, with no service to ask. Pure, so scripts/test/calendar.test.js runs it under Node.
// The Jewish, Chinese and Islamic dates come from the browser's own calendars (Intl, with ICU's); Easter is a formula;
// Diwali, whose date neither gives, is a table.

// Whose holidays the building keeps besides the visitor's: his (Israel, and Germany, where he lives).
export const HOME = ['IL', 'DE'];

// Diwali's main day (Lakshmi Puja), the new moon of Kartika. A test fails once this runs out: add the next years.
export const DIWALI = { 2026: '11-08', 2027: '10-29', 2028: '10-17', 2029: '11-05', 2030: '10-26', 2031: '11-13', 2032: '11-02' };

const EID = ['AE', 'AF', 'AL', 'AZ', 'BD', 'BF', 'BH', 'BN', 'DJ', 'DZ', 'EG', 'GM', 'GN', 'ID', 'IQ', 'IR', 'JO', 'KG', 'KM', 'KW', 'KZ', 'LB', 'LY', 'MA', 'ML', 'MR', 'MV', 'MY', 'NE', 'NG', 'OM', 'PK', 'PS', 'QA', 'SA', 'SD', 'SN', 'SO', 'SY', 'TD', 'TJ', 'TM', 'TN', 'TR', 'UZ', 'XK', 'YE'];

// Each holiday: where it is kept (HOME's are kept for everyone), and how many days of decorations from its first.
// first(date) says which day of it the date is (0 for its first), or -1. A `sunset` one follows a calendar whose day
// begins at sunset (the Hebrew and the Islamic): after sunset it is already the next day's (holidaysOn's `evening`).
// Left out on purpose: Yom Kippur, Yom HaShoah and Yom HaZikaron, solemn days that get no festive dressing.
export const HOLIDAYS = {
  'new-year': { where: 'all', first: (d) => (d.getMonth() === 11 && d.getDate() === 31 ? 0 : d.getMonth() === 0 && d.getDate() === 1 ? 1 : -1) },
  'lunar-new-year': { where: ['CN', 'HK', 'KR', 'MO', 'MY', 'SG', 'TW', 'VN'], first: (d) => sinceDay(d, 'chinese', '1', 1, 15) },   // to the Lantern Festival
  'eid-al-fitr': { where: EID, sunset: true, first: (d) => sinceDay(d, 'islamic-umalqura', '10', 1, 3) },
  'eid-al-adha': { where: EID, sunset: true, first: (d) => sinceDay(d, 'islamic-umalqura', '12', 10, 4) },
  purim: { where: HOME, sunset: true, first: (d) => Math.max(sinceDay(d, 'hebrew', 'Adar', 14, 1), sinceDay(d, 'hebrew', 'Adar II', 14, 1)) },   // Adar II in a leap year
  passover: { where: HOME, sunset: true, first: (d) => sinceDay(d, 'hebrew', 'Nisan', 15, 7) },   // seven days, as kept in Israel
  easter: { where: HOME, first: (d) => within(d, easter(d.getFullYear()), -7, 1) },   // Palm Sunday to Easter Monday, when Germany's egg trees are out
  'yom-haatzmaut': { where: HOME, sunset: true, first: independenceDay },
  'lag-baomer': { where: HOME, sunset: true, first: (d) => sinceDay(d, 'hebrew', 'Iyar', 18, 1) },   // its bonfires
  shavuot: { where: HOME, sunset: true, first: (d) => sinceDay(d, 'hebrew', 'Sivan', 6, 1) },
  'rosh-hashanah': { where: HOME, sunset: true, first: (d) => sinceDay(d, 'hebrew', 'Tishri', 1, 2) },
  sukkot: { where: HOME, sunset: true, first: (d) => sinceDay(d, 'hebrew', 'Tishri', 15, 7) },
  halloween: { where: ['CA', 'GB', 'IE', 'US'], first: (d) => (d.getMonth() === 9 && d.getDate() >= 24 ? d.getDate() - 24 : -1) },
  diwali: { where: ['FJ', 'GY', 'IN', 'LK', 'MU', 'MY', 'NP', 'SG', 'SR', 'TT'], first: (d) => (DIWALI[d.getFullYear()] ? within(d, local(`${d.getFullYear()}-${DIWALI[d.getFullYear()]}`), -2, 2) : -1) },   // Dhanteras to Bhai Dooj
  hanukkah: { where: HOME, sunset: true, first: (d) => sinceDay(d, 'hebrew', 'Kislev', 25, 8) },
  christmas: { where: HOME, first: (d) => (d.getMonth() === 11 && d.getDate() <= 26 ? d.getDate() - 1 : -1) },   // the lights are up all of Advent
};

// The holidays on a date, for a visitor from one of `countries` (none known: HOME's alone), with which day of each it is:
// { hanukkah: 3 } is its fourth day, the fourth candle. `evening`: the sun has set where they are, so the sunset
// holidays go by the next day (the first candle is lit on the evening before 25 Kislev).
export function holidaysOn(date, countries = [], evening = false) {
  const out = {}, next = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  for (const [name, h] of Object.entries(HOLIDAYS)) {
    if (h.where !== 'all' && !h.where.some((c) => HOME.includes(c) || countries.includes(c))) continue;
    const day = h.first(evening && h.sunset ? next : date);
    if (day >= 0) out[name] = day;
  }
  return out;
}

// Whether the sunset holidays already go by the next day (holidaysOn's `evening`): past sunset where the visitor is (the
// sun's top below the horizon, -0.833 degrees: `elevation`, from assets/js/sun.js) and still the same date. The afternoon
// goes by the clock, not the sun's hour angle, since the holidays change at the date's midnight, which solar midnight is not.
// shortcut: in the polar night it is true from noon, and in the midnight sun never; give those a fixed hour if it matters.
export const isEvening = (date, elevation) => date.getHours() >= 12 && elevation < -0.833;

// The holidays the address pins (?holiday=), for testing: none, or a list such as hanukkah:3,christmas, the number the day
// of it from 0 (none, or one that is not a whole day or is below 0, is its first). A name the calendar does not keep is left out.
export function fromQuery(list) {
  const out = {};
  for (const item of list.split(',')) {
    const [name, day] = item.trim().split(':');
    if (Object.hasOwn(HOLIDAYS, name)) out[name] = Math.max(0, Number(day) || 0);
  }
  return out;
}

// The season at a latitude (assets/js/season.js, which the page's head picks it by too).
export { seasonOn } from '../../assets/js/season.js';

// Where a timezone is, from data/timezones.json: its country and its main city's latitude and longitude, or null.
export function placeOf(zone, table) {
  const at = table.zones[zone] ?? table.zones[table.links[zone]];
  return at ? { country: at[0], lat: at[1], lon: at[2] } : null;
}

// What the sky is doing, from Open-Meteo's WMO weather code: clear, cloudy, fog, rain or snow.
export function weatherOf(code) {
  if (code >= 95 || (code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code === 45 || code === 48) return 'fog';
  return code >= 2 ? 'cloudy' : 'clear';
}

const DAY = 86400000;
const local = (iso) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
const midnight = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const days = (a, b) => Math.round((midnight(a) - midnight(b)) / DAY);
// Which day of [start + from, start + to] the date is, or -1.
const within = (d, start, from, to) => { const n = days(d, start); return n >= from && n <= to ? n - from : -1; };

// The date's day and month in another calendar. The date's own day, read at noon UTC, so no timezone moves it across midnight.
const formats = {};
function inCalendar(d, calendar) {
  const f = (formats[calendar] ??= new Intl.DateTimeFormat(`en-u-ca-${calendar}`, { timeZone: 'UTC', month: calendar === 'hebrew' ? 'long' : 'numeric', day: 'numeric' }));
  if (f.resolvedOptions().calendar !== calendar) return null;   // a browser without it: that holiday just does not show
  const parts = Object.fromEntries(f.formatToParts(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate(), 12)).map((p) => [p.type, p.value]));
  return { month: parts.month, day: Number(parts.day) };
}
// Which day of a holiday `length` days long, from `day` of `month` in `calendar`, the date is, or -1: it looks back
// day by day for its first. Month by name or number, as Intl writes it (Hebrew's leap month makes numbers move).
function sinceDay(d, calendar, month, day, length) {
  for (let n = 0; n < length; n++) {
    const c = inCalendar(new Date(d.getFullYear(), d.getMonth(), d.getDate() - n), calendar);
    if (!c) return -1;
    if (c.month === month && c.day === day) return n;
  }
  return -1;
}

// Israel's Independence Day, 5 Iyar, which falls only on a Monday, Wednesday, Friday or Saturday, as the law moves it:
// a Friday's or a Saturday's back to the Thursday before, a Monday's on to the Tuesday. 0 on the day it is kept, or -1.
const IYAR_5 = { 3: [0], 4: [1, 2], 2: [-1] };   // the day kept, by weekday: how many days from it 5 Iyar is
function independenceDay(d) {
  return (IYAR_5[d.getDay()] ?? []).some((k) => sinceDay(new Date(d.getFullYear(), d.getMonth(), d.getDate() + k), 'hebrew', 'Iyar', 5, 1) === 0) ? 0 : -1;
}

// Western Easter Sunday (the anonymous Gregorian computus).
export function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), dayOf = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, dayOf);
}
