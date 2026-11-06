// assets/js/time-pick.js: the time of day from the real sun, at moments whose answer is known (sunset in Berlin on
// 2026-11-06 is 16:28 local, on 2026-06-21 21:34; in Sydney on 2026-12-21 20:06). Instants are UTC.
const test = require("node:test");
const assert = require("node:assert/strict");
const { runTimePick } = require("../lib");

const at = (zone, iso) => runTimePick({ zone, ms: Date.parse(iso) }).time;

test("Berlin in November: night an hour after sunset, no longer day at 16:00", () => {
  assert.equal(at("Europe/Berlin", "2026-11-06T11:00Z"), "day");     // 12:00 local
  assert.equal(at("Europe/Berlin", "2026-11-06T15:00Z"), "dusk");    // 16:00
  assert.equal(at("Europe/Berlin", "2026-11-06T16:31Z"), "night");   // 17:31
  assert.equal(at("Europe/Berlin", "2026-11-06T06:30Z"), "dawn");    // 07:30
});

test("Berlin at midsummer is still dusk at 21:00", () => {
  assert.equal(at("Europe/Berlin", "2026-06-21T19:00Z"), "dusk");
  assert.equal(at("Europe/Berlin", "2026-06-21T22:00Z"), "night");   // midnight
});

test("Jerusalem", () => {
  assert.equal(at("Asia/Jerusalem", "2026-11-06T04:00Z"), "dawn");   // 06:00 local
  assert.equal(at("Asia/Jerusalem", "2026-11-06T10:00Z"), "day");    // 12:00
  assert.equal(at("Asia/Jerusalem", "2026-11-06T14:40Z"), "dusk");   // 16:40
  assert.equal(at("Asia/Jerusalem", "2026-11-06T16:00Z"), "night");  // 18:00
});

test("Sydney in December, the southern summer", () => {
  assert.equal(at("Australia/Sydney", "2026-12-20T19:00Z"), "dawn");   // 06:00 local
  assert.equal(at("Australia/Sydney", "2026-12-21T02:00Z"), "day");    // 13:00
  assert.equal(at("Australia/Sydney", "2026-12-21T09:00Z"), "dusk");   // 20:00
  assert.equal(at("Australia/Sydney", "2026-12-21T11:00Z"), "night");  // 22:00
});

test("Tromsø in mid-December, the polar night: never day, a twilight dawn and dusk around noon", () => {
  const { sunPhase } = runTimePick({ ms: 0 });
  const seen = new Set();
  for (let ms = Date.UTC(2026, 11, 15); ms < Date.UTC(2026, 11, 16); ms += 10 * 60e3) seen.add(sunPhase(ms, 69.65, 18.96));
  assert.deepEqual([...seen].sort(), ["dawn", "dusk", "night"]);
});

test("An old zone name is found by its link; an unknown zone, or none, is Berlin", () => {
  assert.equal(at("Asia/Calcutta", "2026-11-06T06:30Z"), "day");   // noon in Kolkata, dawn in Berlin
  assert.equal(at("Japan", "2026-11-06T03:00Z"), "day");           // a link with no folder
  assert.equal(at("Mars/Olympus", "2026-11-06T06:30Z"), "dawn");
  assert.equal(at("Etc/GMT+5", "2026-11-06T06:30Z"), "dawn");
  assert.equal(at(undefined, "2026-11-06T06:30Z"), "dawn");
});
