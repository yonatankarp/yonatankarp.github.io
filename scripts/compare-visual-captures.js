#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const options = parseArgs(process.argv.slice(2));

function parseArgs(args) {
  const parsed = { failOnDrift: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];

    if (arg === "--fail-on-drift") {
      parsed.failOnDrift = true;
      continue;
    }

    const [flag, inlineValue] = arg.split("=", 2);

    if (flag === "--baseline" || flag === "--candidate") {
      parsed[flag.slice(2)] = inlineValue || args[index + 1];

      if (!inlineValue) {
        index += 1;
      }
    }
  }

  return parsed;
}

function usage() {
  return [
    "Usage:",
    "  npm run visual:compare -- --baseline <manifest.json> --candidate <manifest.json> [--fail-on-drift]",
    "",
    "Compares visual smoke captures by route + viewport. Drift is reported when paired screenshots differ by hash or dimensions.",
  ].join("\n");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

function requireOption(name) {
  if (!options[name]) {
    fail(`${usage()}\n\nMissing --${name}`);
  }
}

function readJson(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    fail(`Could not read ${filePath}: ${error.message}`);
  }
}

function resolveManifestPath(inputPath) {
  return path.resolve(rootDir, inputPath);
}

function captureDir(manifestPath, manifest) {
  if (manifest.outputDirectory) {
    return path.resolve(rootDir, manifest.outputDirectory);
  }

  return path.dirname(manifestPath);
}

function fileHash(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function pngDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);

  if (
    buffer.length < 24 ||
    buffer.toString("ascii", 1, 4) !== "PNG" ||
    buffer.toString("ascii", 12, 16) !== "IHDR"
  ) {
    return null;
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20),
  };
}

function fileInfo(baseDir, fileName) {
  const filePath = path.resolve(baseDir, fileName);

  if (!fs.existsSync(filePath)) {
    return { fileName, filePath, missing: true };
  }

  const stats = fs.statSync(filePath);

  return {
    fileName,
    filePath,
    bytes: stats.size,
    hash: fileHash(filePath),
    dimensions: pngDimensions(filePath),
  };
}

function fileKey(file) {
  return `${file.route}::${file.viewport}`;
}

function loadCapture(label, inputPath) {
  const manifestPath = resolveManifestPath(inputPath);
  const manifest = readJson(manifestPath);
  const dir = captureDir(manifestPath, manifest);
  const files = new Map();

  if (!Array.isArray(manifest.files)) {
    fail(`${label} manifest has no files array: ${manifestPath}`);
  }

  for (const file of manifest.files) {
    if (!file.route || !file.viewport || !file.file) {
      fail(`${label} manifest contains an incomplete file entry in ${manifestPath}`);
    }

    files.set(fileKey(file), {
      route: file.route,
      viewport: file.viewport,
      ...fileInfo(dir, file.file),
    });
  }

  return {
    label,
    manifestPath,
    manifest,
    dir,
    files,
  };
}

function compareCaptures(baseline, candidate) {
  const baselineKeys = new Set(baseline.files.keys());
  const candidateKeys = new Set(candidate.files.keys());
  const keys = [...new Set([...baselineKeys, ...candidateKeys])].sort();
  const missing = [];
  const changed = [];
  const unchanged = [];

  for (const key of keys) {
    const baselineFile = baseline.files.get(key);
    const candidateFile = candidate.files.get(key);

    if (!baselineFile || !candidateFile || baselineFile.missing || candidateFile.missing) {
      missing.push({ key, baselineFile, candidateFile });
      continue;
    }

    const sameHash = baselineFile.hash === candidateFile.hash;
    const sameDimensions =
      JSON.stringify(baselineFile.dimensions) === JSON.stringify(candidateFile.dimensions);

    if (sameHash && sameDimensions) {
      unchanged.push({ key, baselineFile, candidateFile });
      continue;
    }

    changed.push({ key, baselineFile, candidateFile, sameDimensions });
  }

  return { keys, missing, changed, unchanged };
}

function relativePath(filePath) {
  return path.relative(rootDir, filePath);
}

function printReport(baseline, candidate, comparison) {
  console.log("# Visual Capture Comparison");
  console.log("");
  console.log(`Baseline: ${relativePath(baseline.manifestPath)} (${baseline.manifest.baseUrl || "unknown base"})`);
  console.log(`Candidate: ${relativePath(candidate.manifestPath)} (${candidate.manifest.baseUrl || "unknown base"})`);
  console.log("");
  console.log("## Summary");
  console.log("");
  console.log(`- Compared pairs: ${comparison.keys.length}`);
  console.log(`- Unchanged: ${comparison.unchanged.length}`);
  console.log(`- Changed: ${comparison.changed.length}`);
  console.log(`- Missing or unmatched: ${comparison.missing.length}`);

  if (comparison.changed.length > 0) {
    console.log("");
    console.log("## Changed Pairs");
    console.log("");

    for (const item of comparison.changed) {
      const dimensions = item.sameDimensions
        ? "same dimensions"
        : `${formatDimensions(item.baselineFile.dimensions)} -> ${formatDimensions(item.candidateFile.dimensions)}`;
      console.log(`- ${item.key}: ${dimensions}`);
    }
  }

  if (comparison.missing.length > 0) {
    console.log("");
    console.log("## Missing Or Unmatched");
    console.log("");

    for (const item of comparison.missing) {
      const baselineState = item.baselineFile && !item.baselineFile.missing ? "present" : "missing";
      const candidateState = item.candidateFile && !item.candidateFile.missing ? "present" : "missing";
      console.log(`- ${item.key}: baseline ${baselineState}, candidate ${candidateState}`);
    }
  }
}

function formatDimensions(dimensions) {
  if (!dimensions) {
    return "unknown dimensions";
  }

  return `${dimensions.width}x${dimensions.height}`;
}

function main() {
  requireOption("baseline");
  requireOption("candidate");

  const baseline = loadCapture("baseline", options.baseline);
  const candidate = loadCapture("candidate", options.candidate);
  const comparison = compareCaptures(baseline, candidate);

  printReport(baseline, candidate, comparison);

  if (comparison.missing.length > 0) {
    process.exitCode = 1;
  } else if (options.failOnDrift && comparison.changed.length > 0) {
    process.exitCode = 1;
  }
}

main();
