# Personal Website - yonatankarp.github.io

## Stack

- **Hugo** static site generator (v0.169.0, pinned as `HUGO_VERSION` in `.github/hugo.env`; see Deployment)
- **Custom Hugo layouts** in `layouts/`
- **GitHub Actions** for CI/CD to GitHub Pages
- Site styles in `assets/css/custom.css`
- Custom JS in `assets/js/site.js`
- Pixel skin is `.px-skin` in `assets/css/custom.css`; the top bar is `layouts/partials/pixel-bar.html`
- Static images and icons in `static/images/`

## Build & Run

```bash
npm run serve            # dev server (builds the pixel building bundle, then hugo server)
npm run build            # production build: bundle, hugo --gc --minify, then the CV PDF
npm run check            # the build plus every check of the built site
npm test                 # node:test tests of the scripts (scripts/test/)
npm run lint             # ESLint, and Ruff over web3d/pixel/ (needs uv)
```

Scripts share their helpers through `scripts/lib.js`. CI also rebuilds the art and fails unless it matches the committed
files pixel for pixel (`web3d/pixel/compare_art.py`).

The homepage (`layouts/index.html`) opens on the city: an aerial pixel-art panorama (`web3d/src/city.js`, `city.css`)
that zooms into five districts, picked from a label or a chip in its panel: the Career Tower, the
Library (`/blog/`), Workshop Row (`/projects/`), the Radio Mast (`/podcast/`) and the Post Office (`/contact/`). The
map moves by one transform (translate and scale, never scrolling), clamped so no edge of the art shows; a wheel, a
trackpad or a finger pans it sideways at any zoom. The same chip again, or "Whole city", zooms back out. A label's first
click zooms to its district; the picked label then shows "→" and its next click goes in. Its
copy is `city` in `data/home/en.yaml`; the counts are Hugo's. Its art is `city[-PHASE].webp`, baked by
`web3d/pixel/gen_city.py` from `web3d/pixel/paintings/picks/city[-PHASE].png` (Draw Things paintings, the other hours edited from the dusk
one), which also writes `city.json`, the labels' anchors the template reads and each district's zoom (its building's
middle in % of the art, and how far to zoom: `ZOOM`), capped where an art pixel would pass `MAX_PX` (4) screen px,
so a big screen zooms less than a phone, and never under 1. The Career Tower is the pixel-art career
building, entered at its lobby: any `#floor-X` address opens it directly, and pixel.js mounts it only then; back
at the bare address (or `#city`, the name plate and the lobby's sign) the page reloads on the city. It is the career
only: every other topic has its building in the city. The old street's `#floor-E` lands in the lobby (`web3d/src/hash.js`),
and the old garage's `#floor-P` and `#client-and-work-section` go to `/projects/` (the pre-paint script in `layouts/index.html`).

The blog's index (`layouts/blog/list.html`) is the city's Library: its reading room across the head (`library.webp`, baked
by `web3d/pixel/gen_library.py` from `web3d/pixel/paintings/picks/library.png`, one painting at dusk), then every listed
post as a card (`partials/blog-row.html`). A chip for every tag the listed posts carry filters the list, with the search
box (`assets/js/library.js`): the curated topics and labels in `data/library.yaml` first (a tag no listed post carries is
skipped, one with no tag page fails the build), then the rest, most posts first (ties by name). Without a script the
chips are links to the tag pages and the search box a form to `/search/`.

The projects' index (`layouts/projects/list.html`) is the city's Workshop Row: a street of four brick workshops, one per
project `group` (apps, libraries, games, contributions, in that order), that pans sideways by scrolling
(`web3d/src/pan.js`) and opens on Apps; `workshop.js` slides each label to stay whole on screen. Its script and styles
are a bundle of their own, `assets/building/workshop.*` (`vite build --mode workshop`). Each workshop lists its projects
by `weight`; without a script every workshop's list shows. Its art follows the clock like the city:
`workshop[-PHASE].webp`, baked by `web3d/pixel/gen_workshop.py` from `paintings/picks/workshop[-PHASE].png` (dusk painted,
the other hours edited from it), with `workshop.json`, the labels' anchors. The page is standalone (no baseof) so the
inline script that swaps in the hour's painting is in `.Store "bodyScripts"`, which `head.html` allows by its hash. The homepage's script and styles live in
`web3d/src/` and are bundled by Vite into `assets/building/` (gitignored), so plain `hugo` fails until
`npm run build:building` has run. That script also draws every Mermaid fence in `content/` to SVG with the `mermaid`
package in Playwright's Chromium (`scripts/render-diagrams.js`, into the gitignored `assets/diagrams/<sha256>.svg`), which
`render-codeblock-mermaid.html` inlines, so posts ship no Mermaid JS; `assets/js/diagram-zoom.js` adds the Zoom in. The
hook fails the build when a diagram changed since it was drawn: rerun `node scripts/render-diagrams.js` (also during
`npm run serve`). The art is in `static/building/pixel/`, made by the Python pipeline in
`web3d/pixel/` (Draw Things paintings, pixelated and animated in code). Each experience entry's `floor`
front matter places it in the building; testimonials need a `pullQuote` that is an exact excerpt.

The building's art follows the real sun where the visitor is: their time zone's main city (`data/timezones.json`, Berlin
when unknown) gives the sun's elevation now, day above +6°, night at -8° or below, and dawn or dusk between, before or
after noon. It is picked once at load by the inline script in `layouts/index.html` (`html[data-time]`), from
`assets/js/time-pick.js` (tested in `scripts/test/time-pick.test.js`). `/?time=dawn|day|dusk|night` overrides it for
testing; anything else means the sun. Never pick by the hour: read `html[data-time]`. Dusk is the plain files. The rooms
that show outside have a painting at each other hour, an edit of the dusk pick that changes only the light
(`paint_rooms.py retime`): the roof whole, the lobby only through its glass door. `gen_floors.py` bakes them into
`floor-{L,R}-NAME.webp`. The other pages' backdrop is a crop of the city at the hour (`backdrop[-NAME].webp`, written by
`gen_city.py build`), behind the sheet: the pick is `layouts/partials/time-pick.html`, shared by the homepage and
`head.html`, and `assets/css/custom.css` maps `html[data-time]` to the backdrop.
`data/phases.json` lists the phases (the sky above the roof, the baked rooms, how far a dark room falls), and
`web3d/src/art.js` and the scripts read it. To show a new phase, add it there, to that pick, to the backdrop rules in
`custom.css`, and paint the city, Workshop Row, the roof and the lobby's view at it: `npm run check:phases` (part of
`npm run check`) fails until those agree with `phases.json`, and `gen_floors.py` checks its baked rooms (the paintings
there are) and its sky (the roof strip's top row) on every run.

The seasonal, holiday and weather dressing is parked for a later pass: `web3d/src/outside.js` and `calendar.js` (tested in
`scripts/test/calendar.test.js`) still work out the visitor's season, holidays and country from `data/timezones.json`, but
nothing imports them.

The tower's art is 928x308 a room (painted at 2304x768, box-reduced and median-cut to 64 colours, no dither, like the
city), in a 960x360 strip with its slabs: `paint_rooms.py` paints (every room an edit of the lobby carried across, so the
wall, skirting and floor run on from the lift), `install_picks.py` bakes the picks (`PICKS`) and pastes the lobby's one
lift into each, and `gen_floors.py` draws the slabs, the floor number and what moves (each room's animation, which only
paints over what is there: lights, screens, a glint). A strip is its rest frame, two runs pixel.js tiles past it on a
wide screen, the lift's cab (`paint_rooms.py cab`, a painting of its own, which pixel.js shows behind the painted doors as
they slide apart), and its moving box's other frames. The numbers `web3d/src/` draws by (strip size, runs, each strip's moving
box, lift doors, dither, each room's lamps, the floors' order, floor 7's capsule, the lobby's receptionists and cats) are written into `static/building/pixel/floors.json` by
`gen_floors.py` and bundled from there, and `data/floor_accents.yaml` is written by it from `FLOORS`: change the Python,
rerun it, never the copies. `pixel.js` is the lift and the floors, `art.js` what it reads; it keeps only the storeys
round the lift's stop decoded (`KEEP`), so a phone holds about 50 MB of them at most. One thing moves live, not in the
strip's 12 frames: floor 7's payment, a painted pneumatic-post capsule (`picks/capsule.png`, on magenta, from
`paint_rooms.py capsule`; `gen_floors.py` keys it into `capsule.webp` at 4x). pixel.js turns and smooths it into the room's
own art pixels every frame, along `CAPSULE` (its path, size, ride and clip, in floors.json; the path and easing are
`web3d/src/capsule.js`), from the start of each loop, darkened with the room, and not while paused or held. The lobby's
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

The city's life (`web3d/src/city-fx.js`, imported by `city.js`) is drawn on a canvas at the art's own 1440x347 pixels,
laid over the city picture: walkers on the main street, the avenue and the plaza (fewer and dark at night), cars on the
main street and the ring road (headlights at dusk and night), windows going dark at night, glints on the bay, the radio
mast's beacon and the crane's lights, and flocks of birds. Movers hide behind what is nearer in `city-depth.png`
(brighter = nearer). `gen_city.py build` writes `city-fx.json` (the windows and the bay found in the baked art, and the
walks, plazas, lanes and lights in its `WALKS`, `PLAZAS`, `LANES` and `LIGHTS`) and copies `city-depth.png` from
`web3d/pixel/paintings/picks/`, which `uv run web3d/pixel/depth_map.py city` makes from the dusk pick (it needs torch, so
it is not part of the build: rerun it, and commit its output, when the dusk pick changes). Nothing moves under reduced
motion or with `?fx=off`, which the visual captures use; the loop stops while the tab is hidden, the city is off screen
or the tower is entered.

Workshop Row (`/projects/`) and the Library's header (`/blog/`) move the same way, sharing `web3d/src/scene-fx.js` (the
canvas loop, its pauses and the depth test) with the city. `workshop-fx.js`: walkers on the pavement, two cats on the left
wall, a welder's sparks, code on the screens and moths round the lamps (not by day), from `workshop-fx.json` and
`workshop-depth.png`, which `gen_workshop.py build` writes from its `FX` and the map `depth_map.py workshop` makes.
Its walkers are painted people: `web3d/pixel/gen_walkers.py` draws 8 walk-cycle poses from a skeleton (`pose`), Draw Things
repaints them as each of six people with one seed apiece (`paint`), and `bake` turns the picked frames in
`web3d/pixel/paintings/picks/walkers/NAME_K.png` into `walkers.webp` (a row per person, a frame per column) and
`walkers.json`, a person 60 art px tall (`PERSON`, against the street's ~100 px roller doors). A walker steps one frame
per `stride` / 8 px of ground, so its feet do not slide, at 0.71-0.97 strides a second, and stands on each frame's own
sole (`foot`, the lowest painted row the bake finds); 8 by day, 4 dimmed at night. They walk off either end of the
art (`edge`) and, 1-9 s later, someone comes on from either end in either lane; past the pavement's end (`pavement`'s
x1) their feet keep its depth, so they pass behind the parked van. Yonatan's two cats (`web3d/src/cats.js`, tested in
`scripts/test/cats.test.js`) walk, sit and loaf on the wall's top (`wall`), turning back when they meet, and now and
then leap down to the pavement (`street`), trot off either end and back, and leap up again; they are `cats.webp` and
`cats.json`, which `gen_walkers.py bake` makes from `picks/cats/NAME_POSE.png` (`cats` paints them: a walk, sit, loaf,
crouch and leap, `CAT` art px tall walking; the lobby's are `cats-lobby.webp`, above). The kerb lamp at x 245, painted dark at every hour, is lit by
`gen_workshop.py` (`relight`) at every hour but day. The
lamp posts in `workshop-depth.png` are stood up by `gen_workshop.py` (`upright`): the model fades their thin poles into the
wall as they rise, and a whole post must hide a walker passing behind it.
`library-fx.js`, its own bundle (`--mode library`): the fire, dust in the window's light and clouds only over the
window's sky, from `library-fx.json`, which `gen_library.py build` writes from its `FX` and the sky it reads off the art.
Three readers walk its floor, each its own way (`web3d/src/readers.js`, tested on a seed in `scripts/test/readers.test.js`):
walking past and out of the room, stopping to look, or taking a book to read, facing either way, never two at one shelf, and none stopping within `gap` of another (they start that far apart too).
The floor line (on the lit parquet, behind the reading tables), the shelves, the gap, their speed, pace, weights and times are `FX["readers"]`. They are `readers.webp` and `readers.json`, which `gen_walkers.py bake` makes from
the walkers' frames and four browse poses (`browse` paints them; picks `NAME_browse_KIND.png`), 135 px tall, each on a soft
contact shadow. Only the reading lamps, the tables, the armchairs and the globe in front hide them: `gen_library.py`
pushes everything else in `depth_map.py library`'s map back to 0 down to the shadows' rows (`backdrop`), as the model reads
books and the wall's seams as nearer than the floor, so `library-fx.js` tests them from depth 0.
`rooms-fx.js`, its own bundle (`--mode rooms`): the Radio Mast's on-air lamp, tape reels, VU needles and the mast's
beacon, and the Post Office's clock (the visitor's real seconds), lamps and dust, from `radio-fx.json` and `post-fx.json`
(`FX` in `gen_rooms.py`).

## Content Structure

- `content/experience/` — job entries (one .md per role)
- `content/education/` — education entries
- `content/projects/` — projects listed on `/projects/` (Workshop Row)
- `content/blog/` — blog posts
- `content/testimonial/` — recommendation quotes with photos
- Experience, education and testimonial entries have no pages of their own: the `[[cascade]]` in `hugo.toml` renders
  them with `layouts/_default/redirect.html`, a noindex redirect to their homepage floor
- `content/skills/_index.md` — skills page
- `content/cv.md` — printable CV page
- `content/podcast.md` and `content/contact.md` — the Radio Mast (`/podcast/`, `layouts/_default/radio.html`) and the Post
  Office (`/contact/`, `post.html`). Each opens on its room, painted across the head at its own 1440:347 shape
  (`partials/room-hero.html`; a phone pans it): `radio.webp` and `post.webp`, baked by `web3d/pixel/gen_rooms.py` from
  `web3d/pixel/paintings/picks/{radio,post}.png` (one painting each, at dusk), with `ROOM-fx.json` for their animations
  (`web3d/src/rooms-fx.js`, its own bundle, `--mode rooms`). Their copy is `contact` in `data/home/en.yaml`. The Post
  Office's letter is ruled: every line sits 21px into a 30px row, and the visual captures fail when one does not

## Languages

The site is English-only. Do not create `.he.md` variants, translation keys, language switchers, or i18n files unless Yonatan explicitly restarts bilingual support.

## Layout Rules

- Prefer editing the custom templates in `layouts/` directly instead of introducing third-party theme assumptions
- Keep the design system centralized in `assets/css/custom.css`
- Use `assets/js/site.js` for the small amount of client-side behavior

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
Optional `discuss: {linkedin: <url>, x: <url>}` points the post's "Discuss this post" line at the thread where it was
shared; without it the line links to the LinkedIn and X profiles.

A Mermaid diagram needs a text alternative on its fence, ```` ```mermaid {title="…" desc="…"} ````: the title names it
(unique on the page) and the description says what it shows, one line each with no semicolon; the build fails without them.
They become the SVG's `<title>` and `<desc>`. The fence starts at the line's beginning (not indented in a list), so the
diagram script finds it.

Every post needs a cover, `images.featured_image` (the build fails without it): a 1024x576 painting in `static/images/blog/covers/`, made with `web3d/pixel/paint_covers.py`. It also needs its pixel-art version in
`static/images/blog/covers/pixel/`, which the blog shows: 960x540, baked from the painting by `pixelate.py` the way the city and the Library are (a 3px median against the JPEG's noise, a BOX
downscale, 64 colours of its own by median cut, no dither), so an art pixel is about 1.5 screen px across a 1440 screen, the finest the paintings allow. The build fails with the
`pixelate.py` command to make it, and `paint_covers.py --install` rebakes the ten with paintings. Five covers touched up in code (break-hashmap, concurrency, redistemplate, real-life, twitter-bot)
have no painting left: theirs are 5x copies of the old 192x108 art until they are repainted.
The post shows it across the page behind its head, about 40 of its 108ths of height on a wide screen: `coverFocus`, from 25 to 78 in 108ths (default 54; the rows of the old covers),
picks the height to centre on, and a phone shows all of it. The Library's list and a post's "Keep reading" show it at 192px, from the cover box-reduced by Hugo to 192, 384 and 576 for 1x to
3x screens (`partials/blog-art.html`), so the browser never shrinks pixel art.

Art inside a post goes in `static/images/blog/pixel/`, painted from `INLINE` in `paint_covers.py` and baked by `--install-inline` at 576x324, the article column's width at 1:1 (192px on a
phone). It gets no webp sizes (`render-image.html`), which would smear it; its touch-ups work on the painting, before the bake.

### New project
Create `content/projects/name.md` with a `link` and a `group` of `app`, `library`, `game` or `contribution`, which picks its workshop on `/projects/` (the build fails without either; a new group needs a workshop in the painting). Its place in the workshop is its `weight`, lowest first. The entry links to its case study with `caseStudy: true`, else to `link` under `params.button.btnText`. Set `archived: true` once the repository is archived: the project stays listed, with an "Archived" label on `/projects/` and its case study, and "(archived)" after its name in `llms.txt`.

### New experience
Create `content/experience/name.md` with `jobTitle`, `company`, `location`, `duration`, `summary`, and:
- `floor`: a quoted storey, such as `floor: "5"`, that no other entry uses. Floors 2 to 7 are the roles;
  `1`, `R` and `L` are taken by the template, and `P` is the CV's colour for open source. A new storey (a single
  character: `8`, `9`) needs its room: its painting (`ROOMS` in `web3d/pixel/paint_rooms.py`, picked into `PICKS` in
  `install_picks.py`), and in `web3d/pixel/gen_floors.py` its entry in `FLOORS` (its accent, which goes into
  `data/floor_accents.yaml`, its animation and its lamps). Then rebuild all the art, as CI does: the lift's order
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
- Events (dashboard, Events): `cv-download` (the top bar's Download CV, the city's Post Office and the Post Office's CV parcel), `social-<icon>` (its social icons, and the Post Office's stamps:
  `social-linkedin`, `social-github`, `social-x`, `social-podcast`), `email` (a mailto on the homepage, the CV, the Post Office or the footer),
  `email-copy` (the Copy chip beside it), `discuss-linkedin` / `discuss-x` (a post's Discuss line), `author-cv` / `author-roof` (the author box's links under a post), `roof-post` (the roof's Get in touch, to `/contact/`), `podcast-radio` (the Radio Mast's Listen button),
  `district-<key>` (the city panel's go link, and a map label's second click, which leads in; its first only zooms: `district-tower`, `district-library`, `district-workshop`, `district-radio`,
  `district-post`) — all `data-goatcounter-click`; `topic-<tag>` (a topic chip picked on the blog's index, `topic-all` for All, sent by `assets/js/library.js`); `workshop-<group>` (a workshop picked on Workshop Row, by its
  label or chip, a `data-goatcounter-click`: `workshop-app`, `workshop-library`, `workshop-game`, `workshop-contribution`); `floor-<key>` (the first time a visit's ride
  reaches a floor, e.g. `floor-5`, `floor-R`; the load's own floor is not counted; there is no `floor-E` or `floor-P`:
  the way back out to the city is a page view of `/`)
  and `step-in-<key>` (each Step inside), both from `web3d/src/guide.js`. A 404 counts as `404/<path>`.

## Deployment

Push to `main` triggers GitHub Actions workflow (`.github/workflows/deploy.yml`) which builds Hugo and deploys to GitHub Pages.

CI, the deploy and the weekly link check share `.github/actions/build-site`, which runs `npm run check:static`;
CI and the deploy then run `npm run check:csp`, which also fails on axe's serious and critical findings. CI captures
the visual smoke screenshots from the built `public/` and compares them, without failing, with the last deploy's,
which the deploy's `visual_capture` job takes from the Pages artifact beside the `deploy` job, never holding it up.
Node's version is `.nvmrc`.

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
