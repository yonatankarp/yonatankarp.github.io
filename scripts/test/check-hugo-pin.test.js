const test = require("node:test");
const assert = require("node:assert/strict");
const { versionOrder, isBehind, checksumProblems } = require("../check-hugo-pin");

test("versionOrder splits a version into numbers", () => {
  assert.deepEqual(versionOrder("0.169.0"), [0, 169, 0]);
  assert.deepEqual(versionOrder("1.2"), [1, 2]);
});

test("isBehind compares numerically, not as text", () => {
  assert.equal(isBehind("0.169.0", "0.170.0"), true);
  assert.equal(isBehind("0.99.0", "0.169.0"), true);
  assert.equal(isBehind("0.169.1", "0.169.0"), false);
  assert.equal(isBehind("0.169.0", "0.169.0"), false);
  assert.equal(isBehind("1.0.0", "0.999.9"), false);
});

test("isBehind treats a missing part as 0", () => {
  assert.equal(isBehind("0.169", "0.169.0"), false);
  assert.equal(isBehind("0.169", "0.169.1"), true);
});

test("checksumProblems names a missing or wrong checksum, and nothing when it matches", () => {
  const pin = { file: ".github/hugo.env", version: "0.169.0", sha256: "a".repeat(64) };
  assert.deepEqual(checksumProblems(pin, "a".repeat(64)), []);
  const [wrong] = checksumProblems(pin, "b".repeat(64));
  assert.match(wrong, /pins HUGO_SHA256 `a{64}`; hugo_extended_0\.169\.0_linux-amd64\.deb is published as `b{64}`/);
  const [missing] = checksumProblems({ ...pin, sha256: null }, "b".repeat(64));
  assert.match(missing, /has no HUGO_SHA256/);
});
