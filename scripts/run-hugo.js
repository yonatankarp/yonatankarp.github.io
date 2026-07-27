#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const rootDir = path.resolve(__dirname, "..");
const localHugo = path.join(rootDir, ".tools", "hugo", "hugo");
const hugoBinary = fs.existsSync(localHugo) ? localHugo : "hugo";
const args = process.argv.slice(2);

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
