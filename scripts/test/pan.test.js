const test = require("node:test");
const assert = require("node:assert/strict");

const load = () => import("../../web3d/src/pan.js");
const wheel = (deltaY, more = {}) => ({ deltaX: 0, deltaY, deltaMode: 0, ctrlKey: false, ...more });

test("an up or down wheel pans the street over a floating panel, in px, lines or pages", async () => {
  const { wheelPan } = await load();
  assert.equal(wheelPan(wheel(120), true, true, 1000), 120);
  assert.equal(wheelPan(wheel(-3, { deltaMode: 1 }), true, true, 1000), -120);
  assert.equal(wheelPan(wheel(1, { deltaMode: 2 }), true, true, 1000), 1000);
});

test("a pinch, a sideways turn, a stacked panel or a street that fits stay the browser's or the page's", async () => {
  const { wheelPan } = await load();
  assert.equal(wheelPan(wheel(120, { ctrlKey: true }), true, true, 1000), null);
  assert.equal(wheelPan(wheel(40, { deltaX: 60 }), true, true, 1000), null);
  assert.equal(wheelPan(wheel(120), false, true, 1000), null);
  assert.equal(wheelPan(wheel(120), true, false, 1000), null);
});
