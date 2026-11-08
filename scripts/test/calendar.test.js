// web3d/src/calendar.js: the seasons and holidays for the dressing, on dates whose answer is known.
const test = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../../web3d/src/calendar.js");
const on = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };

test("Hanukkah counts its nights from 25 Kislev, and is kept for every visitor", async () => {
  const { holidaysOn } = await load();
  assert.equal(holidaysOn(on("2026-12-04")).hanukkah, undefined);
  assert.equal(holidaysOn(on("2026-12-05")).hanukkah, 0);
  assert.equal(holidaysOn(on("2026-12-12")).hanukkah, 7);
  assert.equal(holidaysOn(on("2026-12-13")).hanukkah, undefined);
  assert.equal(holidaysOn(on("2027-12-25")).hanukkah, 0);
  assert.equal(holidaysOn(on("2027-12-25")).christmas, 24);   // both at once
});

test("a Hebrew day begins at sunset: the first candle is lit on the evening before 25 Kislev", async () => {
  const { holidaysOn, HOLIDAYS } = await load();
  assert.equal(HOLIDAYS.hanukkah.first(on("2026-12-04")), -1);       // noon on Friday 4 December
  assert.equal(holidaysOn(on("2026-12-04")).hanukkah, undefined);
  assert.equal(holidaysOn(on("2026-12-04"), true).hanukkah, 0);  // that evening
  assert.equal(holidaysOn(on("2026-12-05"), true).hanukkah, 1);
  assert.equal(holidaysOn(on("2026-12-12"), true).hanukkah, undefined);   // the eighth day's evening ends it
  assert.equal(holidaysOn(on("2026-11-30"), true).christmas, undefined);   // Christmas still begins at midnight
});

test("Rosh Hashanah, Passover, Purim, Shavuot and Lag BaOmer, by their Hebrew dates", async () => {
  const { holidaysOn } = await load();
  const span = (name, from, to) => {   // the holiday's first and last civil day, and none either side
    const d = on(from), last = on(to), n = Math.round((last - d) / 864e5);
    assert.equal(holidaysOn(new Date(d.getFullYear(), d.getMonth(), d.getDate() - 1))[name], undefined, `${name} before ${from}`);
    assert.equal(holidaysOn(d)[name], 0, `${name} on ${from}`);
    assert.equal(holidaysOn(last)[name], n, `${name} on ${to}`);
    assert.equal(holidaysOn(new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1))[name], undefined, `${name} after ${to}`);
  };
  span("rosh-hashanah", "2026-09-12", "2026-09-13");
  span("rosh-hashanah", "2027-10-02", "2027-10-03");
  span("passover", "2026-04-02", "2026-04-08");
  span("passover", "2027-04-22", "2027-04-28");
  span("purim", "2026-03-03", "2026-03-03");
  span("purim", "2027-03-23", "2027-03-23");   // 14 Adar II, in a leap year
  assert.equal(holidaysOn(on("2027-02-21")).purim, undefined);   // 14 Adar I
  span("shavuot", "2026-05-22", "2026-05-22");
  span("shavuot", "2028-05-31", "2028-05-31");
  span("lag-baomer", "2026-05-05", "2026-05-05");
  span("lag-baomer", "2027-05-25", "2027-05-25");
});

test("Independence Day keeps 5 Iyar, moved off Friday and Saturday to Thursday and off Monday to Tuesday", async () => {
  const { holidaysOn } = await load();
  const kept = (iso, evening = false) => holidaysOn(on(iso), evening)["yom-haatzmaut"];
  assert.equal(kept("2026-04-22"), 0);   // 5 Iyar on a Wednesday: kept on it
  assert.equal(kept("2026-04-21", true), 0);
  for (const [iyar5, day] of [["2029-04-20", "2029-04-19"], ["2045-04-22", "2045-04-20"], ["2028-05-01", "2028-05-02"]]) {   // Friday, Saturday, Monday
    assert.equal(kept(day), 0, day);
    assert.equal(kept(iyar5), undefined, iyar5);
    const eve = on(day); eve.setDate(eve.getDate() - 1);
    assert.equal(holidaysOn(eve, true)["yom-haatzmaut"], 0, `the evening before ${day}`);
  }
  for (let y = 2026; y <= 2050; y++) {   // it never shares a day with another holiday
    for (let d = new Date(y, 3, 1); d.getMonth() < 5; d.setDate(d.getDate() + 1)) {
      for (const evening of [false, true]) {
        const h = holidaysOn(d, evening);
        if ("yom-haatzmaut" in h) assert.deepEqual(Object.keys(h), ["yom-haatzmaut"], `${d.toDateString()}${evening ? " evening" : ""}`);
      }
    }
  }
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

test("Halloween's last week, 24 to 31 October, by the date alone", async () => {
  const { holidaysOn } = await load();
  assert.equal(holidaysOn(on("2026-10-23")).halloween, undefined);
  assert.equal(holidaysOn(on("2026-10-24")).halloween, 0);
  assert.equal(holidaysOn(on("2026-10-31")).halloween, 7);
  assert.equal(holidaysOn(on("2026-10-31"), true).halloween, 7);   // not a sunset holiday: the evening is still the 31st
  assert.equal(holidaysOn(on("2026-11-01")).halloween, undefined);
  assert.equal(holidaysOn(on("2026-09-24")).halloween, undefined);
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

test("seasons turn on the first of the month, and the tropics end at 23.5 degrees", async () => {
  const { seasonOn } = await load();
  assert.deepEqual([on("2026-11-30"), on("2026-12-01"), on("2027-02-28"), on("2027-03-01")].map((d) => seasonOn(d, 52.5)), ["autumn", "winter", "winter", "spring"]);
  assert.deepEqual([on("2026-11-30"), on("2026-12-01"), on("2027-02-28"), on("2027-03-01")].map((d) => seasonOn(d, -33.9)), ["spring", "summer", "summer", "autumn"]);
  assert.equal(seasonOn(on("2026-01-15"), 23.5), "winter");
  assert.equal(seasonOn(on("2026-07-15"), -23.5), "winter");
  assert.equal(seasonOn(on("2026-01-15"), 23.4), "summer");
  assert.equal(seasonOn(on("2026-07-15"), -23.4), "summer");
});

test("?holiday= pins the holidays: none, a day each, and nothing the calendar does not keep", async () => {
  const { fromQuery } = await load();
  assert.deepEqual(fromQuery("none"), {});
  assert.deepEqual(fromQuery("hanukkah:3,christmas"), { hanukkah: 3, christmas: 0 });
  assert.deepEqual(fromQuery(" hanukkah:3 , christmas "), { hanukkah: 3, christmas: 0 });
  assert.deepEqual(fromQuery("hanukkah:-2"), { hanukkah: 0 });
  assert.deepEqual(fromQuery("hanukkah:abc"), { hanukkah: 0 });
  assert.deepEqual(fromQuery("sukkot:1,diwali,yule,toString,__proto__"), { sukkot: 1 });
  assert.deepEqual(fromQuery("halloween,new-year:1"), { halloween: 0, "new-year": 1 });
});

test("the evening begins past sunset in the afternoon, the sun's top below -0.833 degrees", async () => {
  const { isEvening } = await load();
  const at = (hour) => new Date(2026, 11, 4, hour);
  assert.equal(isEvening(at(16), -0.9), true);
  assert.equal(isEvening(at(12), -0.84), true);
  assert.equal(isEvening(at(16), -0.833), false);   // the sun's top on the horizon: not yet
  assert.equal(isEvening(at(13), -0.8), false);
  assert.equal(isEvening(at(11), -10), false);       // before noon it is the morning, even in the dark
  assert.equal(isEvening(at(23), -40), true);
});
