#!/usr/bin/env node

// Draws every Mermaid diagram in content/ to an SVG at build time (#250), so a post ships the finished diagram: nothing
// shifts when it draws, a screen reader gets its title and description rather than the source, and no Mermaid runs in
// the browser. Each fence's source, with its title and description as accTitle and accDescr, is drawn by the mermaid
// package in Playwright's Chromium, in Outfit, and written to assets/diagrams/<sha256 of that source>.svg (gitignored).
// layouts/_default/_markup/render-codeblock-mermaid.html builds the same source, hashes it and inlines the file, and
// fails the build when it is missing, so a diagram edited since this ran is never shipped stale. A file is named by what
// it draws, so one already there is kept and only the missing are drawn (Playwright is needed only then); a file no fence
// names any more is removed. A change to how they are drawn names no new file, so a stamp beside them, of the config,
// Mermaid's version and the fonts, redraws them all when it changes (shortcut: not head.html's unicode-ranges; delete
// assets/diagrams/ after changing those).

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { rootDir, fail, walk, loadPlaywright } = require("./lib");

const outDir = path.join(rootDir, "assets", "diagrams");
const fontsDir = path.join(rootDir, "static", "fonts");

// The skin's colours: custom.css's .px-skin tokens, the page's own palette.
const skin = fs.readFileSync(path.join(rootDir, "assets", "css", "custom.css"), "utf8").match(/^\.px-skin \{([\s\S]*?)^\}/m)?.[1] ?? "";
const token = (name) => skin.match(new RegExp(`--${name}:\\s*(#[0-9a-f]+);`))?.[1] ?? fail(`render-diagrams.js: no --${name} colour in custom.css's .px-skin`);

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
    primaryColor: token("panel-hi"),
    primaryTextColor: token("text"),
    primaryBorderColor: token("ink"),
    secondaryColor: token("panel"),
    tertiaryColor: token("panel"),
    lineColor: token("amber"),
    signalColor: token("amber"),
    textColor: token("text"),
    edgeLabelBackground: token("panel"),
    clusterBkg: "transparent",
    clusterBorder: token("panel-hi"),
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

// What a run does, from the diagrams the fences name and the files in assets/diagrams/: which to draw, which files to remove.
function plan(diagrams, files) {
  const wanted = new Set(diagrams.map(({ key }) => `${key}.svg`));
  return { draw: diagrams.filter(({ key }) => !files.includes(`${key}.svg`)), remove: files.filter((file) => file.endsWith(".svg") && !wanted.has(file)) };
}

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
    const stampFile = path.join(outDir, "stamp");
    const stamp = diagramKey(JSON.stringify([config, require("mermaid/package.json").version, ...["outfit-latin.woff2", "outfit-latin-ext.woff2"].map((file) => diagramKey(fs.readFileSync(path.join(fontsDir, file))))]));
    if (fs.existsSync(stampFile) && fs.readFileSync(stampFile, "utf8") !== stamp) fs.rmSync(outDir, { recursive: true, force: true });
    fs.mkdirSync(outDir, { recursive: true });
    const { draw, remove } = plan(diagrams, fs.readdirSync(outDir));
    if (draw.length) await render(draw);
    for (const { key, svg } of draw) fs.writeFileSync(path.join(outDir, `${key}.svg`), svg);
    for (const file of remove) fs.rmSync(path.join(outDir, file));
    fs.writeFileSync(stampFile, stamp);
    console.log(`Mermaid diagrams in ${path.relative(rootDir, outDir)}/: drew ${draw.length}, kept ${diagrams.length - draw.length}, removed ${remove.length}`);
  })().catch((error) => fail(`render-diagrams.js: ${error.message}`));
}

module.exports = { diagramSource, diagramKey, findDiagrams, plan };
