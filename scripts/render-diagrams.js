#!/usr/bin/env node

// Draws every Mermaid diagram in content/ to an SVG at build time (#250), so a post ships the finished diagram: nothing
// shifts when it draws, a screen reader gets its title and description rather than the source, and no Mermaid runs in
// the browser. Each fence's source, with its title and description as accTitle and accDescr, is drawn by the mermaid
// package in Playwright's Chromium, in Outfit, and written to assets/diagrams/<sha256 of that source>.svg (gitignored).
// layouts/_default/_markup/render-codeblock-mermaid.html builds the same source, hashes it and inlines the file, and
// fails the build when it is missing, so a diagram edited since this ran is never shipped stale.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { rootDir, fail, walk, loadPlaywright } = require("./lib");

const outDir = path.join(rootDir, "assets", "diagrams");
const fontsDir = path.join(rootDir, "static", "fonts");

// The look the diagrams were drawn with in the browser, before #250. Natural size: custom.css shrinks the svg to the
// column, and the zoom dialog shows it at this size.
const config = {
  startOnLoad: false,
  flowchart: { useMaxWidth: false },
  sequence: { useMaxWidth: false },
  theme: "base",
  themeVariables: {
    fontFamily: "Outfit, system-ui, sans-serif",
    fontSize: "15px",
    background: "transparent",
    primaryColor: "#2b3344",
    primaryTextColor: "#f2ece0",
    primaryBorderColor: "#0a0b10",
    secondaryColor: "#151923",
    tertiaryColor: "#151923",
    lineColor: "#ffb547",
    signalColor: "#ffb547",
    textColor: "#f2ece0",
    edgeLabelBackground: "#151923",
    clusterBkg: "transparent",
    clusterBorder: "#2b3344",
  },
};

// The source Mermaid draws: the fence's first line, then the title and description, then the rest. The render hook
// builds the same string from .Inner and the fence's attributes, and both name the file by its sha256.
function diagramSource(title, desc, inner) {
  const lines = inner.trim().split("\n");
  return [lines[0], `    accTitle: ${title}`, `    accDescr: ${desc}`, ...lines.slice(1)].join("\n");
}

function diagramKey(source) {
  return crypto.createHash("sha256").update(source).digest("hex");
}

// Every ```mermaid fence in a Markdown file, with its title and description. Fences start at the line's beginning:
// one indented inside a list would reach the hook de-indented, and its hash would not match.
function findDiagrams(markdown) {
  const diagrams = [];
  const fence = /^(`{3,}|~{3,})mermaid\b([^\n]*)\n([\s\S]*?)^\1[ \t]*$/gm;
  for (const [, , attributes, inner] of markdown.matchAll(fence)) {
    const attribute = (name) => attributes.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];
    const source = diagramSource(attribute("title") ?? "", attribute("desc") ?? "", inner);
    diagrams.push({ title: attribute("title"), source, key: diagramKey(source) });
  }
  return diagrams;
}

const fontFace = (file, range) => `@font-face { font-family: 'Outfit'; font-style: normal; font-weight: 400 800; src: url(data:font/woff2;base64,${fs.readFileSync(path.join(fontsDir, file)).toString("base64")}) format('woff2'); unicode-range: ${range}; }`;

async function render(diagrams) {
  const { chromium } = loadPlaywright("Drawing the Mermaid diagrams");
  const browser = await chromium.launch({
    args: ["--font-render-hinting=none"],   // as generate-cv-pdf.js: on Linux, hinting rounds the glyph widths Mermaid measures
    ...(process.env.PLAYWRIGHT_CHANNEL && { channel: process.env.PLAYWRIGHT_CHANNEL }),
  });
  try {
    const page = await browser.newPage();
    // The ranges head.html gives the two files, so a label is measured in the face the page shows it in
    const head = fs.readFileSync(path.join(rootDir, "layouts", "partials", "head.html"), "utf8");
    const range = (file) => head.match(new RegExp(`${file}\\.woff2\\)[^;]*;\\s*unicode-range:\\s*([^;}]+)`))?.[1] ?? fail(`render-diagrams.js: no unicode-range for ${file} in head.html`);
    await page.setContent(`<!doctype html><style>${fontFace("outfit-latin.woff2", range("outfit-latin"))}${fontFace("outfit-latin-ext.woff2", range("outfit-latin-ext"))}body { font-family: Outfit, system-ui, sans-serif; line-height: 1.6; }</style><body></body>`);
    await page.addScriptTag({ path: require.resolve("mermaid/dist/mermaid.min.js") });
    await page.evaluate(() => Promise.all(["400", "500", "600"].map((weight) => document.fonts.load(`${weight} 15px Outfit`))));
    for (const diagram of diagrams) {
      diagram.svg = await page.evaluate(async ({ config, source, key }) => {
        window.mermaid.initialize({ ...config, deterministicIds: true, deterministicIDSeed: key, handDrawnSeed: 1 });
        const { svg } = await window.mermaid.render(`mermaid-${key.slice(0, 8)}`, source);
        return svg;
      }, { config, source: diagram.source, key: diagram.key });
    }
  } finally {
    await browser.close();
  }
}

if (require.main === module) {
  (async () => {
    const diagrams = [];
    for (const file of walk(path.join(rootDir, "content"), ".md").sort()) {
      for (const diagram of findDiagrams(fs.readFileSync(file, "utf8"))) {
        if (!diagram.title) fail(`${path.relative(rootDir, file)}: a Mermaid diagram has no title; see CLAUDE.md`);
        if (!diagrams.some((d) => d.key === diagram.key)) diagrams.push(diagram);
      }
    }
    await render(diagrams);
    fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    for (const { key, svg } of diagrams) fs.writeFileSync(path.join(outDir, `${key}.svg`), svg);
    console.log(`Drew ${diagrams.length} Mermaid diagrams into ${path.relative(rootDir, outDir)}/`);
  })().catch((error) => fail(`render-diagrams.js: ${error.message}`));
}

module.exports = { diagramSource, diagramKey, findDiagrams };
