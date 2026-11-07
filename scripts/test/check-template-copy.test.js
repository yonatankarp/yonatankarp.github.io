const test = require("node:test");
const assert = require("node:assert/strict");
const { findCopy } = require("../check-template-copy");

const texts = (source) => findCopy(source).map((f) => f.text);

test("findCopy finds words in text nodes, with their lines", () => {
  assert.deepEqual(findCopy("<div>\n  <h1>That page is not here</h1>\n</div>"), [{ line: 2, text: "That page is not here" }]);
  assert.deepEqual(texts("<p>{{ len .Pages }} posts</p>"), ["posts"]);
});

test("findCopy passes words inside {{ }}, its comments included, even across lines", () => {
  assert.deepEqual(texts('<h1>{{ .Title }}</h1>{{/* a comment with words */}}\n{{- /* more\n words */ -}}<p>{{ printf "%d posts" 3 }}</p>'), []);
});

test("findCopy finds prose in alt, aria-label, title and placeholder, and in a <meta>'s description", () => {
  assert.deepEqual(texts('<img src="a.webp" alt="A reading room at dusk">'), ['alt="A reading room at dusk"']);
  assert.deepEqual(texts('<nav aria-label="Floor {{ .floor }} in the building"></nav>'), ['aria-label="Floor in the building"']);
  assert.deepEqual(texts('<input placeholder="Search posts" title="Search">'), ['placeholder="Search posts"', 'title="Search"']);
  assert.deepEqual(texts('<meta name="description" content="Words about the site">'), ['content="Words about the site"']);
  assert.deepEqual(texts('<meta name="viewport" content="width=device-width, initial-scale=1"><img alt="{{ .alt }}" class="wide cover">'), []);
});

test("findCopy passes scripts, styles, svg and HTML comments", () => {
  assert.deepEqual(texts("<script>var label = 'Play the animation';</script><style>body { color: red; }</style>"), []);
  assert.deepEqual(texts('<svg viewBox="0 0 1 1"><title>An icon</title></svg><!-- a note -->'), []);
});

test("findCopy passes arrows, dots, punctuation, entities and one-character badges", () => {
  assert.deepEqual(texts("<a>{{ .x }} →</a> · <b>R</b> <i>1</i> <p>404</p> <span>&#8599; &nbsp; ↑ ( ) : .</span>"), []);
});

test("findCopy reads plain text and Markdown templates, outside {{ }}", () => {
  assert.deepEqual(texts("# {{ site.Title }}\n\n## {{ .heading }}\n- [{{ .t }}]({{ .u }}): {{ .text }}"), []);
  assert.deepEqual(texts("## Key pages\n- {{ .label }}: {{ .url }}"), ["## Key pages"]);
});
