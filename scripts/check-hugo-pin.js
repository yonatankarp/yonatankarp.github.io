#!/usr/bin/env node

// Reports when the pinned Hugo version has fallen behind its newest release, and
// fails when the pinned HUGO_SHA256 is not the published checksum of that release's
// .deb or differs between the workflows.
//
// WHAT THIS IS FOR. Every other build input here is watched by something:
// Dependabot covers npm and the action refs in .github/workflows. Hugo is not a
// dependency of anything -- it is a version string the workflows interpolate
// into a release URL -- so nothing tells anybody when it has aged.
// The site's whole output comes out of that one binary.
//
// WHAT IT DOES NOT DUPLICATE. The pin is read out of the workflows that actually
// build the site, never out of a copy kept here. A copy would be a third pin,
// and the day somebody bumps the workflows without bumping it is the day this
// starts comparing a version nothing builds with.
//
// It never changes anything. It reads, and it prints what it found.

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const workflowDir = path.join(rootDir, ".github", "workflows");
const releaseApi = "https://api.github.com/repos/gohugoio/hugo/releases/latest";
const releasesPage = "https://github.com/gohugoio/hugo/releases";
const pinPattern = /^[ \t]*HUGO_VERSION:[ \t]*["']?(\d+\.\d+\.\d+)["']?[ \t]*$/gm;
const shaPattern = /^[ \t]*HUGO_SHA256:[ \t]*["']?([0-9a-f]{64})["']?[ \t]*$/m;
// The file the workflows' Install Hugo CLI step downloads and checks.
const debName = (version) => `hugo_extended_${version}_linux-amd64.deb`;

function collectPins() {
  const pins = [];

  for (const entry of fs.readdirSync(workflowDir, { withFileTypes: true })) {
    if (!entry.isFile() || !/\.ya?ml$/.test(entry.name)) {
      continue;
    }

    const file = path.join(workflowDir, entry.name);
    const content = fs.readFileSync(file, "utf8");

    const sha = content.match(shaPattern);

    for (const match of content.matchAll(pinPattern)) {
      pins.push({ file: path.relative(rootDir, file), version: match[1], sha256: sha ? sha[1] : null });
    }
  }

  return pins.sort((left, right) => left.file.localeCompare(right.file));
}

function versionOrder(version) {
  return version.split(".").map(Number);
}

function isBehind(pinned, latest) {
  const left = versionOrder(pinned);
  const right = versionOrder(latest);

  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const mine = left[index] || 0;
    const theirs = right[index] || 0;

    if (mine !== theirs) {
      return mine < theirs;
    }
  }

  return false;
}

function githubHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "check-hugo-pin",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

async function latestRelease() {
  const response = await fetch(releaseApi, { headers: githubHeaders() });

  if (!response.ok) {
    throw new Error(`GitHub answered ${response.status} ${response.statusText}`);
  }

  const tag = String((await response.json()).tag_name || "");
  const match = tag.match(/^v?(\d+\.\d+\.\d+)$/);

  if (!match) {
    throw new Error(`unexpected Hugo release tag ${tag || "(missing)"}`);
  }

  return match[1];
}

async function publishedSha(version) {
  const url = `${releasesPage}/download/v${version}/hugo_${version}_checksums.txt`;
  const response = await fetch(url, { headers: { "User-Agent": "check-hugo-pin" } });

  if (!response.ok) {
    throw new Error(`${url} answered ${response.status} ${response.statusText}`);
  }

  const line = (await response.text()).split("\n").find((entry) => entry.trim().endsWith(`  ${debName(version)}`));

  if (!line) {
    throw new Error(`hugo_${version}_checksums.txt has no line for ${debName(version)}`);
  }

  return line.trim().split(/\s+/)[0];
}

// Every way the HUGO_SHA256 pins are wrong, as one line each; empty when they are right.
function checksumProblems(pins, published) {
  const problems = [];
  const shas = new Set(pins.map((pin) => pin.sha256));

  if (shas.size > 1) {
    problems.push("the workflows pin different HUGO_SHA256 values");
  }

  for (const pin of pins) {
    if (!pin.sha256) {
      problems.push(`\`${pin.file}\` has no HUGO_SHA256 next to its HUGO_VERSION`);
    } else if (pin.sha256 !== published[pin.version]) {
      problems.push(
        `\`${pin.file}\` pins HUGO_SHA256 \`${pin.sha256}\`; ${debName(pin.version)} is published as \`${published[pin.version]}\``,
      );
    }
  }

  return problems;
}

function renderIssue(pins, pinned, latest, disagree, problems) {
  const files = pins.map((pin) => `\`${pin.file}\``).join(", ");
  const title = problems.length
    ? "Hugo checksum pin is wrong"
    : disagree
      ? "Hugo pin disagrees between workflows"
      : `Hugo pin ${pinned} is behind ${latest}`;
  const lines = [];

  if (problems.length) {
    lines.push(
      "The Hugo install step checks the downloaded .deb against HUGO_SHA256, and that pin is wrong,",
      "so the build fails before Hugo runs:",
      "",
      ...problems.map((problem) => `- ${problem}`),
      "",
    );
  }

  if (disagree) {
    lines.push(
      "The Hugo version is pinned in more than one workflow and the pins no longer agree,",
      "so CI and the deploy can build the site with different Hugo versions:",
      "",
      ...pins.map((pin) => `- \`${pin.file}\` pins \`${pin.version}\``),
      "",
    );
  }

  if (isBehind(pinned, latest)) {
    lines.push(
      disagree
        ? `The oldest of them, \`${pinned}\`, is behind the newest release \`${latest}\`.`
        : `${files} pin Hugo \`${pinned}\`; the newest release is \`${latest}\`.`,
      "",
    );
  }

  lines.push(
    "Nothing else watches this: Dependabot sees npm and the action refs, not the",
    "version string the Hugo install step drops into a release URL.",
    "",
    "Bumping it means editing HUGO_VERSION and HUGO_SHA256 (the .deb's line in the",
    "release's checksums file) in every workflow above and letting `Validate Hugo build`",
    "decide -- a Hugo minor can move template behaviour, so this waits for a human",
    "rather than merging itself.",
    "",
    `Release notes: ${releasesPage}`,
    "",
    "<!-- opened and updated by .github/workflows/pin-staleness.yml -->",
  );

  return { title, body: lines.join("\n") };
}

function writeGithubOutput(entries) {
  const file = process.env.GITHUB_OUTPUT;

  if (!file) {
    throw new Error("--github-output needs GITHUB_OUTPUT set; run this without the flag locally");
  }

  const delimiter = `EOF_${crypto.randomBytes(8).toString("hex")}`;
  let payload = "";

  for (const [key, value] of Object.entries(entries)) {
    payload += value.includes("\n")
      ? `${key}<<${delimiter}\n${value}\n${delimiter}\n`
      : `${key}=${value}\n`;
  }

  fs.appendFileSync(file, payload);
}

async function main() {
  const wantsOutput = process.argv.includes("--github-output");
  const pins = collectPins();

  // Not a staleness finding but a broken check: the pin was renamed or moved and
  // this is now watching nothing. Loud on purpose -- silence here would look
  // exactly like a pin that is up to date.
  if (pins.length === 0) {
    console.error(
      "No HUGO_VERSION pin found in .github/workflows. The pin moved; " +
        "point scripts/check-hugo-pin.js at wherever it lives now.",
    );
    return 1;
  }

  const versions = new Set(pins.map((pin) => pin.version));
  const disagree = versions.size > 1;
  let latest;
  const published = {};

  try {
    latest = await latestRelease();

    for (const version of versions) {
      published[version] = await publishedSha(version);
    }
  } catch (error) {
    // A rate limit or an outage is not "your pin is stale". Reporting one as the
    // other is how an alert stops being worth reading, and GitHub's uptime does
    // not get to decide whether this run worked, so this is a quiet zero.
    console.error(`Could not reach the Hugo release or its checksums (${error.message}); unverified this run.`);

    if (wantsOutput) {
      writeGithubOutput({ status: "unknown" });
    }

    return 0;
  }

  const pinned = [...versions].sort((left, right) => (isBehind(left, right) ? -1 : 1))[0];
  const behind = isBehind(pinned, latest);
  const problems = checksumProblems(pins, published);

  for (const pin of pins) {
    console.log(`${pin.file} pins Hugo ${pin.version}, sha256 ${pin.sha256 || "(none)"}`);
  }
  console.log(`newest Hugo release: ${latest}`);

  for (const problem of problems) {
    console.error(`checksum pin is wrong: ${problem.replace(/`/g, "")}`);
  }

  if (disagree) {
    console.log(`workflow pins disagree: ${[...versions].join(", ")}`);
  }
  if (behind) {
    console.log(`the pin is behind by at least one release (${pinned} -> ${latest})`);
  }
  if (!disagree && !behind && !problems.length) {
    console.log("the pin is current");

    if (wantsOutput) {
      writeGithubOutput({ status: "current" });
    }

    return 0;
  }

  if (wantsOutput) {
    const { title, body } = renderIssue(pins, pinned, latest, disagree, problems);
    writeGithubOutput({ status: "stale", title, body });
  }

  // Staleness is a report; a wrong checksum is a build that cannot install Hugo.
  return problems.length ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(error.stack || String(error));
    process.exit(1);
  },
);
