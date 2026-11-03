const test = require("node:test");
const assert = require("node:assert/strict");
const { expiryStatus } = require("../check-security-txt");

const file = "Contact: mailto:me@yonatankarp.com\nExpires: 2027-10-01T00:00:00.000Z\nPreferred-Languages: en\n";

test("expiryStatus is ok while Expires is more than 60 days away", () => {
  assert.equal(expiryStatus(file, new Date("2027-07-01T00:00:00Z")).level, "ok");
});

test("expiryStatus warns within 60 days of Expires", () => {
  const status = expiryStatus(file, new Date("2027-08-15T00:00:00Z"));
  assert.equal(status.level, "warn");
  assert.match(status.message, /expires 2027-10-01 in 47 days/);
  assert.equal(expiryStatus(file, new Date("2027-09-30T23:00:00Z")).level, "warn");
});

test("expiryStatus fails once Expires has passed", () => {
  const status = expiryStatus(file, new Date("2027-10-01T00:00:01Z"));
  assert.equal(status.level, "fail");
  assert.match(status.message, /expired on 2027-10-01/);
});

test("expiryStatus fails on a missing or unreadable Expires, so the check never watches nothing", () => {
  assert.equal(expiryStatus("Contact: mailto:me@yonatankarp.com\n", new Date()).level, "fail");
  assert.equal(expiryStatus("Expires: next year\n", new Date()).level, "fail");
});
