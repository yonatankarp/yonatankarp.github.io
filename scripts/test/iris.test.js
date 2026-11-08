// web3d/src/iris.js opens in the same 4x4 Bayer order as the lobby's dissolve into its shut doors (pixel.js, from
// floors.json, which gen_floors.py writes), so the push-in reads as one motion.
const test = require("node:test");
const assert = require("node:assert/strict");
const floors = require("../../static/building/pixel/floors.json");

test("the iris's Bayer matrix is floors.json's", async () => {
  const { BAYER } = await import("../../web3d/src/iris.js");
  assert.deepEqual(BAYER, floors.bayer.flat());
});
