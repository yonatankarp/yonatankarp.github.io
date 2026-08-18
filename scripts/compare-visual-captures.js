#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

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
    "When same-sized PNG screenshots differ, the report includes pixel-level drift metrics.",
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

function pngColorChannels(colorType) {
  if (colorType === 0) return 1; // grayscale
  if (colorType === 2) return 3; // truecolor
  if (colorType === 4) return 2; // grayscale + alpha
  if (colorType === 6) return 4; // truecolor + alpha
  return null;
}

function parsePng(filePath) {
  const buffer = fs.readFileSync(filePath);

  if (
    buffer.length < 24 ||
    buffer.toString("ascii", 1, 4) !== "PNG"
  ) {
    return null;
  }

  let offset = 8;
  let width = null;
  let height = null;
  let bitDepth = null;
  let colorType = null;
  const idatChunks = [];

  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;

    if (dataEnd + 4 > buffer.length) {
      return null;
    }

    if (type === "IHDR") {
      width = buffer.readUInt32BE(dataStart);
      height = buffer.readUInt32BE(dataStart + 4);
      bitDepth = buffer.readUInt8(dataStart + 8);
      colorType = buffer.readUInt8(dataStart + 9);
    } else if (type === "IDAT") {
      idatChunks.push(buffer.subarray(dataStart, dataEnd));
    } else if (type === "IEND") {
      break;
    }

    offset = dataEnd + 4;
  }

  const channels = pngColorChannels(colorType);

  if (!width || !height || bitDepth !== 8 || !channels || idatChunks.length === 0) {
    return null;
  }

  const inflated = zlib.inflateSync(Buffer.concat(idatChunks));
  const stride = width * channels;
  const expectedLength = height * (stride + 1);

  if (inflated.length < expectedLength) {
    return null;
  }

  const pixels = Buffer.alloc(height * stride);
  let sourceOffset = 0;

  for (let y = 0; y < height; y += 1) {
    const filter = inflated.readUInt8(sourceOffset);
    sourceOffset += 1;
    const rowStart = y * stride;
    const previousRowStart = rowStart - stride;

    for (let x = 0; x < stride; x += 1) {
      const raw = inflated.readUInt8(sourceOffset);
      sourceOffset += 1;

      const left = x >= channels ? pixels[rowStart + x - channels] : 0;
      const up = y > 0 ? pixels[previousRowStart + x] : 0;
      const upLeft = y > 0 && x >= channels ? pixels[previousRowStart + x - channels] : 0;

      let value;
      if (filter === 0) {
        value = raw;
      } else if (filter === 1) {
        value = raw + left;
      } else if (filter === 2) {
        value = raw + up;
      } else if (filter === 3) {
        value = raw + Math.floor((left + up) / 2);
      } else if (filter === 4) {
        value = raw + paethPredictor(left, up, upLeft);
      } else {
        return null;
      }

      pixels[rowStart + x] = value & 0xff;
    }
  }

  return { width, height, channels, pixels };
}

function paethPredictor(left, up, upLeft) {
  const estimate = left + up - upLeft;
  const leftDistance = Math.abs(estimate - left);
  const upDistance = Math.abs(estimate - up);
  const upLeftDistance = Math.abs(estimate - upLeft);

  if (leftDistance <= upDistance && leftDistance <= upLeftDistance) {
    return left;
  }

  if (upDistance <= upLeftDistance) {
    return up;
  }

  return upLeft;
}

function pixelDiff(baselineFile, candidateFile) {
  if (
    !baselineFile.dimensions ||
    !candidateFile.dimensions ||
    baselineFile.dimensions.width !== candidateFile.dimensions.width ||
    baselineFile.dimensions.height !== candidateFile.dimensions.height
  ) {
    return null;
  }

  const baseline = parsePng(baselineFile.filePath);
  const candidate = parsePng(candidateFile.filePath);

  if (
    !baseline ||
    !candidate ||
    baseline.width !== candidate.width ||
    baseline.height !== candidate.height ||
    baseline.channels !== candidate.channels ||
    baseline.pixels.length !== candidate.pixels.length
  ) {
    return null;
  }

  let changedPixels = 0;
  let totalDelta = 0;
  let maxChannelDelta = 0;
  const totalPixels = baseline.width * baseline.height;

  for (let offset = 0; offset < baseline.pixels.length; offset += baseline.channels) {
    let pixelChanged = false;

    for (let channel = 0; channel < baseline.channels; channel += 1) {
      const delta = Math.abs(baseline.pixels[offset + channel] - candidate.pixels[offset + channel]);
      totalDelta += delta;
      maxChannelDelta = Math.max(maxChannelDelta, delta);

      if (delta > 0) {
        pixelChanged = true;
      }
    }

    if (pixelChanged) {
      changedPixels += 1;
    }
  }

  return {
    changedPixels,
    totalPixels,
    changedPercent: totalPixels === 0 ? 0 : (changedPixels / totalPixels) * 100,
    averageChannelDelta: baseline.pixels.length === 0 ? 0 : totalDelta / baseline.pixels.length,
    maxChannelDelta,
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

    changed.push({
      key,
      baselineFile,
      candidateFile,
      sameDimensions,
      pixelDiff: sameDimensions ? pixelDiff(baselineFile, candidateFile) : null,
    });
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
      const drift = item.pixelDiff
        ? `; ${formatPixelDiff(item.pixelDiff)}`
        : "";
      console.log(`- ${item.key}: ${dimensions}${drift}`);
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

function formatPixelDiff(diff) {
  return [
    `${diff.changedPixels}/${diff.totalPixels} px changed`,
    `${diff.changedPercent.toFixed(4)}%`,
    `avg channel delta ${diff.averageChannelDelta.toFixed(4)}`,
    `max channel delta ${diff.maxChannelDelta}`,
  ].join(", ");
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
