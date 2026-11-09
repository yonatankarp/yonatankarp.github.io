# Personal Website - yonatankarp.github.io

## Stack

- **Hugo** static site generator (v0.169.0, pinned as `HUGO_VERSION` in `.github/hugo.env`; see Deployment)
- **Custom Hugo layouts** in `layouts/`
- **GitHub Actions** for CI/CD to GitHub Pages
- Site styles in `assets/css/custom.css`
- Custom JS in `assets/js/site.js`
- Pixel skin is `.px-skin` in `assets/css/custom.css`; the top bar is `layouts/partials/pixel-bar.html`
- Static images and icons in `static/images/`

## To add something

Each of these has a project skill in `.claude/skills/` that walks every file it touches, what checks it and what does not:

| To add | Skill |
|---|---|
| A blog post, its cover and pixel cover, a tag or topic chip, a Mermaid diagram, inline art | `new-blog-post` |
| A project on Workshop Row, an archived one, or a new project group (a fifth workshop) | `new-project` |
| A job in the Career Tower, on a storey with a room or on a new storey (8, 9) | `new-tower-floor` |
| A sixth district in the city, with its building, label, push-in and page | `new-city-district` |
| A holiday, and its prop on the tower's plaza | `new-holiday` |
| A time of day the art shows, or a second season with art of its own | `new-hour-phase` |

## Build & Run

```bash
npm run serve            # dev server (builds the pixel building bundle, then hugo server)
npm run build            # production build: bundle, hugo --gc --minify, then the CV PDF
npm run check            # the build plus every check of the built site
npm test                 # node:test tests of the scripts (scripts/test/)
npm run lint             # ESLint, and Ruff over web3d/pixel/ (needs uv)
npm run art              # rebuild all the art from the committed picks into static/building/pixel/ (or -- OUT)
```

Scripts share their helpers through `scripts/lib.js`. CI also rebuilds the art (`npm run art`, and `install_picks.py`'s
picks) and fails unless it matches the committed files pixel for pixel (`web3d/pixel/compare_art.py`).

The homepage's script and styles live in
`web3d/src/` and are bundled by Vite into `assets/building/` (gitignored), so plain `hugo` fails until
`npm run build:building` has run (`scripts/build-building.js`, a build of each of `ENTRIES` in `web3d/vite.config.mjs`). That script also draws each Mermaid fence in `content/` that has no drawing yet to SVG with the `mermaid`
package in Playwright's Chromium (`scripts/render-diagrams.js`, into the gitignored `assets/diagrams/<sha256>.svg`), which
`render-codeblock-mermaid.html` inlines, so posts ship no Mermaid JS; `assets/js/diagram-zoom.js` adds the Zoom in. The
hook fails the build when a diagram changed since it was drawn: rerun `node scripts/render-diagrams.js` (also during
`npm run serve`), which keeps the drawings it still needs and removes the rest.

The art is in `static/building/pixel/`, made by the Python pipeline in
`web3d/pixel/` (Draw Things paintings, pixelated and animated in code). Its data that is bundled into the JS
(`floors.json`, `cats-lobby.json`) or read while building (`city.json`, `workshop.json`) is kept out of `public/` by the
`static` mount's `files` in `hugo.toml`: a new such file goes there too. How the pipeline paints, mends and bakes each
picture is in `web3d/CLAUDE.md`, which Claude Code loads when a session works under `web3d/`.

## The city

The homepage (`layouts/index.html`) opens on the city: an aerial pixel-art panorama (`web3d/src/city.js`, `city.css`)
that zooms into five districts, picked from a label or a chip in its panel: the Career Tower, the
Library (`/blog/`), Workshop Row (`/projects/`), the Radio Mast (`/podcast/`) and the Post Office (`/contact/`). The
map moves by one transform (translate and scale, never scrolling), clamped so no edge of the art shows; a wheel, a
trackpad or a finger pans it sideways at any zoom, and a pinch is the browser's zoom. A resize keeps the pan, re-clamped, and
re-centres only on a new width. The same chip again, or "Whole city", zooms back out ("Whole city" hands
focus to the chip that was picked; on a phone it sits at the panel's top right, beside the kicker, so it shows without a scroll). A label's first
click zooms to its district; the picked label then shows "→", carries `aria-current` and the description `again` in
`city` (`#city-again`), and its next click goes in. Enter or Space on a label goes straight in (a click with no pointer). A label stays whole on screen,
slid inside the edges by `--shift` as on Workshop Row; one whose district is out of view, or that would sit under the
floating panel, fades. The labels are out of the Tab order (`tabindex=-1`): the panel's chips are the keyboard's, so a keyboard passes five districts, not ten; a screen reader focusing one still pans the map to it. The whole city opens on
the tower, moved right until the Library's label clears the panel, as far as the tower's stays whole (the pre-paint
`assets/js/home-city.js`, inlined by `layouts/index.html`, does the same, by city.js's maths in `assets/js/home-view.js`).

Its
copy is `city` in `data/home/en.yaml`; the counts are Hugo's. Its art is `city[-PHASE].webp`, baked by
`web3d/pixel/gen_city.py` from `web3d/pixel/paintings/picks/city[-PHASE].png` (Draw Things paintings, the other hours edited from the dusk
one; the dusk pick carries one more edit, the tower's glass entrance doors, from `gen_city.py door`, and the hours were
edited from it with the door), which also writes `city.json`, the labels' anchors the template reads and each district's zoom (its building's
middle in % of the art, and how far to zoom: `ZOOM`), times the whole city's device px an art px, to the nearest
whole number, capped where an art pixel would pass `MAX_PX` (4) screen px, so a big screen zooms less than a phone, and
never under the whole city (where that is the nearest, a pick only pans).

Without a script the city is its
panel at the top of the page, every district's words and link in a column (the `<noscript>` style in `layouts/index.html`),
so those links still land on it. At the city the city's section is the page's main landmark (`role="main"`, set by
`city.js`: without a script the tower's `<main>` is the page) and the skip link is "Skip to the city" (`#city`); in the
tower it is "Skip to the current floor" (`#building-stops`), and `city.css` shows the one that fits.

## Going into a district

Going in (a district's go link, or its label's second
click) the map pushes on, ease-in over 450 ms, and the next view opens from it in a dithered iris (`web3d/src/iris.js`)
while it settles from 1.18 to 1; every other link keeps the wipe. The tower and Workshop Row have doors (`doors` in
`city.json`, `DOORS` in `gen_city.py`): the city's lands on the next view's door at its size, to 14 screen px a city art
px. The tower's is the lobby's glass entrance, at the right of the lobby, where pixel.js lays it out (`lay` in
`web3d/src/art.js`; a phone's lobby starts on it and pans to its usual focus, art x 600, as it settles). The lobby opens
with that entrance standing open (`floor-L-open[-winter][-PHASE].webp`, in `web3d/CLAUDE.md`), which dissolves into the strip's shut doors 250 to
650 ms into the settle, whole art pixels at a time in the iris's 4x4 Bayer order. The city's entrance opens first: `door-open[-PHASE].webp`, the same hour's painting
with the doors open, kept as its crop round the door (`picks/city-open[-PHASE].png`, from `gen_city.py door --open`),
pasted on the pick, baked on the pick's own colours and cut at `DOOR_OPEN` (`doorOpen` in `city.json`); in winter,
`door-open-winter[-PHASE].webp`, that crop edited to snow as the winter picks are (`gen_city.py door --winter`), of which
only the doorway (`DOORWAY`) goes on the winter pick's crop (`picks/city-open-winter[-PHASE].png`). Both pick their
file by `html[data-season]` and the hour, as the shut art does. The tower is
this page, so city.js lays the frame over it and enters `#floor-L`. Workshop Row's is the first workshop's door where `/projects/`
pans it on load (`door` and `shutter` in `workshop.json`, from `gen_workshop.py`), whose shutter then rolls up.

The
Library, the Radio Mast and the Post Office push into the building's middle, ending on their room header's middle.
Those are pages of their own: the city leaves its last frame in sessionStorage, and their head's pre-paint
(`assets/js/push-in.js`, allowed by its hash in `head.html`) holds the old page's view transition (`html.iris` in
`custom.css`) until iris.js lays the frame over the page. A plain link under reduced motion, with `?fx=off`, where the
tower is the plain page, or for a click that opens a tab; Back restores the city as it was (`pageshow`); where the
browser reloads it instead, the city opens on the district it went into, from the entry's `history.state.at`, which
`pick()` keeps. The four pages' "← Back to the city" link is `/#KEY`, which the pre-paint `home-city.js` moves into
that state and off the address; it lays out the zoomed view, the picked label and the panel before the first paint, as
`pick()` does (minified twice, as one pass is not stable under `minifyOutput`). A plain visit to `/`, the name plate
included, opens on the whole city.

## The Career Tower

The Career Tower is the pixel-art career
building, entered at its lobby: any `#floor-X` address, or an old one-page anchor (`LEGACY` in `web3d/src/hash.js`, which the pre-paint
`$floorHash` in `layouts/index.html` must match: `scripts/test/building-hash.test.js`), opens it directly, and pixel.js mounts it only then; back
at the bare address (or `#city`, the name plate and the lobby's sign) the page reloads on the city: Back, zoomed on the
tower (its entry keeps `history.state.at`), and `#city`, a new entry, on the whole city. It is the career
only: every other topic has its building in the city. The old street's `#floor-E` lands in the lobby (`web3d/src/hash.js`),
and the old garage's `#floor-P` and `#client-and-work-section` go to `/projects/`, query kept (the pre-paint `assets/js/home-guided.js`, inlined by `layouts/index.html`). The lift's plate starts with
"← City" on every floor, a link to `#city` like the name plate and the lobby's sign. Each experience entry's `floor`
front matter places it in the building; testimonials need a `pullQuote` that is an exact excerpt.

The tower's art is 928x308 a room (painted at 2304x768, box-reduced and median-cut to 64 colours, no dither, like the
city), in a 960x360 strip with its slabs: `paint_rooms.py` paints (every room an edit of the lobby carried across, so the
wall, skirting and floor run on from the lift), `install_picks.py` bakes the picks (`PICKS`) and pastes the lobby's one
lift into each (on the roof, whose hours repainted it, its call panel too: `PANEL`, relit to the hour's wall), and
`gen_floors.py` draws the slabs, the floor number and what moves (each room's animation, which only paints over what is
there: lights, screens, a glint in the room's own colours). A strip is its rest frame, two runs pixel.js tiles past it on a
wide screen (each row in the light the room's edge leaves it with, grained with the left wall's outer columns mirrored:
`runs`), the lift's cab (`paint_rooms.py cab`, a painting of its own, which pixel.js shows behind the painted doors as
they slide apart), and its moving box's other frames. The numbers `web3d/src/` draws by (strip size, runs, each strip's moving
box, lift doors, the lobby's entrance, dither, each room's lamps, the floors' order, floor 7's capsule, the lobby's receptionists and cats) are written into `static/building/pixel/floors.json` by
`gen_floors.py` and bundled from there, and `data/floor_accents.yaml` is written by it from `FLOORS`: change the Python,
rerun it, never the copies.

`pixel.js` is the lift and the floors, `ride.js` the lift's ride (tested in `scripts/test/ride.test.js`), `art.js` what it reads; it keeps only the storeys
round the lift's stop decoded (`KEEP`), so a phone holds about 50 MB of them at most, and loads the stop's strip
before the storeys round it. When only the live sprites below change, it redraws just their boxes. With a floor's panel open on a wide screen it slides the
room right, at the same scale, until the room covers the view beside the panel (`besidePanel`). One thing moves live, not in the
strip's 12 frames: floor 7's payment, a painted pneumatic-post capsule (`picks/capsule.png`, on magenta, from
`paint_rooms.py capsule`; `gen_floors.py` keys it into `capsule.webp` at 4x). pixel.js turns and smooths it into the room's
own art pixels every frame, along `CAPSULE` (its path, size, ride and clip, in floors.json; the path and easing are
`web3d/src/capsule.js`), from the start of each loop, darkened with the room, and not while paused or held.

The lobby's
receptionist is drawn live too: one of two painted upper bodies behind its desk (`picks/reception/NAME_POSE.png`, on
magenta, from `paint_rooms.py receptionists`; `gen_floors.py` keys, cuts at the desk and bakes both into
`receptionists.webp`, a row each and a column per pose, a 17 px head on 32 colours). Each visit picks one of them at even
odds, and only that one is drawn, at the one spot both share (right of the ledger and bell). They rest, and now and then
write in the ledger or look toward the lift or the door, resting in between, by their own weights and times on a random
clock (`web3d/src/reception.js`, which picks the person too, tested on a seed in `scripts/test/reception.test.js`); the
spot, the desk's row, the weights and the times are `RECEPTION` in floors.json. pixel.js draws them once, where the desk
is, darkened with the room; paused they hold their pose, held (reduced motion, the plain page) they only rest. Yonatan's
two cats live in the lobby too, the same `web3d/src/cats.js` as on Workshop Row: their perches are the bench's seat and the
counter's top (right of the ledger and bell, in front of the receptionist), their street the floor in front of the desk,
off either end of the room and back; one starts on the bench, the other on the floor. They are `cats-lobby.webp` and
`cats-lobby.json` (`gen_walkers.py bake`, at `CAT_LOBBY` art px, from the same picks), and their perches, floor, edges,
starts, still poses and scale `k` against the Row's (which scales their speed, room and leaps) are `LOBBY_CATS` in
`gen_floors.py`, written into floors.json as `cats`. pixel.js draws them after the receptionist, the farther first, each
in a small canvas on the Bayer grid, darkened with the room and clipped to it (never into the runs), and again over the
open lift's doors; paused they hold their pose, held one loafs on the bench and one sits on the counter.

## Time of day and season

The building's art follows the real sun where the visitor is: their time zone's main city (`data/timezones.json`, Berlin
when unknown; each zone's latitude and longitude from the tz database, written by `node scripts/gen-timezones.js`, rerun
after a tzdata release that adds zones) gives the sun's elevation now, day above +6°, night at -8° or below, and dawn or dusk between, before or
after noon. It is picked once at load by the inline script in `layouts/index.html` (`html[data-time]`), from
`assets/js/time-pick.js` (tested in `scripts/test/time-pick.test.js`). `/?time=dawn|day|dusk|night` overrides it for
testing; anything else means the sun. Never pick by the hour: read `html[data-time]`, and a file by `html[data-art]`,
its `[-winter][-PHASE]` suffix (`strip()` in `web3d/src/art.js` for a storey). Dusk is the plain files. Which hours light
the lamps (props, headlights, moths: `lit`) and show the stars over the roof (`starry`) is each phase's in `data/phases.json`. The other pages' backdrop is a crop of the city at the hour (`backdrop[-NAME].webp`, written by
`gen_city.py build`), behind the sheet: the pick is `layouts/partials/time-pick.html`, shared by the homepage and
`head.html`, and `assets/css/custom.css` maps `html[data-time]` to the backdrop. The Library (`/blog/`), the Radio Mast and the
Post Office (`backdrop: false` in their front matter) hide the backdrop and skip the pick, so they have no `html[data-time]`, `data-season` or `data-place`: code there that
needs them adds the pick back in `head.html`.
`data/phases.json` lists the phases (the sky above the roof, the baked rooms, how far a dark room falls), and
`web3d/src/art.js` and the scripts read it. To show a new phase, add it there, to that pick, to the backdrop rules in
`custom.css`, and paint the city, Workshop Row, the roof and the lobby's view at it: `npm run check:phases` (part of
`npm run check`) fails until those agree with `phases.json`, and `gen_floors.py` checks its baked rooms (the paintings
there are) and its sky (the roof strip's top row, which `sky_band` draws in it) on every run.

The same script picks the visitor's season, `html[data-season]`, from the date and their zone's latitude (`seasonOn`,
`assets/js/season.js`, which `time-pick.html` and `scripts/lib.js` append after `sun.js`, and `calendar.js` re-exports;
summer within the tropics). `?season=spring|summer|autumn|winter` overrides it. Only winter has art of its own, at every
hour: the city, Workshop Row and the roof, each the hour's pick edited to snow (`--winter` in `gen_city.py`
and `gen_workshop.py`, `paint_rooms.py winter`, seed 700, which keeps the layout; prompts that name the hour's light, or the model paints an
overcast day), the lobby's view, its dusk door crop under snow and each hour that winter crop retimed, so the street and
its snow are the same at every hour (`paint_rooms.py door --winter [--time PHASE]`, `DOOR_WINTER`;
`picks/reception-door-winter[-PHASE].png`), and the backdrop, its crop. The files
put the season before the hour: `city-winter[-PHASE].webp`, `floor-R-winter[-PHASE].webp`, `backdrop-winter[-PHASE].webp`;
each phase's `winter` in `phases.json` has its sky and baked rooms (`LR`, dusk too), and `art.js` fetches only the
season's strips. The city's windows and bay are found again in the winter art (`city-winter-fx.json`,
`city-winter-windows.json`); its depth map is shared. `check:phases` fails until every phase has its winter art.

## Holidays and props

`web3d/src/outside.js` works out the holidays from `calendar.js` (tested in `scripts/test/calendar.test.js`), with the
season and the visitor's place (`html[data-place]`, for sunset) from the head's pick; the city imports it for the props
below. Every visitor gets the same holidays, his: Christmas, the new year (`new-year`, day 0 on 31 December, 1 on
1 January), Easter, Halloween (`halloween`, 24 to 31 October), and the
Jewish holidays by their Hebrew date (Rosh Hashanah, Sukkot, Hanukkah, Purim, Passover, Independence Day with the law's
moves, Lag BaOmer, Shavuot; not the solemn days). The Hebrew ones (`sunset: true`) begin at sunset:
`holidaysOn`'s `evening` flag reads the next day for them, which outside.js sets once the sun is below -0.833° at the
visitor's city after noon (`isEvening` in calendar.js), from `assets/js/sun.js`, the elevation the time-of-day pick uses too (`time-pick.html` and
`scripts/lib.js` put it after `time-pick.js`, without its `export`). `?holiday=` pins them (`fromQuery` in calendar.js), by
those names (`?holiday=halloween`, `?holiday=new-year:1`); a pin also counts as that night's evening, so the fireworks
show at any real hour (`OUTSIDE.evening` and `afternoon`, which `dressing` reads).

On the plaza either side of the tower stand the holidays' props (`web3d/src/props.js`, tested in
`scripts/test/props.test.js`): a hanukkiah through Hanukkah, foot at art (694, 233), lit on day N with the shamash and N+1
candles from the right, and a Christmas tree from 1 to 26 December, foot at (800, 236), snowy in winter and plain in any
other season (a southern Christmas), its 34 bulbs twinkling and its star glowing. Candles and lights burn at dusk and
night only, the props are darkened with the hour (`TINT`; which go up, which candles burn, lit or not and the tint are
`dressing`, tested apart from the drawing), and walkers and props are drawn by their feet's row, so
nobody walks through one. `?holiday=hanukkah:3,christmas` (or `none`) pins them. Through Halloween's last week (24 to 31 October)
four jack-o'-lanterns stand right of the tower's door, clear of its open-door crop (`DOOR_OPEN`), the plazas and the other
props (`HALLOWEEN`, which the bake checks): pumpkin-tall 13, pumpkin-round 14 and pumpkin-small 11, painted unlit, 9, 8 and
6 art px; the bake finds each carved face and paints it dark (`face()`), and the page lights its pixels with a flicker at
dusk and night (`halloween.webp`, `halloween.json`). At its dusk and night a few ghosts drift over the main street and the
roofs, half see-through, swaying through four painted frames and hiding behind what is nearer than the depth each path
gives (`ghosts.webp`, `ghosts.json`: ghost-a 2300 and ghost-b 2368, `GHOST` 10 art px tall, `GHOST_PATHS`), and the birds
are bats, the same flocks with the painted bat's four wingbeat frames (`bats.webp`, `bats.json`: bat 2400, `BAT` 9 px
across, dimmed at night as the birds are). On the night of 31 December, from sunset where the visitor is through the
small hours of 1 January (not 1 January's own evening), fireworks go up just left of the tower: a spark climbs `RISE`
(30) px at 30 px a second, then a painted burst grows over 5 frames of 70 ms and fades over 4 of 240 ms (`BURST` in
props.js), up to three at once. Their middles fall in `SKY` (art x 640-712, rows 46-56: below a phone's top bar and left
of a desktop's Download CV), off the crane's lights by `CORE`; what the depth map has nearer than the sky at the top of
its column (the tower and the crane) is cut out of them (`fronts`).

## Scenes and animation

Every scene at rest, like the tower, shows an art pixel as a whole number of device px:
the city, Workshop Row, the Library's head and the rooms' heads at the fewest that cover their box, rounded up, never
under 1 (`round()` by `--dpr`, which `assets/js/dpr.js` sets on html before the first paint, in `city.css` and
`custom.css`), so they crop a little more than the plain cover, at the foot (the Library's about its 50% 62%, though its head is as tall as its whole room shows), and the
panning takes up the width; only a glide or a push-in passes through other scales.

The city's life (`web3d/src/city-fx.js`, imported by `city.js`) is drawn on a canvas at the art's own 1440x347 pixels,
laid over the city picture: walkers on the main street, the avenue and the plaza (fewer and dark at night), cars on the
main street, the ring road and its branches and the roads on the left (headlights at dusk and night; each lane in `LANES`
a one-way route between two hidden ends, offset to the right of its road's middle, the ground under its points capping
`footAt` so the greenhouses hide the road behind them), windows going dark at night, glints on the bay, the radio
mast's beacon and the crane's lights, and flocks of birds. Movers hide behind what is nearer in `city-depth.png`
(brighter = nearer). In winter snow falls over the whole art (`snowfall` in `scene-fx.js`: 520 flakes, 1 px and some 2 px, 7-23 px a second
with a drift, bluish and dimmer at night), on Workshop Row too; not on the roof, whose canvas redraws only when it moves.

Nothing moves under reduced motion or with `?fx=off`, but the props still stand there, steady (`animate`'s `poster`),
without the ghosts, bats and fireworks (a burst held still reads as a stain on the sky);
the loop stops while the tab is hidden, the city is off screen or the tower is entered, and draws on every k-th screen
frame, as often as keeps its fastest mover (the snow, a car; on the new year's night the fireworks' spark, 30) to an art
pixel a frame (a draw's `fps`, at most 60). A
painted sprite is drawn from its frame, made once, cut by the depth map only where something nearer is in its box. The top bar's Pause
(`data-building-pause`, rendered by `pixel-bar.html` on those five pages only, the homepage and those whose front matter
says `scene: true`, which `check-generated-html.js` checks against the pages that load a scene's bundle, and shown once the page's script animates it) holds the tower and all five scenes (a scene loaded paused shows one still
frame, its props and people standing there), and the Radio Mast's CSS EQ (its on-air lamp is unlit and still while
the show is off air); reduced motion hides it. It is kept as the tower always kept
it, per viewer in `localStorage` (`building-paused`), now across pages too: `scene-fx.js` keeps it and its one click
(`holdPause`, which `pixel.js` and the scenes call), and on the city it is the tower's once the tower is entered.

Workshop Row (`/projects/`) and the Library's header (`/blog/`) move the same way, sharing `web3d/src/scene-fx.js` (the
canvas loop, its pauses and the depth test) with the city.

## The Library

The blog's index (`layouts/blog/list.html`) is the city's Library: its reading room across the head (`library.webp`, baked
by `web3d/pixel/gen_library.py` from `web3d/pixel/paintings/picks/library.png`, one painting at dusk, at 720x173, half the
city's width, so a 1440 screen shows the whole room at 2 device px an art px: the head is at least that tall, to 52vh), then every listed
post as a card (`partials/blog-row.html`). A chip for every tag the listed posts carry filters the list, with the search
box (`assets/js/library.js`): the curated topics and labels in `data/library.yaml` first (a tag no listed post carries is
skipped, one with no tag page fails the build), then the rest, most posts first (ties by name), folded behind More topics (a `<details>`). Without a script the
chips are links to the tag pages and the search box a form to `/search/`.

`library-fx.js`, its own bundle (`--mode library`): the fire, dust in the window's light and clouds only over the
window's sky, from `library-fx.json`, which `gen_library.py build` writes from its `FX` and the sky it reads off the art.
Three readers walk its floor, each its own way (`web3d/src/readers.js`, tested on a seed in `scripts/test/readers.test.js`):
walking past and out of the room, stopping to look, or taking a book to read, facing either way, never two at one shelf, and none stopping within `gap` of another (they start that far apart too).
The floor line (on the lit parquet, behind the reading tables), the shelves, the gap, their speed, pace, weights and times are `FX["readers"]`. They are `readers.webp` and `readers.json`, which `gen_walkers.py bake` makes from
the walkers' frames and four browse poses (`browse` paints them; picks `NAME_browse_KIND.png`), 68 px tall, each on a soft
contact shadow. Only the reading lamps, the tables, the armchairs and the globe in front hide them: `gen_library.py`
pushes everything else in `depth_map.py library`'s map back to 0 down to the shadows' rows (`backdrop`), as the model reads
books and the wall's seams as nearer than the floor, so `library-fx.js` tests them from depth 0.

## Workshop Row

The projects' index (`layouts/projects/list.html`) is the city's Workshop Row: a street of four brick workshops, one per
project `group` (contributions, libraries, apps, games, in that order: `workshop.groups` in `data/rooms.yaml`), that pans sideways by scrolling
(`web3d/src/pan.js`; an up or down wheel too, where the panel floats) and opens on the first, the contributions; `workshop.js` slides each label to stay whole on screen. Its script and styles
are a bundle of their own, `assets/building/workshop.*` (`vite build --mode workshop`). Each workshop lists its projects
by `weight`; without a script every workshop's list shows. Its art follows the clock and the season like the city:
`workshop[-winter][-PHASE].webp`, baked by `web3d/pixel/gen_workshop.py` from `paintings/picks/workshop[-winter][-PHASE].png`
(dusk painted, the other hours edited from it, and each hour's winter from that hour), with `workshop.json`, the labels' anchors. The page is standalone (no baseof) so the
inline script that preloads the hour's painting is in `.Store "headScripts"` (run in the head after the time pick, before the
stylesheets) and the one that swaps it in is in `.Store "bodyScripts"`, both allowed by their hash in `head.html`.

`workshop-fx.js`: walkers on the pavement, two cats on the left
wall, a welder's sparks, code on the screens and moths round the lamps (at dusk and night), from `workshop-fx.json` and
`workshop-depth.png`, which `gen_workshop.py build` writes from its `FX` and the map `depth_map.py workshop` makes.
A walker steps one frame
per `stride` / 8 px of ground, so its feet do not slide, at 0.71-0.97 strides a second, and stands on each frame's own
sole (`foot`, the lowest painted row the bake finds); 8 by day, 4 dimmed at night. They walk off either end of the
art (`edge`) and, 1-9 s later, someone comes on from either end in either lane; past the pavement's end (`pavement`'s
x1) their feet keep its depth, so they pass behind the parked van. Yonatan's two cats (`web3d/src/cats.js`, tested in
`scripts/test/cats.test.js`) walk, sit and loaf on the wall's top (`wall`), turning back when they meet, and now and
then leap down to the pavement (`street`), trot off either end and back, and leap up again; they are `cats.webp` and
`cats.json`, which `gen_walkers.py bake` makes from `picks/cats/NAME_POSE.png` (`cats` paints them: a walk, sit, loaf,
crouch and leap, `CAT` art px tall walking; the lobby's are `cats-lobby.webp`, above).

## The Radio Mast and the Post Office

`rooms-fx.js`, its own bundle (`--mode rooms`): the Radio Mast's tape reels, VU needles and the mast's beacon (not its
on-air lamp's glow while the show is off air), and the Post Office's clock (the visitor's real seconds), lamps and dust, from `radio-fx.json` and `post-fx.json`
(`FX` in `gen_rooms.py`). The tape reels turn their painted cutouts: `gen_rooms.py` (`reels()`) bakes `radio-reels.webp`,
each reel's bare metal over its cutouts, which rooms-fx.js turns about the hub on the slanted disc (a reel is its hub, its
flange's half-width and half-height, its turn and its plain hub's reach, in `FX`). Their pages and paintings are under
Content Structure.

## Content Structure

- `content/experience/` — job entries (one .md per role)
- `content/education/` — education entries
- `content/projects/` — projects listed on `/projects/` (Workshop Row)
- `content/blog/` — blog posts
- `content/testimonial/` — recommendation quotes with photos
- `data/` — every other word on the site: `home/en.yaml` (the homepage, city, tower and contact), `cv.yaml`, `rooms.yaml`
  (the district pages), `ui.yaml` (the top bar, footer, buttons, labels, search, 404, a post's page, page titles),
  `art.yaml` (alt texts), `llms.yaml` and `library.yaml`. `CONTENT.md` maps each piece of text to its file and key
- Experience, education and testimonial entries have no pages of their own: the `[[cascade]]` in `hugo.toml` renders
  them with `layouts/_default/redirect.html`, a noindex redirect to their homepage floor
- `content/skills/_index.md` — skills page
- `content/cv.md` — printable CV page
- `content/podcast.md` and `content/contact.md` — the Radio Mast (`/podcast/`, `layouts/_default/radio.html`) and the Post
  Office (`/contact/`, `post.html`). Each opens on its room, painted across the head (`partials/room-hero.html`), the
  head as tall as the painting's 1440:347 shape at the screen's width, between 230 and 480px, the room at whole device px
  an art px covering it, its foot cropped, and a phone panning it: `radio.webp` and `post.webp`, baked by `web3d/pixel/gen_rooms.py` from
  `web3d/pixel/paintings/picks/{radio,post}.png` (one painting each, at dusk), with `ROOM-fx.json` for their animations
  (`web3d/src/rooms-fx.js`, its own bundle, `--mode rooms`). Their copy is `contact` in `data/home/en.yaml` and their labels
  `radio` and `post` in `data/rooms.yaml`. The Post
  Office's letter is ruled: every line sits 21px into a 30px row, and the visual captures fail when one does not

## Languages

The site is English-only. Do not create `.he.md` variants, translation keys, language switchers, or i18n files unless Yonatan explicitly restarts bilingual support.

## Layout Rules

- Prefer editing the custom templates in `layouts/` directly instead of introducing third-party theme assumptions
- Keep the design system's tokens in `assets/css/custom.css` (`.px-skin`), and the homepage's, which skips that file, in
  `web3d/src/pixel.css`, under the same names
- Put a page's own behaviour in its own script in `assets/js/` (`site.js` is what every page shares), and a scene's in
  `web3d/src/`, bundled by Vite
- No words in a template, outside `{{ }}` or in a `printf` format: they go in `data/` (`CONTENT.md`), so Yonatan can
  change the text without the design. `npm run check:template-copy` (in `check:static`) fails on words outside `{{ }}`
  in `layouts/`; it allows arrows, `·`, punctuation, entities and one-character floor badges

## Adding Content

### New blog post
Create `content/blog/post-slug.md` with:
```yaml
---
title: "Post Title"
date: YYYY-MM-DDT00:00:00+01:00
draft: false
type: "blog"
tags: [kotlin, spring-boot]
images:
  featured_image: "/images/blog/covers/post-slug.jpg"
coverFocus: 54
---
```
Optional `coverAlt: "…"` says what the cover shows, for its share card's `og:image:alt` and `twitter:image:alt`; without
it they read "Cover image of <title>" (`cover` in `data/art.yaml`). The cover on the post itself stays decorative (`alt=""`).
Optional `discuss: {linkedin: <url>, x: <url>}` points the post's "Discuss this post" line at the thread where it was
shared; without it the line links to the LinkedIn and X profiles.

A Mermaid diagram needs a text alternative on its fence, ```` ```mermaid {title="…" desc="…"} ````: the title names it
(unique on the page) and the description says what it shows, one line each with no semicolon; the build fails without them.
They become the SVG's `<title>` and `<desc>`. The fence starts at the line's beginning (not indented in a list), so the
diagram script finds it.

Every post needs a cover, `images.featured_image` (the build fails without it): a 1024x576 painting in `static/images/blog/covers/`, made with `web3d/pixel/paint_covers.py` in the Library's painterly
style (its `STYLE`: soft glowing light, deep cosy shadows, soft painted edges, wild nature with no buildings), on the rooms'
model, pinned with every job (`PINNED` in `paint_rooms.py`). It also needs its pixel-art version, a lossless WebP in
`static/images/blog/covers/pixel/<slug>.webp`, which the blog shows: 960x540, baked from the painting by `pixelate.py` the way the city and the Library are (a 3px median against the JPEG's noise, a BOX
downscale, 64 colours of its own by median cut, no dither), so an art pixel is about 1.5 screen px across a 1440 screen, the finest the paintings allow. The build fails with the
`pixelate.py` command to make it, and `paint_covers.py --install` rebakes them all. A touch-up in code (`TOUCH_UPS`, none now) works on the painting and goes
into the .jpg, so the bake never repeats it; one is written for its painting's pixels, so a repaint drops or redoes it. A pick can also be the model's
img2img edit of a candidate (`EDITS`, painted with `--edit`; the real-life cover's stray crane taken out, and the spinning
spiral's outer turns), named `<seed>-e<edit seed>` in `COVERS` or `INLINE`.
The post shows it across the page behind its head, about 40 of its 108ths of height on a wide screen: `coverFocus`, from 25 to 78 in 108ths (default 54; the rows of the old covers),
picks the height to centre on, and a phone shows all of it. The Library's list and a post's "Keep reading" show it at 192px, from the cover box-reduced by Hugo to lossless WebPs at 192, 384 and 576 for 1x to
3x screens (`partials/blog-art.html`), so the browser never shrinks pixel art.

Art inside a post goes in `static/images/blog/pixel/` as lossless WebP, painted from `INLINE` in `paint_covers.py` and baked by `--install-inline` at 576x324, the article column's width at 1:1 (192px on a
phone). It gets no resized sizes (`render-image.html`), which would smear it; its touch-ups work on the painting, before the bake.

### New project
Create `content/projects/name.md` with a `link` and a `group` of `app`, `library`, `game` or `contribution`, which picks its workshop on `/projects/` (the build fails without either, in `partials/check-projects.html`; a new group needs a workshop in the painting and an entry in `workshop.groups` in `data/rooms.yaml`). Its place in the workshop is its `weight`, lowest first. The entry links to its case study with `caseStudy: true`, else to `link` under `params.button.btnText`. Set `archived: true` once the repository is archived: the project stays listed, with an "Archived" label on `/projects/` and its case study, and "(archived)" after its name in `llms.txt`.

### New experience
Create `content/experience/name.md` with `jobTitle`, `company`, `location`, `duration`, `summary`, and:
- `floor`: a quoted storey, such as `floor: "5"`, that no other entry uses. Floors 2 to 7 are the roles;
  `1`, `R` and `L` are taken by the template, and `P` is the CV's colour for open source. A new storey (a single
  character: `8`, `9`) needs its room: its painting (`ROOMS` in `web3d/pixel/paint_rooms.py`, picked into `PICKS` in
  `install_picks.py`), and in `web3d/pixel/gen_floors.py` its entry in `FLOORS` (its accent, which goes into
  `data/floor_accents.yaml`, its animation, its lamps and its right skirting's row). Then rebuild all the art (`npm run art`): the lift's order
  (`ORDER` in `web3d/src/art.js`) comes from `floors.json`.
- `highlights`: a list; the first three show on the floor's card, the rest inside it.

`layouts/index.html` fails the build naming the file when `floor` or `highlights` is wrong.

## Images

- Profile photo: `assets/images/showcase/`
- Testimonial photos: `assets/images/testimonials/`
- Blog images: `static/images/blog/`
- All blog images are stored locally — no external CDN dependencies

## Analytics

- **GoatCounter** for privacy-friendly analytics (script in `layouts/partials/head.html`, pinned to `count.v5.js` with the SRI hash from goatcounter.com/help/countjs-versions; a new version means a new URL and hash)
- Dashboard: `https://yonatankarp.goatcounter.com`
- Localhost and private IPs are automatically excluded
- To exclude your own visits from a browser, visit `https://yonatankarp.com#toggle-goatcounter` (sets a localStorage flag, built into the script)
- Events (dashboard, Events): `cv-download` (the top bar's Download CV, the city's Post Office and the Post Office's CV parcel), `social-<icon>` (its social icons and the footer's: `social-linkedin`, `social-github`,
  `social-x`, `social-podcast`; the Post Office's stamps send the first three, its podcast stamp leads to `/podcast/`), `email` (a mailto on the homepage, the CV, the Post Office or the footer),
  `email-copy` (the Copy chip beside it), `discuss-linkedin` / `discuss-x` (a post's Discuss line), `author-cv` / `author-roof` (the author box's links under a post), `roof-post` (the roof's Get in touch, to `/contact/`), `podcast-radio` (the Radio Mast's Listen button),
  `district-<key>` (the city panel's go link, and a map label's second click, which leads in; its first only zooms: `district-tower`, `district-library`, `district-workshop`, `district-radio`,
  `district-post`), `current-role` (the city panel's Current role, straight to the newest role's floor) — all `data-goatcounter-click`; `topic-<tag>` (a topic chip picked on the blog's index, `topic-all` for All, sent by `assets/js/library.js`); `workshop-<group>` (a workshop picked on Workshop Row, by its
  label or chip, sent by `web3d/src/workshop.js`, as count.js may bind before the buttons exist: `workshop-app`, `workshop-library`, `workshop-game`, `workshop-contribution`); `floor-<key>` (the first time a visit's ride
  reaches a floor, e.g. `floor-5`, `floor-R`; the load's own floor is not counted; there is no `floor-E` or `floor-P`:
  the way back out to the city is a page view of `/`)
  and `step-in-<key>` (each Step inside), both from `web3d/src/guide.js`. A 404 counts as `404/<path>`.

## Deployment

Push to `main` triggers GitHub Actions workflow (`.github/workflows/deploy.yml`) which builds Hugo and deploys to GitHub Pages; it also runs weekly, so the career's years (`partials/career-years.html`, in the city's panel and the CV) never go stale.

CI, the deploy and the weekly link check share `.github/actions/build-site`, which runs `npm run check:static`;
CI and the deploy then run `npm run check:csp`, which also fails on axe's serious and critical findings, and on any of
the site's own requests answered with 400 or more but the 404 route's own page, so a missing scene or prop file fails
it (the scenes forgive only a failed fetch: a file that cannot be read, or a setup that throws, is a page error). CI captures
the visual smoke screenshots from the built `public/` (`scripts/capture-screenshots.js`: every route pins its hour,
`season=autumn` and, on the homepage, `holiday=none`, but `city-winter`, a winter night with Hanukkah and Christmas; under
reduced motion, with CSS animations disabled, so they hold still) and compares them, without failing, with the last deploy's,
which the deploy's `visual_capture` job takes from the Pages artifact beside the `deploy` job, never holding it up.
Node's version is `.nvmrc`.

The `Cross-browser` workflow (not a required check; run by hand, and on a pull request that changes it or
`scripts/check-cross-browser.js`) loads the main routes in Firefox and WebKit at 1440 and 390, failing on page errors,
console errors and the site's own failed requests, and tries Whole city's focus, the tower's arrow keys and a lift ride
(`npm run check:cross-browser`; Firefox runs only there, as it does not launch on macOS 27).

Hugo is pinned once, as `HUGO_VERSION` and `HUGO_SHA256` in `.github/hugo.env`. Bump both values together:
`HUGO_SHA256` is the `hugo_extended_<version>_linux-amd64.deb` line of the release's `hugo_<version>_checksums.txt`,
and the install step fails when it does not match. The weekly `Pin staleness` workflow reports a stale pin and fails
on a wrong checksum (`npm run check:hugo-pin` runs the same check locally); nothing else watches that pin. The same
workflow warns within 60 days of `Expires` in `static/.well-known/security.txt` and fails once it has passed
(`npm run check:security-txt`). For local
builds, put the same Hugo release at `.tools/hugo/hugo` (gitignored), which the npm scripts prefer over `hugo` on
the `PATH`; they warn when the Hugo they run is not the pinned version.

The weekly `External links` workflow runs `npm run check:links:external` and keeps one `external-links` issue open
while a link is broken. Rate limits and bot walls (HTTP 429, 503, 999) are warnings, not failures.
