#!/usr/bin/env node

// `npm run build:building`'s bundles: a vite build of each scene in web3d/vite.config.mjs's ENTRIES, by its mode (the
// building's is vite's default, production), into assets/building/. The Mermaid diagrams follow in package.json.

const path = require("path");
const { pathToFileURL } = require("url");
const { rootDir, fail } = require("./lib");

(async () => {
  const { build } = await import("vite");
  const configFile = path.join(rootDir, "web3d", "vite.config.mjs");
  const { ENTRIES } = await import(pathToFileURL(configFile).href);
  for (const mode of Object.keys(ENTRIES)) await build({ configFile, mode });
})().catch((error) => fail(`build-building.js: ${error.message}`));
