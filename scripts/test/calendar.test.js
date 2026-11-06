// web3d/src/calendar.js: the seasons and holidays for the parked dressing, on dates whose answer is known.
const test = require("node:test");
const assert = require("node:assert/strict");
const table = require("../../data/timezones.json");

const load = () => import("../../web3d/src/calendar.js");
const on = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };

test("Hanukkah counts its nights from 25 Kislev, and is kept for every visitor", async () => {
  const { holidaysOn } = await load();
  assert.equal(holidaysOn(on("2026-12-04")).hanukkah, undefined);
  assert.equal(holidaysOn(on("2026-12-05")).hanukkah, 0);
  assert.equal(holidaysOn(on("2026-12-12")).hanukkah, 7);
  assert.equal(holidaysOn(on("2026-12-13")).hanukkah, undefined);
  assert.equal(holidaysOn(on("2027-12-25"), ["US"]).hanukkah, 0);
  assert.equal(holidaysOn(on("2027-12-25"), ["US"]).christmas, 24);   // both at once
});

test("Sukkot, Easter, Christmas and the new year", async () => {
  const { holidaysOn, easter } = await load();
  assert.equal(holidaysOn(on("2026-09-26")).sukkot, 0);
  assert.equal(holidaysOn(on("2026-10-02")).sukkot, 6);
  assert.deepEqual([easter(2026), easter(2027), easter(2028)].map((d) => d.toDateString()), ["Sun Apr 05 2026", "Sun Mar 28 2027", "Sun Apr 16 2028"]);
  assert.equal(holidaysOn(on("2026-04-05")).easter, 7);
  assert.equal(holidaysOn(on("2026-04-07")).easter, undefined);
  assert.equal(holidaysOn(on("2026-12-01")).christmas, 0);
  assert.equal(holidaysOn(on("2026-12-27")).christmas, undefined);
  assert.equal(holidaysOn(on("2026-12-31"))["new-year"], 0);
  assert.equal(holidaysOn(on("2027-01-01"))["new-year"], 1);
});

test("the visitor's own holidays show only for their country", async () => {
  const { holidaysOn } = await load();
  assert.equal(holidaysOn(on("2026-10-31")).halloween, undefined);
  assert.equal(holidaysOn(on("2026-10-31"), ["US"]).halloween, 7);
  assert.equal(holidaysOn(on("2026-11-08"), ["IN"]).diwali, 2);
  assert.equal(holidaysOn(on("2026-11-08"), ["FR"]).diwali, undefined);
  assert.equal(holidaysOn(on("2026-03-20"), ["TR"])["eid-al-fitr"], 0);
  assert.equal(holidaysOn(on("2026-05-27"), ["ID"])["eid-al-adha"], 0);
  assert.equal(holidaysOn(on("2026-02-17"), ["SG"])["lunar-new-year"], 0);
  assert.equal(holidaysOn(on("2026-03-03"), ["SG"])["lunar-new-year"], 14);
  assert.equal(holidaysOn(on("2026-02-17"), ["DE"])["lunar-new-year"], undefined);
});

test("seasons flip south of the equator, and the tropics have none", async () => {
  const { seasonOn } = await load();
  assert.equal(seasonOn(on("2026-01-15"), 52.5), "winter");
  assert.equal(seasonOn(on("2026-04-15"), 52.5), "spring");
  assert.equal(seasonOn(on("2026-07-15"), 52.5), "summer");
  assert.equal(seasonOn(on("2026-10-15"), 52.5), "autumn");
  assert.equal(seasonOn(on("2026-01-15"), -33.9), "summer");
  assert.equal(seasonOn(on("2026-07-15"), -33.9), "winter");
  assert.equal(seasonOn(on("2026-01-15"), 1.3), "summer");
});

test("a timezone, or an old name for one, gives its country and where it is", async () => {
  const { placeOf } = await load();
  assert.deepEqual(placeOf("Europe/Berlin", table), { country: "DE", lat: 52.5, lon: 13.4 });
  assert.equal(placeOf("Asia/Calcutta", table).country, "IN");
  assert.equal(placeOf("Australia/Sydney", table).lat < 0, true);
  assert.equal(placeOf("Etc/UTC", table), null);
});

test("WMO weather codes fall into the five skies", async () => {
  const { weatherOf } = await load();
  assert.deepEqual([0, 1, 2, 3, 45, 48, 51, 63, 66, 71, 75, 77, 80, 85, 95, 99].map(weatherOf),
    ["clear", "clear", "cloudy", "cloudy", "fog", "fog", "rain", "rain", "rain", "snow", "snow", "snow", "rain", "snow", "rain", "rain"]);
});

test("the Diwali table still covers next year", async () => {
  const { DIWALI } = await load();
  const next = new Date().getFullYear() + 1;
  assert.ok(DIWALI[next], `web3d/src/calendar.js: DIWALI has no date for ${next}; add the next years' Lakshmi Puja dates`);
});
