#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const localHugo = path.join(rootDir, ".tools", "hugo", "hugo");
const hugoBinary = fs.existsSync(localHugo) ? localHugo : "hugo";
const args = process.argv.slice(2);

// A local build with another Hugo than CI's can render differently, so say so; it is not worth failing over.
function warnOnVersionMismatch() {
  const pin = fs.readFileSync(path.join(rootDir, ".github", "hugo.env"), "utf8").match(/^HUGO_VERSION=(\S+)/m);
  const local = spawnSync(hugoBinary, ["version"], { encoding: "utf8" });
  const version = (local.stdout || "").match(/v(\d+\.\d+\.\d+)/);

  if (pin && version && version[1] !== pin[1]) {
    console.warn(`warning: ${hugoBinary} is Hugo ${version[1]}, but .github/hugo.env pins ${pin[1]}; CI builds with ${pin[1]}.`);
  }
}

warnOnVersionMismatch();

const result = spawnSync(hugoBinary, args, {
  cwd: rootDir,
  stdio: "inherit",
  env: process.env,
});

if (result.error) {
  console.error(`Failed to run Hugo binary '${hugoBinary}': ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
