const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("crypto");
const { diagramSource, diagramKey, findDiagrams, plan } = require("../render-diagrams");

const post = [
  "Some text.",
  "",
  "```kotlin",
  "val x = 1",
  "```",
  "",
  '```mermaid {title="Keys in buckets" desc="Two keys go into bucket 1."}',
  "flowchart LR",
  "    k1[key_1] --> B1",
  "    k2[key_2] --> B1",
  "```",
  "",
  '```mermaid {title="Flow" desc="A asks B."}',
  "sequenceDiagram",
  "    A->>B: ask",
  "",
  "```",
  "",
].join("\n");

test("diagramSource puts the title and description after the first line, as the render hook does", () => {
  assert.equal(
    diagramSource("T", "D", "\nflowchart LR\n    a --> b\n"),
    "flowchart LR\n    accTitle: T\n    accDescr: D\n    a --> b",
  );
});

test("diagramKey is the source's sha256, which the hook names the file by", () => {
  assert.equal(diagramKey("x"), crypto.createHash("sha256").update("x").digest("hex"));
});

test("findDiagrams finds each mermaid fence, with its title, and nothing else", () => {
  const diagrams = findDiagrams(post);
  assert.deepEqual(diagrams.map((d) => d.title), ["Keys in buckets", "Flow"]);
  assert.equal(diagrams[0].source, "flowchart LR\n    accTitle: Keys in buckets\n    accDescr: Two keys go into bucket 1.\n    k1[key_1] --> B1\n    k2[key_2] --> B1");
  assert.equal(diagrams[1].source, "sequenceDiagram\n    accTitle: Flow\n    accDescr: A asks B.\n    A->>B: ask");
  assert.equal(diagrams[1].key, diagramKey(diagrams[1].source));
});

test("findDiagrams leaves a fence without a title untitled, for the script to fail on", () => {
  assert.equal(findDiagrams("```mermaid\nflowchart LR\n  a --> b\n```\n")[0].title, undefined);
});

test("plan draws only the diagrams with no file yet, and removes the files no fence names", () => {
  const diagrams = [{ key: "a" }, { key: "b" }];
  const { draw, remove } = plan(diagrams, ["a.svg", "old.svg", "stamp"]);
  assert.deepEqual(draw, [{ key: "b" }]);
  assert.deepEqual(remove, ["old.svg"]);
  assert.deepEqual(plan(diagrams, ["a.svg", "b.svg"]), { draw: [], remove: [] });
});
