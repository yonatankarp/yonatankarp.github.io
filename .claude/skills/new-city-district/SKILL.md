---
name: new-city-district
description: Add a sixth district to the homepage's pixel city, with its own building on the map, its label and chip, its push-in, and a page of its own (usually a painted room like the Radio Mast). Use when Yonatan says "new district", "add a building to the city", "a sixth district", "new room page in the city", or "put X in the city".
---

# A sixth district in the city

This is the biggest change on the site: about 20 edits in about 17 files, plus repainting the city (audit #341). Agree
the scope first, and build nothing before Yonatan has tried a local clickable mock and approved it.

## Preflight: check everything before you edit

Stop before the first edit if any **hard** item is missing. Tell Yonatan what is missing and how to provide it. If only
a **later** item is missing, do the steps that don't need it and list what is left for him.

**Decisions from Yonatan** (all hard, before the mock):
- **What it is for:** the topic, its page's URL (`/<slug>/`) and its key (`<key>`, one lowercase word, used in
  `data-pick`, `#<key>` and `district-<key>`).
- **The building on the map:** what it looks like, and where it stands. The free ground is outside `LOTS` in
  `gen_city.py`: inside the ring road, clear of the tower's plaza (x ~1550..1970), the bay (left) and the farmland
  (right).
- **How the art gets the building**, which decides most of the cost:
  - **(a) Paint it into the existing picks.** This keeps every coordinate, but it must be done in all 8 city pictures:
    dusk, dawn, day and night, each also in winter. No such path exists for the city yet. `patch_picks.py` and
    `paint_rooms.patched` mend the rooms, but `gen_city.py`'s `bake()` applies no `PATCHES`. Building that path is part
    of the job.
  - **(b) Repaint the city from a new `blockout()`.** Seed 700 is the only one that kept the layout. A repaint moves
    things, so every hand-placed list must be measured again:
    - in `gen_city.py`: `WALKS`, `PLAZAS`, `LANES` (`MAIN`, `RING`, …), `LIGHTS`, `POSTS`, `TREES`, `BAY_SEED`,
      `CRANE`, `DOOR`, `DOOR_OPEN`, `DOORWAY`, `DOORS`, `BACKDROP` and `PAINTED`;
    - the holidays' props: `PLACE`, `PUMPKINS` and `HALLOWEEN` in `gen_props.py`;
    - the tower's door edit and its open crops, and `city-depth.png`.
- **The page:**
  - Usually a **room** like the Radio Mast: one dusk painting across its head (`room-hero.html`) and a panel under it.
    It reuses the `rooms` bundle.
  - Or a **scene of its own**, like the Library or Workshop Row. That needs its own Vite bundle and more checks.
- **The words:** the district's `name`, `title` (`%d` if Hugo counts something), `text` and `go`; the page's copy and
  labels; the alt texts; the `description`.
- Don't propose a reverse arrival: leaving for home keeps the wipe (he closed PR 203).

**Tools:**

| Check | Command | Blocks |
|---|---|---|
| uv on PATH | `uv --version` | hard for the art |
| Draw Things listening | `nc -z 127.0.0.1 7860` | every painting step: later (do the code and copy) |
| torch for the depth map | `uv run web3d/pixel/depth_map.py --help` (its header fetches torch, a large download on the first run) | option (b), and any change to the dusk pick |
| The city's picks are committed | `ls -1 web3d/pixel/paintings/picks/city*.png` (17 files: 8 pictures, 8 open-door crops, the depth map) | hard for the art |
| Hugo, at the pinned version | `.tools/hugo/hugo version` (or `hugo version` when there is no `.tools/hugo/hugo`), compared with `grep HUGO_VERSION .github/hugo.env` | the local build and mock: later |
| Node deps, Playwright's Chromium | `test -d node_modules/vite && node -e "process.exit(require('fs').existsSync(require('playwright').chromium.executablePath())?0:1)"` | `build:building` (it draws the diagrams in Chromium) and the screenshots: later |

## Steps

1. **The mock (before anything else).** Build a local clickable page in the scratchpad, served with `preview_start`. On a
   copy of `static/building/pixel/city.webp`, show the new label at its spot, and add a chip to a copy of the panel.
   Clicking the label zooms there; a second click goes to a sketch of the page.
   Screenshot and critique it yourself before showing him; iterate until he approves the spot, the label and the page.
2. **The copy.**
   - Add `{key, name, title, text, go}` to `city.districts` in `data/home/en.yaml`. List order is the chips' order.
   - Update `city.alt`, which names the five buildings.
   - The page's labels under a new key in `data/rooms.yaml`, the painting's alt in `data/art.yaml`, the page in
     `data/llms.yaml` `pages`, and a `CONTENT.md` row per piece of text. No English in templates.
3. **`layouts/index.html`.**
   - Add `"<key>" ("<slug>/" | relURL)` to `$go` (until #338 moves URLs into the YAML).
   - If the title has `%d`, add the count to `$counts`. If its text comes from elsewhere, add it to `$texts`.
   - Copy any special case modelled on `{{ if eq .key "post" }}` with care.
   - The label, chip, panel, `<noscript>` column and pre-paint all loop over the districts.
4. **The city art** (option (a) or (b); every painting step is Draw Things, Yonatan's).
   - **`gen_city.py`:**
     - `SPOTS["<key>"]` and `LOTS["<key>"]`, used by `blockout()`.
     - The landmark drawn in `blockout()`.
     - `anchors()`: add its unpack (a fixed 5-tuple, until #339) and its `tops` entry (where the label's foot sits).
     - `PAINTED["<key>"]`, if the painting moved its top.
     - `ZOOM["<key>"] = [x%, y%, zoom]`.
     - `DOORS` only if the push-in should land on a door in the next view. Then `next.<key>` in `city.js` must return a
       width `w`, as `tower()` and `workshop()` do.
   - **(b), at the dusk pick:**
     - `uv run web3d/pixel/gen_city.py paint --count 2 --start 700`.
     - The tower's door: `door --count N`, then `door --pick SEED`.
     - The other hours: `paint --time dawn|day|night`.
     - Winter: `paint --winter --time dusk|dawn|day|night`.
     - The open doors: `door --open <painting> --time PHASE`, then `door --winter --time PHASE` and `--pick SEED`.
     - Copy each pick to `paintings/picks/city[-winter][-PHASE].png`, and note its seed in `PICKS` or `WINTER_PICKS`.
     - Then rerun `uv run web3d/pixel/depth_map.py city`, and commit `picks/city-depth.png`.
   - **Bake:** `uv run web3d/pixel/gen_city.py build`. It writes `city*.webp`, `backdrop*.webp`, `door-open*.webp`,
     `city.json`, `city[-winter]-fx.json`, `city[-winter]-windows.json` and `city-depth.png`, all into
     `static/building/pixel/`. Commit them all; never hand-edit `city.json`.
   - If the walkers' or cars' paths now cross the building, fix `WALKS` and `LANES`, and check the props' feet in
     `gen_props.py` (`uv run web3d/pixel/gen_props.py bake static/building/pixel`).
5. **The push-in (`web3d/src/city.js`).**
   - `through()` calls `next[key](r)` with no fallback, so a key without an entry throws on the go link. For a room
     page, add `next.<key> = next.radio;` beside `next.post`.
   - Other heads need their own middle, mirrored from their CSS, as `library` mirrors `custom.css`'s `.library-hero`.
     Leave a back-pointer comment in `custom.css` (until #337 adds a check).
6. **The page.**
   - Create `content/<slug>.md` like `content/podcast.md`: `title`, `layout: "<layout>"`, `description`, and a
     hand-set `lastmod`.
   - Create `layouts/_default/<layout>.html` from `radio.html`:
     - wrap it in `<div class="room">`, which hides the backdrop (`custom.css:193`);
     - add `partial "room-hero.html" (dict "room" "<key>" "open" 0.4 "label" … "alt" …)`;
     - add a `.room-sheet` with `<a class="room-back" href="{{ "" | relURL }}#<key>">`, which reopens the city zoomed
       on the district.
   - Add the page's styles to `assets/css/custom.css`, beside `.radio-*`.
7. **The room's art.**
   - In `web3d/pixel/gen_rooms.py`, add `PROMPTS["<key>"]` (`STYLE` + the room), `FX["<key>"]` (its animation's points
     in art px; `build()` raises `KeyError` without it) and `PICKS["<key>"] = seed`.
   - Paint with `uv run web3d/pixel/gen_rooms.py paint --count 2 --start 1500`. It paints every room in `PROMPTS`, but
     keeps existing candidates. Then copy the pick to `paintings/picks/<key>.png`.
   - Allow it in `.gitignore` (`!web3d/pixel/paintings/picks/<key>.png`, beside `radio.png`). Otherwise the build's
     input is never committed.
   - Bake with `uv run web3d/pixel/gen_rooms.py build`.
8. **The room's animation (`web3d/src/rooms-fx.js`).**
   - `animate(…, canvas.dataset.room === 'radio' ? radio : post)` silently gives any third room the Post Office's
     animation. Make it a map, `{ radio, post, <key> }[canvas.dataset.room]`, and write `function <key>(ctx, fx)`.
   - Update the file's header comment, and `ENTRIES`' comment in `web3d/vite.config.mjs`.
   - The `rooms` bundle already loads on any `room-hero.html` page; it needs no new entry.
   - Only for a scene of its own:
     - a new `ENTRIES` mode in `web3d/vite.config.mjs`, and a `vite build … --mode <mode>` in `package.json`'s
       `build:building`;
     - its own `gen_<key>.py`, with a step in `ci.yml`'s art rebuild;
     - a `depth_map.py` choice;
     - `iris.js`'s `arrive()` called on load. Without it the page stays hidden under `html.iris` until `push-in.js`'s
       3 s timeout.
9. **Lists of district pages** (until #338 makes them front matter). Add `"<layout>"` to the `(slice "radio" "post")`
   in both:
   - `layouts/partials/head.html` (the time-pick skip list: the page then has no `data-time`);
   - `layouts/partials/pixel-bar.html` (`$animated`, the Pause).
10. **Checks and captures.**
    - In `scripts/check-generated-html.js`, add the route to `animated` (the Pause, line ~277). Add `["<key>",
      "/<slug>/"]` to the label loop (~429). Add a content check like `/podcast/`'s if the page has a key link.
    - In `scripts/capture-screenshots.js`, add a route `/<slug>/?${pinned}&fx=off` with its `requiredSelectors`, and
      raise `.city-tag` and the chips from 5 to 6 in `citySelectors`. Those are minimums, so nothing fails if you don't.
    - `check:csp` walks every built page by itself.
11. **`CLAUDE.md`.**
    - "zooms into five districts", and the list after it.
    - The GoatCounter list (`district-<key>`), and the new page's event, if any.
    - "Content Structure", and `head.html`'s note about which pages skip the pick.

## What catches mistakes
- **A label without an anchor** (`anchors()` or `city.json` missing the key): Hugo fails at `index $at 0`.
- **A missing `FX` key:** `KeyError` in `gen_rooms.py build`. A missing `<key>-fx.json` or `<key>.webp`: Hugo fails in
  `room-hero.html`. A missing rooms bundle: its own `errorf`.
- **The Pause** missing, or appearing where it shouldn't: `check-generated-html.js` (once step 10 lists the route).
- **The label's href or `district-<key>`:** `check-generated-html.js` (step 10's loop). A `#<key>` back link to a
  missing label: `check-links.js`.
- **Committed art not matching the picks:** CI's "Rebuild the art and compare it". Art never committed: `check:csp`
  sees its 404. A missing phase's city art: `npm run check:phases`.
- **Words in a template:** `check:template-copy`.
- **Caught by nothing:**
  - a missing `next.<key>` (the go link throws in the browser);
  - `rooms-fx.js` falling through to `post`;
  - a missing `ZOOM` key (the zoom breaks, and so does the pre-paint's return from the district);
  - `head.html`'s skip list (the city backdrop is picked behind the room);
  - movers walking through the new building;
  - a stale depth map;
  - CLAUDE.md, CONTENT.md and `llms.yaml`.

  `check:csp` never clicks a go link into a district page (#337). Try the push-in by hand.

## Verify
- `uv run web3d/pixel/gen_city.py json` (only `city.json`: fast) after a change to `gen_city.py`'s data.
- `npm run build:building && npm run check:static`, or push and let CI run everything: the machine is often busy, and
  CI also compares the art.
- `npm run serve`, then:
  - `/?time=dusk|day|night` and `/?season=winter`: the label's place, and the zoom, on a desktop and on the `mobile`
    preset;
  - the label's second click: the push-in lands on the room's middle, and the iris opens;
  - Back, which returns to the city zoomed on it;
  - `/<slug>/?fx=off`, and under reduced motion, which gives a plain link.

## Done when
- He approved the mock. The building stands in all 8 city pictures. Its label and chip zoom there and go in, and the
  push-in lands on the page.
- The page shows its room, animated, with the Pause, a way back to `#<key>`, and its words in `data/`.
- All art and JSON are committed as baked. The lists in steps 9 and 10, `CLAUDE.md` and `CONTENT.md` name the district.
