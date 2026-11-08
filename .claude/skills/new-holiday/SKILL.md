---
name: new-holiday
description: Add a holiday to the site's calendar and, usually, its prop on the city's tower plaza ("add a holiday", "decorate the city for Sukkot", "a new holiday prop", "put up X for Purim", "new seasonal decoration"). Walks web3d/src/calendar.js and its test, props.js's dressing and draw, gen_props.py's paint-key-bake, the ?holiday= pin and the still posters.
---

# A new holiday and its plaza prop

Yonatan's rule: every visitor gets the same holidays, his. No country-specific ones (those were removed in #321), and no
solemn days (Yom Kippur, Yom HaShoah, Yom HaZikaron are left out on purpose). Two cases:
(a) a holiday not in `HOLIDAYS` yet: steps 1-2, then the prop; (b) a prop for one already there (Easter, Purim, Passover,
Independence Day, Lag BaOmer, Shavuot, Rosh Hashanah and Sukkot have none): skip to step 3.

## Preflight (run before editing anything)

Stop and tell Yonatan exactly what is missing, and how to supply it, if any **hard blocker** fails.

Hard blockers (ask him):
- **That it is his holiday and festive**, and its key (lowercase, `-` allowed: `new-year`, `lag-baomer`).
- **Its days**: a Gregorian rule (month and day span) or a Hebrew date (month as Intl names it: `Tishri`, `Kislev`,
  `Adar`/`Adar II`, `Nisan`, `Iyar`, `Sivan`; first day; length), and whether it starts at sunset (`sunset: true`, every Hebrew one).
  Plus two years of known civil dates for the test.
- **The prop** (case b, or a with a prop): what it is, where on the plaza (its foot's middle in city art px, in a gap
  of what is taken: `PLAZAS` (670,208)-(708,220) and (774,215)-(816,232), `DOOR_OPEN` (710,196)-(756,240), the hanukkiah's
  foot (694,233) 30 tall, the tree's (800,236) 34 tall, the lanterns x 762-782 rows 240-243), its height in art px (the hanukkiah is 30, the tree 34, lanterns 6-9), what lights at dusk and night,
  whether it changes with the season, and anything that moves beyond the plaza (like Halloween's ghosts).
- **Picks**: once candidates are painted, the seed he chooses for each (he looks; you don't choose).

Tools, one line each (run from the repo root). "Hard" stops everything; "Later" blocks only that step: do the rest and
tell Yonatan what is left for him.
| Check | Command | Fix | When |
|---|---|---|---|
| Node 22, deps | `node -v; cat .nvmrc; test -d node_modules/vite && echo ok` | `nvm use; npm ci` | Hard |
| uv | `uv --version` | `brew install uv` | Later: step 3 |
| Draw Things | `curl -s -m 3 -o /dev/null -w '%{http_code}\n' http://127.0.0.1:7860/` (`000` = down) | open Draw Things, Settings > API Server, port 7860 | Later: step 3's `paint` |
| Hugo | `.tools/hugo/hugo version` (or `hugo version` when there is no `.tools/hugo/hugo`), then `grep HUGO_VERSION .github/hugo.env` | that release's binary at `.tools/hugo/hugo` | Later: Verify |
| Chromium | `node -e "process.exit(require('fs').existsSync(require('playwright').chromium.executablePath())?0:1)" && echo ok` | `npx playwright install chromium` | Later: Verify (`npm run serve`) |

Committed inputs the bake reads (Later: step 3): `git ls-files --error-unmatch web3d/pixel/paintings/picks/props/hanukkiah.json web3d/pixel/paintings/picks/city-depth.png`
and `git ls-files web3d/pixel/paintings/picks/props/` (every existing pick, or `ready()` skips that set and keeps its
committed art). Draw Things down: do steps 1-2 and the code of 3-6, stop before painting, and tell him the `paint`
commands that are his to run.

## Steps (NAME = the holiday's key, PROP = its sprite names)

1. **`web3d/src/calendar.js` `HOLIDAYS`**: `first(d)` returns the day of it from 0, or -1. Copy the nearest:
   `sukkot: { sunset: true, first: (d) => sinceDay(d, 'hebrew', 'Tishri', 15, 7) },` (Hebrew, from sunset), or
   `halloween: { first: (d) => (d.getMonth() === 9 && d.getDate() >= 24 ? d.getDate() - 24 : -1) },` (Gregorian), or
   `within(d, easter(d.getFullYear()), -7, 1)` (relative to a computed date). `holidaysOn`'s `evening` reads the next
   day only for `sunset` ones; `fromQuery` (`?holiday=NAME:DAY`) takes any key in `HOLIDAYS`, nothing more to wire.
2. **`scripts/test/calendar.test.js`**: a `span(NAME, first, last)` for two years (see the Rosh Hashanah test), and for a
   sunset one an `holidaysOn(eve, true)` check. The Independence Day test fails on purpose if the new one shares an
   April-May day with it.
3. **Art, `web3d/pixel/gen_props.py`, on Halloween's dict-driven pattern**: a dict like `PUMPKINS`
   (`PROP: (art px tall, pose box, how it looks)`), a placement list like `HALLOWEEN` (`(PROP, x, y)`), a prompt template like
   `PUMPKIN_PROMPT` and a branch in `prompt()`, a pose function called from `pose()` (writes `candidates/PROP_pose.png`
   on flat magenta `MAG`), and a bake function like `halloween()` writing `NAME.webp` and `NAME.json` from
   `small()`/`reduce()`, gated in `bake()` by `if ready(DICT): fn(out)`. Add the dict's keys to `paint`'s `name`
   choices in the argparse block at the foot, beside `PUMPKINS`. Copy `halloween()`'s keep-out assert (door crop
   `DOOR_OPEN`, `PLAZAS`, `PLACE`) and add the lanterns' boxes from `HALLOWEEN` to it by hand: that check does not know
   them. Lights the page draws (candles, bulbs, a face) are found or painted dark in the bake and listed in the JSON.
   Commands (Draw Things for `paint`, Yonatan's to run or approve):
   `uv run web3d/pixel/gen_props.py pose`, `uv run web3d/pixel/gen_props.py paint PROP 11 12 13 14`,
   `uv run web3d/pixel/gen_props.py key PROP PROP_SEED.png`, `uv run web3d/pixel/gen_props.py bake`.
   A mistyped or bare command is an argparse error that lists the commands; `bake` writes into `static/building/pixel`
   unless given a folder. `PROPS_PICKS=dir` points the picks at a mock. `picks/props/` is allowlisted in `.gitignore`; a candidate a later step
   edits from (as `tree-plain` edits `tree_11.png`, `INIT`) needs its own `!` line.
4. **`web3d/src/props.js`**: in `dressing()` a flag (`KEY: 'NAME' in holidays`, or a season choice like `tree`); in
   `SHEETS` the sheet and the flags that load it (`NAME: ['KEY']`), and in `props()` its slot in the destructuring, by
   name (`NAME: [N, img]`); then an item `{ y: footRow, draw(ctx, t) { stand(ctx, [x, y], w); ctx.drawImage(sprite(img, S, tint), x0, y0); if (!lit) return; … } }`.
   `t === null` is the still frame (reduced motion, `?fx=off`: `animate`'s `poster`): draw lights steady; something that only
   reads in motion returns early, as the fireworks do. Lights burn only when `lit` (dusk, night).
5. **`scripts/test/props.test.js`**: "No holiday, nothing up" `deepEqual`s every `dressing` key, so it fails until the new
   flag is added; add a test of when it goes up and lights, and NAME to "Missing art leaves the plaza bare".
6. **Only if it moves beyond the plaza**: load and draw it in `web3d/src/city-fx.js` as `spooks` does (`people()` sheets
   from `gen_props.py framed()`), and add its speed to the `fps` max (`city-fx.js:198`).
7. **CI route**: add `"/?time=night&holiday=NAME"` to `scripts/check-csp.js`'s routes (lines 90-91); no route loads
   Halloween's or a new sheet, so a broken one is otherwise unchecked in a browser.
8. **Docs**: CLAUDE.md's "Holidays and props" section (the list, "Every visitor gets the same holidays, his: …", and
   the props: what, where, sizes, files), `web3d/CLAUDE.md`'s "The holidays' props" (the picks, seeds and bake), and the
   comment heads of `calendar.js`, `props.js` and `gen_props.py`.

## What catches mistakes

| Mistake | Caught by |
|---|---|
| Wrong dates, sunset start, overlap with Independence Day | `scripts/test/calendar.test.js` (only the dates you test) |
| New `dressing` key not in tests; a prop's sheet not loaded | `scripts/test/props.test.js` |
| Some of a set's picks missing | `gen_props.py bake` (`ready()` exits naming them) |
| Prop over the door crop, a plaza or the hanukkiah/tree | the keep-out assert, if you copied it |
| Committed `NAME.webp`/`.json` not what the picks bake to | CI "Rebuild the art and compare it" (`gen_props.py bake`) |
| A 404 or page error loading the sheet | CI `check:csp`, only with the step 7 route |
| Overlap with the lanterns or another new prop, a missing sheet (the plaza just goes bare by design), how it looks lit and in a still frame, `.gitignore` lines | **nothing: check by hand** |

## Verify (the full suite runs in CI; the machine is busy)

- `node --test scripts/test/calendar.test.js scripts/test/props.test.js`.
- After the bake, `git status static/building/pixel` shows only `NAME.webp`, `NAME.json` (and any sheet you meant to change).
- With `npm run serve`: `/?holiday=NAME&time=dusk&season=autumn` (lit), `&time=day` (unlit), `&time=night&fx=off` (the
  poster), `&holiday=NAME,hanukkah:3,christmas` (no overlap), and `&season=winter` if it has a season variant.

## Done when

- The calendar and props tests pass, with the new dates and flag covered.
- The picks, their seeds and the baked sheet are committed; CLAUDE.md lists the holiday and its prop.
- Yonatan has seen it on the plaza at dusk, by day and still, and CI (art compare, `check:csp` with the route) is green.
