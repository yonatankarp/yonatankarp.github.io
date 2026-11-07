const test = require("node:test");
const assert = require("node:assert/strict");
const { isAllowedRedirect, isFailedResponse } = require("../check-csp");

test("isAllowedRedirect lets a redirect page send its reader to the site or to a post's copy on dev.to", () => {
  assert.equal(isAllowedRedirect("/"), true);
  assert.equal(isAllowedRedirect("/#floor-5"), true);
  assert.equal(isAllowedRedirect("https://yonatankarp.com/blog/"), true);
  assert.equal(isAllowedRedirect("https://dev.to/yonatankarp/a-post"), true);
});

test("isAllowedRedirect refuses another site, however it is spelled (#252)", () => {
  assert.equal(isAllowedRedirect("//evil.example/"), false);
  assert.equal(isAllowedRedirect("/\\evil.example/"), false);
  assert.equal(isAllowedRedirect("https://yonatankarp.com.evil.example/"), false);
  assert.equal(isAllowedRedirect("https://dev.to/someone-else/"), false);
  assert.equal(isAllowedRedirect("http://yonatankarp.com/"), false);
  assert.equal(isAllowedRedirect("javascript:alert(1)"), false);
  assert.equal(isAllowedRedirect(""), false);
});

test("isFailedResponse fails the site's own 4xx and 5xx, but not the missing route's 404 or another site's", () => {
  const base = "http://127.0.0.1:4000";
  assert.equal(isFailedResponse(`${base}/building/pixel/city-fx.json?v=1`, 404, base), true);
  assert.equal(isFailedResponse(`${base}/search/index.json`, 500, base), true);
  assert.equal(isFailedResponse(`${base}/this-page-does-not-exist/`, 404, base), false);
  assert.equal(isFailedResponse(`${base}/building/pixel/city-fx.json`, 200, base), false);
  assert.equal(isFailedResponse(`${base}/`, 304, base), false);
  assert.equal(isFailedResponse("https://gc.zgo.at/count.v5.js", 404, base), false);
});
