const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("path");
const { publicDir, routeToPublicPath, collectAttribute } = require("../lib");

test("routeToPublicPath serves a folder's index.html", () => {
  assert.equal(routeToPublicPath("/"), path.join(publicDir, "index.html"));
  assert.equal(routeToPublicPath(""), path.join(publicDir, "index.html"));
  assert.equal(routeToPublicPath("/blog/"), path.join(publicDir, "blog", "index.html"));
  assert.equal(routeToPublicPath("/blog"), path.join(publicDir, "blog", "index.html"));
});

test("routeToPublicPath serves a path with an extension as the file", () => {
  assert.equal(routeToPublicPath("/yonatan-karp-rudin-cv.pdf"), path.join(publicDir, "yonatan-karp-rudin-cv.pdf"));
  assert.equal(routeToPublicPath("/building/pixel/exterior.json"), path.join(publicDir, "building", "pixel", "exterior.json"));
});

test("routeToPublicPath decodes percent escapes and extra slashes", () => {
  assert.equal(routeToPublicPath("/tags/c%23/"), path.join(publicDir, "tags", "c#", "index.html"));
  assert.equal(routeToPublicPath("//blog/"), path.join(publicDir, "blog", "index.html"));
});

test("routeToPublicPath takes a URL's pathname, so a query never reaches the file name (#188)", () => {
  const url = new URL("/?time=day#floor-5", "https://yonatankarp.com");
  assert.equal(routeToPublicPath(url.pathname), path.join(publicDir, "index.html"));
  assert.equal(routeToPublicPath(new URL("/search/?q=kotlin", "https://yonatankarp.com").pathname), path.join(publicDir, "search", "index.html"));
});

test("collectAttribute reads quoted and unquoted values, and empty ones", () => {
  assert.equal(collectAttribute('<a href="/blog/" class=x>', "href"), "/blog/");
  assert.equal(collectAttribute("<a href='/cv/'>", "href"), "/cv/");
  assert.equal(collectAttribute("<a href=/projects/ class=x>", "href"), "/projects/");
  assert.equal(collectAttribute("<a class=x>", "href"), null);
  assert.equal(collectAttribute('<img alt="" src=x>', "alt"), "");
});

test("collectAttribute does not read another attribute that ends in the name (#252)", () => {
  assert.equal(collectAttribute('<a data-href="/real/" href="/missing-page/">', "href"), "/missing-page/");
  assert.equal(collectAttribute('<div data-id="x" id="y">', "id"), "y");
  assert.equal(collectAttribute('<div data-id="x">', "id"), null);
  assert.equal(collectAttribute("<a data-href=/real/>", "href"), null);
});

test("collectAttribute skips attribute-like text inside quoted values (#252)", () => {
  assert.equal(collectAttribute('<a title="see href=z" href="/real/">', "href"), "/real/");
  assert.equal(collectAttribute("<a title='see href=\"z\"' href=/real/>", "href"), "/real/");
  assert.equal(collectAttribute('<a title="see href=z">', "href"), null);
});

test("collectAttribute reads unquoted values with = and ?, single quotes, spaces around =, any case (#252)", () => {
  assert.equal(collectAttribute("<a href=/?time=day class=x>", "href"), "/?time=day");
  assert.equal(collectAttribute("<a class=x href='/a b/'>", "href"), "/a b/");
  assert.equal(collectAttribute('<a href = "/spaced/">', "href"), "/spaced/");
  assert.equal(collectAttribute('<A HREF="/upper/">', "href"), "/upper/");
  assert.equal(collectAttribute('<img alt src="/x.png">', "alt"), null);
  assert.equal(collectAttribute('<a hidden href="/after-boolean/">', "href"), "/after-boolean/");
  assert.equal(collectAttribute('<a href="/first/" href="/second/">', "href"), "/first/");
});
