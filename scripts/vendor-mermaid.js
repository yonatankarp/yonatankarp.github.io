#!/usr/bin/env node

// Copies Mermaid's ESM build from node_modules into static/vendor/mermaid-<version>/ (gitignored), so the posts with a
// diagram load it from the site instead of a CDN (#182). Only the entry and the chunks it imports are copied, not the
// source maps or the UMD build. assets/js/mermaid-loader.js imports this path, with the version baseof.html reads from
// package.json; scripts/check-generated-html.js fails the build when the installed package is another version.

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const dist = path.join(rootDir, "node_modules", "mermaid", "dist");
const { version } = require(path.join(rootDir, "node_modules", "mermaid", "package.json"));
const vendorDir = path.join(rootDir, "static", "vendor");
const outDir = path.join(vendorDir, `mermaid-${version}`);
const chunks = path.join("chunks", "mermaid.esm.min");

fs.mkdirSync(vendorDir, { recursive: true });
for (const entry of fs.readdirSync(vendorDir)) {
  if (entry.startsWith("mermaid-")) fs.rmSync(path.join(vendorDir, entry), { recursive: true, force: true });
}

fs.mkdirSync(path.join(outDir, chunks), { recursive: true });
const files = ["mermaid.esm.min.mjs", ...fs.readdirSync(path.join(dist, chunks)).filter((f) => f.endsWith(".mjs")).map((f) => path.join(chunks, f))];
for (const file of files) fs.copyFileSync(path.join(dist, file), path.join(outDir, file));

console.log(`Copied Mermaid ${version} (${files.length} files) to ${path.relative(rootDir, outDir)}/`);
