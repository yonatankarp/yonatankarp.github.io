#!/usr/bin/env node

// Watches the Expires date of static/.well-known/security.txt (RFC 9116), which nothing bumps on its own: a warning on
// the run within 60 days of it, a failure once it has passed. The weekly Pin staleness workflow runs it.

const fs = require("fs");
const path = require("path");
const { rootDir } = require("./lib");

const securityTxt = path.join(rootDir, "static", ".well-known", "security.txt");
const warnDays = 60;
const dayMs = 24 * 60 * 60 * 1000;

// { level: "ok" | "warn" | "fail", message } for the file's text at the moment now.
function expiryStatus(text, now) {
  const line = text.match(/^Expires:[ \t]*(\S+)[ \t]*$/im);
  const expires = line ? new Date(line[1]) : null;

  if (!expires || Number.isNaN(expires.getTime())) {
    return { level: "fail", message: "security.txt has no Expires date this check can read" };
  }

  const day = expires.toISOString().slice(0, 10);
  const daysLeft = Math.ceil((expires - now) / dayMs);

  if (expires <= now) {
    return { level: "fail", message: `security.txt expired on ${day}: move its Expires date on (at most a year ahead)` };
  }
  if (daysLeft <= warnDays) {
    return { level: "warn", message: `security.txt expires ${day} in ${daysLeft} days: move its Expires date on (at most a year ahead)` };
  }

  return { level: "ok", message: `security.txt expires ${day}, in ${daysLeft} days` };
}

if (require.main === module) {
  const { level, message } = expiryStatus(fs.readFileSync(securityTxt, "utf8"), new Date());

  if (level === "ok") {
    console.log(message);
  } else {
    const kind = level === "fail" ? "error" : "warning";
    console.error(process.env.GITHUB_ACTIONS ? `::${kind} title=security.txt::${message}` : `${kind}: ${message}`);
    process.exitCode = level === "fail" ? 1 : 0;
  }
}

module.exports = { expiryStatus };
