const test = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../../web3d/src/hash.js");

test("floorKey reads a floor's address in any case (#249)", async () => {
  const { floorKey } = await load();
  assert.equal(floorKey("#floor-5"), "5");
  assert.equal(floorKey("#FLOOR-3"), "3");
  assert.equal(floorKey("#floor-l"), "L");
});

test("floorKey sends the old one-page anchors to their floors, in any case", async () => {
  const { floorKey } = await load();
  assert.equal(floorKey("#about"), "L");
  assert.equal(floorKey("#Contact"), "R");
  assert.equal(floorKey("#floor-8"), "L");
  assert.equal(floorKey("#Floor-E"), "L", "the street's, which the city replaced: the lobby");
  assert.equal(floorKey("#floor-8", ["L", "1", "8", "R"]), "8", "a floor 8 that exists again is its own");
});

test("floorKey places nothing else", async () => {
  const { floorKey } = await load();
  for (const hash of ["", "#", "#building-stops", "#toggle-goatcounter", "#floor-", "#floor-5x!", "#xfloor-5"]) assert.equal(floorKey(hash), undefined, hash);
});

test("floorShaped picks out the floor addresses a stale link may still carry", async () => {
  const { floorShaped } = await load();
  assert.ok(floorShaped("#floor-9"));
  assert.ok(floorShaped("#FLOOR-42"));
  assert.ok(!floorShaped("#toggle-goatcounter"));
  assert.ok(!floorShaped("#building-stops"));
  assert.ok(!floorShaped(""));
});
