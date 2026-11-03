const test = require("node:test");
const assert = require("node:assert/strict");
const { isAllowedRedirect } = require("../check-csp");

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
