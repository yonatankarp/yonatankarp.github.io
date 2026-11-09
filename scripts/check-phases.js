#!/usr/bin/env node

// The phases the art is baked for live in data/phases.json (name, the colour above the roof, the rooms baked for it, how
// dark a room falls with its lights off, whether the lamps are lit and whether there are stars), which web3d/src/art.js,
// the scenes and the scripts read and web3d/pixel/gen_floors.py checks against its PHASES. What cannot read JSON is
// checked against it here:
// - every phase says whether its lamps, candles and moths are lit (`lit`, read by props.js, city-fx.js and
//   workshop-fx.js) and whether the stars are out over the roof (`starry`, pixel.js), so a new one cannot skip them;
// - assets/js/time-pick.js, through layouts/partials/time-pick.html, picks each phase from the sun over a day, and
//   takes exactly these names from ?time=, and names the art's files at each (html[data-art]) as they are named here;
// - assets/css/custom.css puts each phase's backdrop (a crop of the city, gen_city.py) behind the other pages, and in
//   winter (html[data-season]) its snowy one;
// - and the art those name is in static/building/pixel/: the tower's baked rooms (gen_floors.py), the homepage's city and
//   the projects' Workshop Row at each hour (gen_city.py, gen_workshop.py), the Library's, the Radio Mast's and the Post
//   Office's rooms and the studio's reels (gen_library.py, gen_rooms.py), each in winter too, and the open doors the
//   city's push-in goes through: the city's tower door (gen_city.py) and the lobby's entrance (gen_floors.py).
const fs = require("fs");
const path = require("path");
const { rootDir, fail, runTimePick } = require("./lib");
const phases = require("../data/phases.json");

const read = (file) => fs.readFileSync(path.join(rootDir, file), "utf8");
const problems = [];
const names = Object.keys(phases);
const art = (file) => path.join("static", "building", "pixel", file);

// The pick over a spring day in Berlin, every ten minutes, gives every phase and nothing else.
const noon = Date.UTC(2026, 2, 20, 11);
const run = (ms, query = "") => runTimePick({ zone: "Europe/Berlin", ms, query }).time;
const day = new Set(Array.from({ length: 144 }, (_, i) => run(Date.UTC(2026, 2, 20) + i * 10 * 60e3)));
if ([...day].sort().join() !== [...names].sort().join()) problems.push(`time-pick.js picks ${[...day].join(", ")} over a day, phases.json has ${names.join(", ")}`);
for (const name of names) {
  if (run(noon, `?time=${name}`) !== name) problems.push(`time-pick.js ignores ?time=${name}`);
}
for (const name of names) {
  for (const flag of ["lit", "starry"]) {
    if (typeof phases[name][flag] !== "boolean") problems.push(`phases.json gives ${name} no "${flag}" (true or false)`);
  }
}
for (const other of ["noon", "Dusk", ""]) {
  if (run(noon, `?time=${other}`) !== run(noon)) problems.push(`time-pick.js takes ?time=${other}`);
}

// The season: picked with the phase, and taken from ?season= by these names only. Only winter has art of its own.
const SEASONS = ["spring", "summer", "autumn", "winter"];
const season = (ms, query = "") => runTimePick({ zone: "Europe/Berlin", ms, query }).season;
const year = new Set(Array.from({ length: 12 }, (_, m) => season(Date.UTC(2026, m, 15, 12))));
if ([...year].sort().join() !== [...SEASONS].sort().join()) problems.push(`time-pick.js picks ${[...year].join(", ")} over a year in Berlin, expected ${SEASONS.join(", ")}`);
for (const name of SEASONS) {
  if (season(noon, `?season=${name}`) !== name) problems.push(`time-pick.js ignores ?season=${name}`);
}

// custom.css: dusk is the plain backdrop, each other phase its own, and in winter each phase its snowy one.
const customCss = read("assets/css/custom.css");
const backdrops = new Map([...customCss.matchAll(/(?:html(\[data-season="winter"\])?\[data-time="(\w+)"\] )?\.px-skin \{ --scene: url\(\.\.\/building\/pixel\/(backdrop(?:-\w+)*\.webp)\); \}/g)]
  .map((match) => [`${match[1] ? "winter " : ""}${match[2] ?? "dusk"}`, match[3]]));
const suffixOf = (name, winter) => `${winter ? "-winter" : ""}${name === "dusk" ? "" : `-${name}`}`;
for (const winter of [false, true]) {
  for (const name of names) {
    const art = runTimePick({ zone: "Europe/Berlin", ms: noon, query: `?time=${name}&season=${winter ? "winter" : "spring"}` }).art;
    if (art !== suffixOf(name, winter)) problems.push(`time-pick.js names the art ${art} ${winter ? "in winter " : ""}at ${name}, its files are *${suffixOf(name, winter)}.webp`);
  }
}
for (const winter of [false, true]) {
  for (const name of names) {
    const key = `${winter ? "winter " : ""}${name}`, want = `backdrop${suffixOf(name, winter)}.webp`;
    if (backdrops.get(key) !== want) problems.push(`custom.css gives ${key} the backdrop ${backdrops.get(key) ?? "none"}, expected ${want}`);
  }
}
for (const key of backdrops.keys()) {
  if (!names.includes(key.replace("winter ", ""))) problems.push(`custom.css has a backdrop for ${key}, which phases.json does not have`);
}

// The art: dusk is the plain files; every other phase has its backdrop and its baked rooms; and in winter every phase,
// dusk too, its own backdrop, rooms (phases.json's "winter" "baked"), city, Workshop Row and district rooms.
for (const winter of [false, true]) {
  for (const name of names) {
    const suffix = suffixOf(name, winter), label = `${winter ? "winter at " : ""}${name}`, baked = winter ? phases[name].winter?.baked ?? "" : phases[name].baked;
    if (!winter && name === "dusk" && baked) problems.push("phases.json bakes rooms for dusk, whose art is the plain files");
    if (winter && !phases[name].winter) problems.push(`phases.json gives ${name} no "winter" (its sky and baked rooms)`);
    for (const file of [`backdrop${suffix}.webp`, ...[...baked].map((key) => `floor-${key}${suffix}.webp`)]) {
      const how = file.startsWith("backdrop") ? "gen_city.py build" : "gen_floors.py";
      if (!fs.existsSync(path.join(rootDir, art(file)))) problems.push(`${label} needs ${art(file)} (uv run web3d/pixel/${how} static/building/pixel)`);
    }
    for (const [file, how] of [[`door-open${suffix}.webp`, `the tower's open doors, web3d/pixel/paintings/picks/city-open${suffix}.png, then uv run web3d/pixel/gen_city.py build`],
      [`floor-L-open${suffix}.webp`, `the lobby's open entrance, web3d/pixel/paintings/picks/reception-open${suffix}.png, then uv run web3d/pixel/gen_floors.py`]]) {
      if (!fs.existsSync(path.join(rootDir, art(file)))) problems.push(`${label} needs ${art(file)} (${how})`);
    }
    for (const scene of ["city", "workshop"]) {
      const file = `${scene}${suffix}.webp`;
      if (!fs.existsSync(path.join(rootDir, art(file)))) problems.push(`${label} needs ${art(file)} (a pick in web3d/pixel/gen_${scene}.py's ${winter ? "WINTER_PICKS" : "PICKS"}, then uv run web3d/pixel/gen_${scene}.py build)`);
    }
    // The district rooms: a pick of the room retimed (but at dusk) and of its window's view (but at plain dusk), then the bake.
    for (const [room, how] of [["library", "gen_library.py"], ["radio", "gen_rooms.py"], ["post", "gen_rooms.py"]]) {
      const picks = [...(name === "dusk" ? [] : [`${room}-${name}.png`]), ...(suffix ? [`${room}-view${suffix}.png`] : [])];
      for (const file of [`${room}${suffix}.webp`, ...(room === "radio" ? [`radio-reels${suffix}.webp`] : [])]) {
        if (!fs.existsSync(path.join(rootDir, art(file)))) problems.push(`${label} needs ${art(file)} (web3d/pixel/paintings/picks/${picks.join(" and ")}, painted by uv run web3d/pixel/${how} paint --time ${name}${winter ? " --winter" : ""}, then uv run web3d/pixel/${how} build)`);
      }
    }
  }
}

if (problems.length) {
  fail("The phases disagree with data/phases.json:", problems);
}
console.log(`Phases agree with data/phases.json: ${names.join(", ")}, and in winter.`);
