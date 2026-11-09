---
name: new-hour-phase
description: Add a new time of day the site's art shows (a phase beside dawn, day, dusk and night, e.g. "add a twilight phase", "a new hour phase", "paint the city at sunrise", "new time of day"), or give a second season art of its own like winter's ("autumn art", "a new season's paintings"). Walks data/phases.json, the time pick, the backdrops, every painting at that hour (the district rooms too) (plain and winter) and the dark-hours rules nothing checks.
---

# A new hour phase

## Preflight (run before editing anything)

Stop and tell Yonatan exactly what is missing, and how to supply it, if any **hard blocker** fails.

Hard blockers (ask for them; nothing can be edited without them):
- **The name**: lowercase letters only (`[a-z]+`). A digit escapes `head.html`'s backdrop cache-bust (`backdrop[-a-z]*\.webp`),
  a `-` is not read by `check-phases.js`'s CSS parse (`data-time="(\w+)"`), `_` is the candidates' `NAME_SEED.png`
  separator, and `check-phases.js` requires `?time=noon` to be ignored, so not `noon`.
- **Its band of the sun**: where it sits in `sunPhase` (`assets/js/time-pick.js`: day > +6°, night <= -8°, dawn/dusk
  between, split by noon). It must come up in Berlin on 20 March 2026 at 10-minute steps (`check-phases.js`), or the check fails.
- **The light, in words**, for each prompt dict below (the city's, the Row's, the roof's, the street through the lobby door),
  and whether it counts as **dark**: are the lamps `lit` and the roof `starry` (step 4), and for each rule in step 7.
- **Colours for `data/phases.json`**: `sky` and `winter.sky` (hex; any hex passes `sky()`, as `sky_band` paints it as row 0)
  and `dark` (three factors, like `[0.42, 0.42, 0.52]`). Or say they will be read off the roof painting once it is picked.

Tools, one line each (run from the repo root). "Hard" stops everything; "Later" blocks only that step: do the rest and
tell Yonatan what is left for him.
| Check | Command | Fix | When |
|---|---|---|---|
| Node 22, deps | `node -v; cat .nvmrc; test -d node_modules/vite && echo ok` | `nvm use; npm ci` | Hard |
| uv | `uv --version` | `brew install uv` | Later: steps 3, 6 |
| Draw Things | `curl -s -m 3 -o /dev/null -w '%{http_code}\n' http://127.0.0.1:7860/` (`000` = down) | open Draw Things, Settings > API Server, port 7860 | Later: step 3 |
| Hugo | `.tools/hugo/hugo version` (or `hugo version` when there is no `.tools/hugo/hugo`), then `grep HUGO_VERSION .github/hugo.env` | that release's binary at `.tools/hugo/hugo` | Later: Verify |
| Chromium | `node -e "process.exit(require('fs').existsSync(require('playwright').chromium.executablePath())?0:1)" && echo ok` | `npx playwright install chromium` | Later: Verify (`npm run serve`) |

Committed inputs the paint steps edit from (Later: step 3; missing means the branch is not cut from origin/main):
`git ls-files --error-unmatch web3d/pixel/paintings/picks/{city,workshop,workshop-depth,lobby-px,reception-open,reception-door-winter}.png web3d/pixel/paintings/candidates/{roof_1100,reception_1117}.png`

Draw Things down, or no picks chosen yet: do the code steps (1, 2, 5), stop before step 3, and tell Yonatan which
`uv run` commands are his to run and which candidates he must pick. Nothing builds green until every painting is in:
`gen_city.py` and `gen_workshop.py build` exit unless `PICKS`, `WINTER_PICKS` and `phases.json` agree, and
`gen_floors.py` asserts `phases.json`'s `baked` against the picks on every run. Work on one branch; check at the end.

## Steps (PHASE = the new name)

1. **Prompt keys first** (each `--time` choice comes from these, and a missed one is a `KeyError` mid-paint):
   - `web3d/pixel/gen_city.py`: `PICKS`, `WINTER_PICKS` (seed 700, e.g. `"night": 700`), `HOURS[PHASE]`, `LIGHT[PHASE]`
     (`WINTER` is built from `LIGHT`; only `night` has its own winter prompt).
   - `web3d/pixel/gen_workshop.py`: `PICKS` (1000), `WINTER_PICKS` (700), `HOURS[PHASE]` (`LIGHT` derives); `WINTER`
     uses its `"day"` template for every hour but night.
   - `web3d/pixel/paint_rooms.py`: `HOURS[PHASE]` (the roof), `DOOR_LIGHT[PHASE]` (the street through the lobby door);
     fix the docstring's `--time dawn|day|night`.
   - `web3d/pixel/gen_rooms.py`: `LIGHT[PHASE]` (the rooms' window views) and `ROOM_LIGHT[PHASE]` (the room retimed,
     whose light only is kept); `gen_library.py` shares them. `BEAMS` if the Post Office's dusk shafts must go at PHASE.
   - `web3d/pixel/patch_picks.py`: `ROW_LIGHT[PHASE]`, and PHASE in the van patch's literal hour tuple in `PATCH`.
     `gen_workshop.py`'s `PATCHES` lists a van per phase in `phases.json` by itself, so the bake fails until that van
     patch is painted (step 3).
2. **The pick** `assets/js/time-pick.js`: the name in the `?time=` regex and its band in `sunPhase`; update
   `layouts/partials/time-pick.html`'s and `layouts/index.html`'s comments. Re-derive `scripts/test/time-pick.test.js`'s
   instants (its fixed times fail on purpose when a band moves).
3. **Paint (Draw Things, Yonatan's machine; his to run or approve)**, copying each chosen candidate as named:
   - City: `uv run web3d/pixel/gen_city.py paint --time PHASE --count 3` -> `candidates/city-PHASE_SEED.png` to
     `picks/city-PHASE.png`; winter `gen_city.py paint --winter --time PHASE` -> `picks/city-winter-PHASE.png`; note seeds.
   - City's open door: Yonatan supplies the whole painting at PHASE with the doors open (no script paints it); then
     `gen_city.py door --open PAINTING --time PHASE`; winter `gen_city.py door --winter --time PHASE --count 3`, then
     `door --winter --time PHASE --pick SEED`.
   - Row: `uv run web3d/pixel/gen_workshop.py paint --time PHASE --count 3` -> `picks/workshop-PHASE.png`; winter
     `paint --winter --time PHASE --start 700 --count 1` -> `picks/workshop-winter-PHASE.png`; then the van mend:
     `uv run web3d/pixel/patch_picks.py paint workshop-winter-PHASE-van`, `... pick workshop-winter-PHASE-van`.
   - Roof: `uv run web3d/pixel/paint_rooms.py retime --src roof_1100.png --time PHASE`; winter
     `paint_rooms.py winter --src roof_1100-PHASE_SEED.png --start 700`. `!` lines for those candidates in `.gitignore`
     (allowlisted by name; nothing checks).
   - Lobby view, a crop round its door: `paint_rooms.py door --time PHASE`, then `door --time PHASE --pick SEED`
     (`picks/reception-door-PHASE.png`); winter, once the winter dusk is installed, `door --winter --time PHASE` and
     `--pick SEED` (`picks/reception-door-winter-PHASE.png`). Those picks are allowlisted by a glob.
   - Add each to `install_picks.py` `PICKS` (`"roof-PHASE"`, `"reception-PHASE": "reception-door-PHASE.png"`,
     `"roof-winter-PHASE"`, `"reception-winter-PHASE": "reception-door-winter-PHASE.png"`), then
     `uv run web3d/pixel/install_picks.py roof-PHASE reception-PHASE roof-winter-PHASE reception-winter-PHASE`.
   - The Library, the Radio Mast and the Post Office: `uv run web3d/pixel/gen_rooms.py paint --time PHASE --count 3`
     and `uv run web3d/pixel/gen_library.py paint --time PHASE --count 3` (each the window's view and the room retimed)
     -> `picks/ROOM-view-PHASE.png` and `picks/ROOM-PHASE.png`; winter `paint --winter --time PHASE` (the winter dusk
     view retimed) -> `picks/ROOM-view-winter-PHASE.png`. Seeds in `VIEW_PICKS` and `ROOM_PICKS`; picks allowlisted by glob.
   - Lobby's open entrance, on that hour's installed lobby: `paint_rooms.py entrance --time PHASE --count 3` (default
     `--start 1000`), then `entrance --time PHASE --pick SEED`; winter the same with `--winter`. Writes
     `picks/reception-open[-winter]-PHASE.png`.
4. **`data/phases.json`**: `"PHASE": { "sky": "#…", "baked": "LR", "dark": [r, g, b], "lit": true|false, "starry": true|false, "winter": { "sky": "#…", "baked": "LR" } }`.
   `lit` lights the lamps, candles, headlights and moths (props.js, city-fx.js, workshop-fx.js); `starry` puts the
   stars over the roof (pixel.js). `check:phases` fails a phase without either.
5. **`assets/css/custom.css`** (by line 660): `html[data-time="PHASE"] .px-skin { --scene: url(../building/pixel/backdrop-PHASE.webp); }`
   and `html[data-season="winter"][data-time="PHASE"] .px-skin { --scene: url(../building/pixel/backdrop-winter-PHASE.webp); }`,
   exactly that shape (check-phases parses it with a strict regex).
6. **Bake**: `npm run art` rebuilds it all into `static/building/pixel/`; or only
   `uv run web3d/pixel/gen_floors.py`, `uv run web3d/pixel/gen_city.py build` and
   `uv run web3d/pixel/gen_workshop.py build`, `gen_library.py build` and `gen_rooms.py build`, each writing there by default. New files: `city[-winter]-PHASE.webp`, `backdrop…`, `door-open…`,
   `workshop…`, `floor-{L,R}[-winter]-PHASE.webp`, `floor-L-open…`, `{library,radio,post}[-winter]-PHASE.webp`,
   `radio-reels[-winter]-PHASE.webp`, and `floors.json`/fx JSON may change.
7. **Dark-hours rules** that still name an hour (decide each with Yonatan): `web3d/src/props.js` `TINT` (`:10`);
   `city-fx.js:29` (`night`: darker walkers, windows going dark, and `city-windows.json`, fetched only then);
   `workshop-fx.js:13,19,67` (`night`: 4 dimmed walkers, the moths, the snow); Python: `gen_floors.py` `roof()` (crane light
   `!= "day"`, twinkle `== "night"`), `sky_band`'s stars (`hour(variant) == "night"`), `gen_workshop.py` `bake` (kerb
   lamp relit but by day), `install_picks.py` `TOUCHUPS["roof-winter-night"]` and `night_view` (the door's night),
   `paint_rooms.py` `entrance_pick` (the night's open doorway relit to the shut view); the rooms: `gen_rooms.hour()`'s
   `night_view`, `rooms-fx.js` (no dust at night), `library-fx.js` (`CLOUDS[PHASE]`, no dust and dimmed readers at night).
8. **Docs**: CLAUDE.md's `/?time=dawn|day|dusk|night` and the phases in its "Time of day and season" section.

Automatic, no edit: `check-csp.js` routes `/?time=PHASE`, `capture-screenshots.js`'s `home-PHASE` (roof), the art
version (`layouts/partials/art-version.html`, a hash of every file), and the file suffix, `html[data-art]`, which
`time-pick.js` builds and `art.js` (`strip()`), `city.js` and the pre-paints (`assets/js/home-*.js`, `art-pick.js`) read.

## What catches mistakes

| Mistake | Caught by |
|---|---|
| Regex, band, CSS rule or any art file missing | `npm run check:phases` (names the file and command) |
| `baked` disagrees with the `-px.png` picks; `sky` vs roof strip | `gen_floors.py` (`phases()`, `sky()`), every run |
| `PICKS`/`WINTER_PICKS` != phases.json, a pick or open crop missing | `gen_city.py build`, `gen_workshop.py build` (exit) |
| A district room's pick or bake missing at PHASE | `npm run check:phases`; `gen_rooms.py`/`gen_library.py build` (missing file) |
| No `TINT` for PHASE | `npm test` (`props.test.js`) |
| Committed art not rebuilt from the picks | CI "Rebuild the art and compare it" |
| A 404 on `/?time=PHASE` | CI `check:csp` |
| A phase without `lit` or `starry` | `npm run check:phases` |
| A `-px.png` not reinstalled after a `PICKS` change | CI's art rebuild (it reruns `install_picks.py`) |
| `dark`, the dark-hours rules (step 7), `.gitignore` lines, prompt wording | **nothing: check by hand** |

## Verify (the full suite runs in CI; the machine is busy)

- `npm run check:phases`; `node --test scripts/test/time-pick.test.js scripts/test/props.test.js`; `uv run web3d/pixel/gen_floors.py --data`.
- `git status static/building/pixel` lists every new file above; `git diff --stat` shows no other art changed.
- With `npm run serve`, look at `/?time=PHASE&season=autumn&holiday=none` (city), `#floor-R`, `#floor-L` and the push-in
  through the tower door, `/projects/?time=PHASE`, `/blog/`, `/podcast/` and `/contact/?time=PHASE` (the rooms),
  `/cv/?time=PHASE` (backdrop), each with `&season=winter` too.

## A second season with art (beside winter)

Not done before. The file suffix is one, `html[data-art]`, built in `assets/js/time-pick.js:14`, so a season with art
starts there; `winter` is still named in `web3d/src/art.js:27` (`SEASON`), `city-fx.js:16-17`, `workshop-fx.js:20`,
`custom.css:663-666`, `scripts/check-phases.js` (`suffixOf`, `[false, true]` loops), `phases.json`'s `winter` key,
`name()` in `art_common.py` (the city's) and `gen_workshop.py`, `winter()` in `gen_floors.py`, `install_picks.py`
`SNOWED`/`DRY`/`-winter`, `paint_rooms.py winter` and `door --winter`.
Plan it with Yonatan as its own change; every phase then needs that season's paintings as in step 3.

## Done when

- `check:phases`, the two tests and `gen_floors.py --data` pass; every new picture is committed, with its pick and seed.
- Yonatan has seen the city, roof, lobby, Row, the three district rooms and a backdrop at PHASE, plain and winter, and settled step 7.
- CI's art compare and `check:csp` are green.
