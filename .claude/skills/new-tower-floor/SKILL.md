---
name: new-tower-floor
description: Add a job to the Career Tower on the homepage, either as a new experience entry on a storey that already has a room, or as a new storey (floor 8, 9) with its own painted room, lamps and animation. Use when Yonatan says "add a floor", "new job", "new role", "new experience entry", "add floor 8", or "put my new job in the tower".
---

# A new job on the Career Tower

## Preflight: check everything before you edit

Stop before the first edit if any **hard** item is missing. Tell Yonatan exactly what is missing and how to provide it.
If only a **later** item is missing, do the steps that don't need it and list what is left for him.

**Inputs from Yonatan** (all hard):
- The entry: `jobTitle`, `company`, `location`, `duration` ("Mon YYYY - Present" if current), `summary`, `date`, and at
  least three `highlights` (the first three go on the floor's card). He must say which numbers are confirmed. Use no
  vendor names: write "third-party transaction monitoring", as the existing entries do.
- **Which storey.** Each entry needs a storey of its own, and today floors 2 to 7 all have roles (`grep -h '^floor'
  content/experience/*.md`). So a new job means one of two things:
  - **Case A, an existing storey**: he names an entry to replace, or a storey that has a room but no entry.
  - **Case B, a new storey**: `8`, then `9`. These are the only single characters with a lift glyph (`FONT` in
    `gen_floors.py`).
- Case B also needs:
  - What furnishes the room: objects that tell the company's world, with no text or logos.
  - An accent ramp, picked from `R` in `gen_floors.py`. A new ramp is also allowed, but it must share no colour with
    another ramp (an assert checks this).
  - What moves in the loop.
  - Whether the room shows outside. Only the lobby and the roof do today. If it does, it needs a painting at every hour
    and in winter.
- If the job is current: the old current role's new end date. The lobby's "now at" sign picks the highest floor whose
  `duration` ends in "Present".
- Whether the old anchors `#experience` and `#proof` (`LEGACY` in `web3d/src/hash.js`, now `'7'`) should follow the new
  role.

**Tools** (Case A needs none of them):

| Check | Command | Blocks |
|---|---|---|
| uv on PATH | `uv --version` | hard for Case B |
| Draw Things listening | `nc -z 127.0.0.1 7860` | painting (steps B2, B9): later |
| The lobby's base painting is committed | `ls web3d/pixel/paintings/candidates/lobby_1017.png web3d/pixel/paintings/picks/lobby-px.png web3d/pixel/paintings/picks/cab-px.png` | hard for Case B |
| Hugo, at the pinned version | `.tools/hugo/hugo version` (or `hugo version` when there is no `.tools/hugo/hugo`), compared with `grep HUGO_VERSION .github/hugo.env` | the local build: later (CI builds) |
| Node deps | `test -d node_modules/vite && echo ok` | `npm run build:building`: later |

Draw Things runs on Yonatan's machine, and only he runs it or approves its jobs. If it is down, write the entry, the
`ROOMS` prompt and the `FLOORS` stub. Leave the `FLOORS` line commented out until the pick exists, or every
`gen_floors.py` run fails. Then hand him the exact `uv run` commands below.

## Steps

### Case A: the storey has a room
1. Create `content/experience/<slug>.md`, copying the front matter of `content/experience/billie-staff-payments.md`. Set
   `floor: "N"` quoted, with its `# its storey in the building on the homepage` comment. The body is the highlights as
   prose.
2. If the job is current, set the old role's `duration` to its end date. A storey taken over by another company keeps
   the old company's room: repaint it under the same key (Case B steps 1 to 5, 7 measured again, 8).
3. If the role carries a case study, add `proof.items` in `data/home/en.yaml` with `floor: "N"`.
4. Check that the copy still fits: `city.districts` tower `text` in `data/home/en.yaml` ("from university to
   payments"), `data/cv.yaml`'s summary lines (which name the employers), and `hugo.toml`'s `description`.

### Case B: a new storey (here `8`; the room key `<room>`, like `billie_payments`, but one word with no `_` if it shows outside: `retime` and `winter` read the room from the file name up to its first `_`)
1. **The room prompt.** Add `"<room>": ("…")` to `ROOMS` in `web3d/pixel/paint_rooms.py`, in the style of its neighbours:
   - a list of objects from left to right;
   - "the upper wall in the middle of the room is bare plaster";
   - a colour accent.

   `EDIT` and `TAIL` are added around it. The model edits `floor_base()`, the lobby (`LOBBY`, `lobby_1017.png`) carried
   across, so the lift and wall run on.
2. **Paint (Draw Things, Yonatan).** Run `uv run web3d/pixel/paint_rooms.py <room> --count 3 --start 1100`. This writes
   `paintings/candidates/<room>_<seed>.png` at seeds start, +17, +34. Existing candidates are kept, so a new batch
   needs a new `--start`. He picks one.
   - If the room turned a corner beside the lift, mend it with `uv run web3d/pixel/paint_rooms.py wall --src
     <room>_<seed>.png --band X,Y`, as floors 1 and 3 were.
   - If a fault needs patching, use `patch_picks.py` and `install_picks.PATCHES`.
3. **Commit the candidate.** Add `!web3d/pixel/paintings/candidates/<room>_<seed>.png` (and `-wall.png`) to the
   allowlist in `.gitignore`, beside the other rooms. Its comment there is wrong; leave it (until #339 lands).
   `picks/*-px.png` is already allowed.
4. **The pick.** Add `"<room>": "<room>_<seed>.png",` to `PICKS` in `web3d/pixel/install_picks.py`. Then run `uv run
   web3d/pixel/install_picks.py <room>`, which writes `paintings/picks/<room>-px.png` (928x308, with the lobby's lift
   pasted in). No model is needed.
5. **The animation.** In `web3d/pixel/gen_floors.py`, write `def <room>(room, f, phase)` beside `billie_payments`. Use
   `Layer`'s `put`, `rect`, `lit` and `brighten`, and `sprite` and `line`. Coordinates are the pick's own 928x308 px.
   - Paint only over what is there: lights, screens, a glint, in the room's own colours.
   - Frames 1 to 11 together must change at least one pixel. Otherwise `build()`'s `min()` raises `ValueError`.
   - Keep everything that moves within pick x 69..904 (strip x 85..920), or `build()` asserts "moves over what its runs
     are read from".
6. **`FLOORS`.** Add `"8": ("<room>", "<ramp>", <room>, [lamp x, …]),` **between `"7"` and `"R"`**. `FLOORS` is bottom to
   top, and `floors.json` `order` (`ORDER` in `web3d/src/art.js`) is `list(FLOORS)`. Placed after `"R"`, floor 8 goes
   above the roof, and no check catches it. The lamps are the hanging lamps' x in the pick; `LOBBY_X` is added for you.
7. **`RIGHT_SKIRTING`.** Add `"8": <row>`. The value is the skirting's top row at the room's right edge, in **strip** rows:
   the row in `picks/<room>-px.png`'s right columns (x ~920..927) plus `CEIL` (28). For comparison, floor 7's is 330.
   - To read it, crop and enlarge that edge: `uv run --with pillow==12.1.0 python -c "from PIL import Image as I;
     I.open('web3d/pixel/paintings/picks/<room>-px.png').crop((880,240,928,308)).resize((192,272),0).save('<scratchpad>/edge.png')"`.
     Then Read the image. Its row is 240 plus the pixel row divided by 4.
   - A missing key raises `KeyError` in `runs()` (until #339 folds it into `FLOORS`).
8. **Bake.** Run `uv run web3d/pixel/gen_floors.py static/building/pixel` with **no KEY**. Only a full run writes
   `floors.json`, and with no folder the script writes into `.`. The run also rewrites `data/floor_accents.yaml` and
   checks `data/phases.json`. Never hand-edit `floors.json` or `floor_accents.yaml`. Commit everything it changed: the new
   `floor-8.webp`, `floors.json` and `floor_accents.yaml`.
9. **Only if the room shows outside** (follow the lobby, `reception`):
   - **Each hour (Draw Things).** `uv run web3d/pixel/paint_rooms.py retime --src <room>_<seed>.png --time dawn|day|night`,
     then `winter --src <that hour's pick>.png --start 700` for dusk and each hour.
   - **The dicts.** Add `WINDOWS` and `SNOW` (`paint_rooms.py`); `VIEW` and `SNOWED` (`install_picks.py`); and the
     `PICKS` entries `<room>-<hour>`, `<room>-winter` and `<room>-winter-<hour>`, with their candidates in the
     `.gitignore` allowlist.
   - **`data/phases.json`.** Add `8` to each phase's `baked` and `winter.baked`, in `FLOORS` order (`"L8R"`).
10. **The entry.** Write it as in Case A, steps 1 to 4, with `floor: "8"`.
11. **The docs.** In `CLAUDE.md`'s "New experience", "Floors 2 to 7 are the roles" becomes 2 to 8. If the tower's count
    is pinned, `section.building-stop` in `scripts/capture-screenshots.js` is a minimum (9). You can raise it, but
    nothing fails if you don't.
12. **`hash.js`.** No routing change is needed: `floorKey(hash, ORDER)` lets a real floor 8 win over `LEGACY`'s
    `'floor-8': 'L'`. Change the header comment to say that "floor 8" is now a role. Drop the `LEGACY` key only together
    with `scripts/test/building-hash.test.js:17`, which asserts it. Move `experience` and `proof` only if he said so.

### Testimonials (either case)
Create `content/testimonial/<name>.md` like `blake-irvin.md`: `name`, `position`, `source`, `date`, a photo in
`assets/images/testimonials/`, and `pullQuote`. The `pullQuote` must be an **exact** excerpt of the body. The build only
checks that it is present (`layouts/index.html:108`, #340), so compare it with the body by hand.

## What catches mistakes
- **`floor` unquoted, taken, or `R`/`1`/`L`/`P`, or `highlights` missing:** `layouts/partials/check-floors.html` fails
  the Hugo build and names the file.
- **An entry on a storey with no room** (the `.md` written before step 8): the same partial says "has no colour in
  data/floor_accents.yaml". This is the intended catch, because only `gen_floors.py` writes that file.
- **A missing `pullQuote`:** a Hugo `errorf`. A paraphrase or wrong wording is caught by nothing.
- **Art not rebuilt or not committed:** CI's "Rebuild the art and compare it" fails when `floors.json` or a committed
  picture differs, and when `floor_accents.yaml` changes (`git diff --exit-code -- data`).
  - A `floor-8.webp` that was never committed passes that compare, which only walks committed files. `check:csp` then
    fails on its 404.
  - CI never runs `install_picks.py`, so a `-px.png` left un-reinstalled after a `PICKS` change passes (until #339).
- **The wrong `baked` in `phases.json`:** the `phases()` assert in `gen_floors.py`, and `npm run check:phases`.
- **An accent too dark as link text:** axe in `check:csp`, probably.
- **Caught by nothing:**
  - `FLOORS` order;
  - a wrong `RIGHT_SKIRTING` row (the wall's grain is misaligned past the strip on a wide screen);
  - lamp x;
  - the old role's `duration`;
  - copy that names the employers;
  - the `.gitignore` allowlist, without which the candidate is lost locally;
  - a `<room>` key with `_` that shows outside: `retime` silently uses the roof's `OUTDOOR` prompt, and `winter` raises
    `KeyError`.

  Look at each by hand.

## Verify
- Case A: `node scripts/run-hugo.js --gc --minify` (needs `npm run build:building` once). Or push and let CI build:
  the machine is often busy, and CI runs the full suite.
- Case B: `uv run web3d/pixel/gen_floors.py --data` (fast: the accents and the phases check), then step 8's full bake.
  `git status` must show `floor-8.webp`, `floors.json` and `floor_accents.yaml`.
- Look at the result: `npm run serve`, then `/#floor-8`, `/?time=night#floor-8` and `/?season=winter#floor-8`. Check the
  lift's button order, the lamps lighting on arrival, the loop, and the strip's right run on a wide window.
- `npm test` covers `hash.js`, if you touched it.

## Done when
- The entry builds, the floor's card and panel show it, and the CV and `llms.txt` list it.
- For a new storey: the room is between 7 and the roof in the lift, animated, with its lamps where it was painted; the
  art and data are committed as baked, and the candidate is in the allowlist.
- The old current role ends, the "now at" sign points to the new floor, and the copy that names employers is updated.
