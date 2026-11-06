#!/usr/bin/env node

// The hours the art is baked for live in data/phases.json (name, the hour it starts, the colour above the roof, the
// rooms baked for it, how dark a room falls with its lights off), which web3d/src/art.js and the scripts read and
// web3d/pixel/gen_floors.py checks against its PHASES. What cannot read JSON is checked against it here:
// - layouts/partials/time-pick.html picks each phase at its hours, and takes exactly these names from ?time=;
// - web3d/src/pixel.css paints each phase's sky behind the street until the script runs;
// - assets/css/custom.css puts each phase's backdrop behind the other pages;
// - and the art those name is in static/building/pixel/, the homepage's city and the projects' Workshop Row at each hour
//   too (gen_city.py, gen_workshop.py).
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { rootDir, fail } = require("./lib");
const phases = require("../data/phases.json");

const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");
const problems = [];
const names = Object.keys(phases);
const art = (file) => path.join("static", "building", "pixel", file);

// The phase in force at hour h: the latest to start by then, or, before the first start of the day, the last of the day.
const starts = names.map((name) => [phases[name].from, name]).sort((a, b) => a[0] - b[0]);
const atHour = (h) => (starts.filter(([from]) => from <= h).pop() ?? starts[starts.length - 1])[1];

// time-pick.html's script, run with a given hour and query.
const pick = read("layouts/partials/time-pick.html").match(/\{\{ return `([^`]*)` \}\}/)?.[1];
if (!pick) {
  fail("layouts/partials/time-pick.html: no `{{ return `...` }}` script found.");
}
const run = (hour, query) => {
  const documentElement = { dataset: {} };
  vm.runInNewContext(pick, {
    URLSearchParams,
    location: { search: query },
    document: { documentElement },
    Date: class { getHours() { return hour; } },
  });
  return documentElement.dataset.time;
};
for (let h = 0; h < 24; h++) {
  if (run(h, "") !== atHour(h)) problems.push(`time-pick.html picks ${run(h, "")} at ${h}:00, phases.json says ${atHour(h)}`);
}
for (const name of names) {
  if (run(12, `?time=${name}`) !== name) problems.push(`time-pick.html ignores ?time=${name}`);
}
for (const other of ["noon", "Dusk", ""]) {
  if (run(12, `?time=${other}`) !== atHour(12)) problems.push(`time-pick.html takes ?time=${other}`);
}

// pixel.css: the plain rule is dusk's sky, and each other phase has its own rule.
const pixelCss = read("web3d/src/pixel.css");
const canvas = new Map([...pixelCss.matchAll(/html\.at-street\.building--guided(?:\[data-time='(\w+)'\])? \.pixel #pixel-canvas \{ background: (#[0-9a-f]{6}); \}/g)]
  .map((match) => [match[1] ?? "dusk", match[2]]));
for (const name of names) {
  if (canvas.get(name) !== phases[name].sky) problems.push(`pixel.css paints ${name}'s street sky ${canvas.get(name) ?? "nowhere"}, phases.json says ${phases[name].sky}`);
}
for (const name of canvas.keys()) {
  if (!names.includes(name)) problems.push(`pixel.css paints a sky for ${name}, which phases.json does not have`);
}

// custom.css: dusk is the plain backdrop, each other phase its own.
const customCss = read("assets/css/custom.css");
const backdrops = new Map([...customCss.matchAll(/(?:html\[data-time="(\w+)"\] )?\.px-skin \{ --scene: url\(\.\.\/building\/pixel\/(backdrop(?:-\w+)?\.webp)\); \}/g)]
  .map((match) => [match[1] ?? "dusk", match[2]]));
for (const name of names) {
  const want = name === "dusk" ? "backdrop.webp" : `backdrop-${name}.webp`;
  if (backdrops.get(name) !== want) problems.push(`custom.css gives ${name} the backdrop ${backdrops.get(name) ?? "none"}, expected ${want}`);
}
for (const name of backdrops.keys()) {
  if (!names.includes(name)) problems.push(`custom.css has a backdrop for ${name}, which phases.json does not have`);
}

// The art: dusk is the plain files; every other phase has its street, its backdrop and its baked rooms.
for (const name of names) {
  const suffix = name === "dusk" ? "" : `-${name}`;
  if (name === "dusk" && phases[name].baked) problems.push("phases.json bakes rooms for dusk, whose art is the plain files");
  const files = [`exterior${suffix}.webp`, `backdrop${suffix}.webp`, ...[...phases[name].baked].map((key) => `floor-${key}${suffix}.webp`)];
  for (const file of files) {
    if (!fs.existsSync(path.join(rootDir, art(file)))) problems.push(`${name} needs ${art(file)} (uv run web3d/pixel/gen_exterior.py build static/building/pixel --time ${name})`);
  }
  for (const scene of ["city", "workshop"]) {
    if (!fs.existsSync(path.join(rootDir, art(`${scene}${suffix}.webp`)))) problems.push(`${name} needs ${art(`${scene}${suffix}.webp`)} (a pick in web3d/pixel/gen_${scene}.py's PICKS, then uv run web3d/pixel/gen_${scene}.py build)`);
  }
}

if (problems.length) {
  fail("The phases disagree with data/phases.json:", problems);
}
console.log(`Phases agree with data/phases.json: ${names.join(", ")}.`);
