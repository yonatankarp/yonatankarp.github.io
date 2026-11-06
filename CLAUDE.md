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

The homepage (`layouts/index.html`) opens on the city: an aerial pixel-art panorama that pans sideways
(`web3d/src/city.js`, `city.css`) to five districts, picked from a label or a chip in its panel: the Career Tower, the
Library (`/blog/`), Workshop Row (`/projects/`), the Radio Mast (the podcast) and the Post Office (email and the CV). Its
copy is `city` in `data/home/en.yaml`; the counts are Hugo's. Its art is `city[-PHASE].webp`, baked by
`web3d/pixel/gen_city.py` from `web3d/pixel/paintings/picks/city[-PHASE].png` (Draw Things paintings, the other hours edited from the dusk
one), which also writes `city.json`, the labels' anchors the template reads. The Career Tower is the pixel-art career
building: any `#floor-X` address (`/#floor-E` is its street) opens it directly, and pixel.js mounts it only then; back
at the bare address the page reloads on the city.

The blog's index (`layouts/blog/list.html`) is the city's Library: its reading room across the head (`library.webp`, baked
by `web3d/pixel/gen_library.py` from `web3d/pixel/paintings/picks/library.png`, one painting at dusk), then every listed
post as a card (`partials/blog-row.html`). A chip for every tag the listed posts carry filters the list, with the search
box (`assets/js/library.js`): the curated topics and labels in `data/library.yaml` first (a tag no listed post carries is
skipped, one with no tag page fails the build), then the rest, most posts first (ties by name). Without a script the
chips are links to the tag pages and the search box a form to `/search/`. The homepage's script and styles live in
`web3d/src/` and are bundled by Vite into `assets/building/` (gitignored), so plain `hugo` fails until
`npm run build:building` has run. That script also draws every Mermaid fence in `content/` to SVG with the `mermaid`
package in Playwright's Chromium (`scripts/render-diagrams.js`, into the gitignored `assets/diagrams/<sha256>.svg`), which
`render-codeblock-mermaid.html` inlines, so posts ship no Mermaid JS; `assets/js/diagram-zoom.js` adds the Zoom in. The
hook fails the build when a diagram changed since it was drawn: rerun `node scripts/render-diagrams.js` (also during
`npm run serve`). The art is in `static/building/pixel/`, made by the Python pipeline in
`web3d/pixel/` (Draw Things paintings, pixelated and animated in code). Each experience entry's `floor`
front matter places it in the building; testimonials need a `pullQuote` that is an exact excerpt.

The building's art follows the visitor's local clock: dawn 06:00-07:59, day 08:00-17:59, dusk 18:00-19:59, night
20:00-05:59, picked once at load by the inline script in `layouts/index.html` (`html[data-time]`). `/?time=dawn|day|dusk|night`
overrides it for testing; anything else means the clock. Dusk is the plain files; a variant is one more entry in
`PHASES` in `web3d/pixel/gen_floors.py`, baked with `uv run web3d/pixel/gen_exterior.py build static/building/pixel --time NAME`
into `exterior-NAME.webp`, `floor-{R,P,L}-NAME.webp` (only those rooms show outside) and `backdrop-NAME.webp`, the street
without the tower behind every other page. The pick is `layouts/partials/time-pick.html`, shared by the homepage and
`head.html`, so the other pages follow the same clock: `assets/css/custom.css` maps `html[data-time]` to the backdrop.
`data/phases.json` lists the phases (start hour, the sky above the roof, the baked rooms, how far a dark room falls), and
`web3d/src/art.js` and the scripts read it. To show a new phase, add it there, to that pick, to the street's sky in
`web3d/src/pixel.css` and to the backdrop rules in `custom.css`: `npm run check:phases` (part of `npm run check`) fails
until those agree with `phases.json`, and `gen_floors.py` checks `phases.json` against its `PHASES` on every run.

The street is also dressed for the visitor's season, holidays and weather, drawn in code over the baked art (no new
art per season): `web3d/src/outside.js` works out what is going on, `web3d/src/decor.js` draws it (two pavement trees
that follow the season, snow on the roofs in a cold winter, and rain, snow, fog or clouds, which fall on the roof's
strip too). The holidays dress the street, never the tower, whose signs stay clear: strings of lights between the lamp
posts, the lamp posts, the pavement, the news stand's window and the neighbours' windows. The visitor is placed by their browser's timezone alone, through
`data/timezones.json` (country and main city per IANA zone, made from tzdata by `node scripts/gen-timezones.js`); an
unknown zone gets Berlin. Seasons flip south of the equator, and the tropics stay summer. Holidays are
`web3d/src/calendar.js`: the ones in `HOME` (Israel's and Germany's: Hanukkah, Sukkot, Christmas, Easter) show for
everyone, plus the new year, and the visitor's country adds its own (Halloween, Diwali, Lunar New Year, both Eids).
Jewish, Chinese and Islamic dates come from the browser's `Intl` calendars; Diwali is the `DIWALI` table, and
`npm test` fails once it no longer covers next year. The weather is the site's one call to a third party besides
GoatCounter: Open-Meteo, from the homepage only (its `connect-src` in `head.html`), at most once an hour per browser
session, after load. If it fails, the street just goes without weather. `?season=`, `?weather=clear|cloudy|fog|rain|snow`
and `?holiday=none` or a list such as `hanukkah:3,christmas` (the number is the day, from 0) pin each one, like
`?time=`. The visual captures pin a plain summer's day, plus one dressed capture. `npm run check:csp` answers the weather
call itself.

The art's numbers that `web3d/src/` draws by (strip size, lift doors, dither, each room's lamps, where each window looks
in, the street's geometry) are written into `static/building/pixel/exterior.json` by `gen_exterior.py` (`json OUT` writes
only that file) and bundled from there, and `data/floor_accents.yaml` is written by `gen_floors.py` from `FLOORS`: change
the Python, rerun it, never the copies. `pixel.js` is the lift and the floors, `street.js` the street view and its
flights, `art.js` what they share.

## Content Structure

- `content/experience/` — job entries (one .md per role)
- `content/education/` — education entries
- `content/projects/` — projects listed on the homepage's Parking floor and on `/projects/`
- `content/blog/` — blog posts
- `content/testimonial/` — recommendation quotes with photos
- Experience, education and testimonial entries have no pages of their own: the `[[cascade]]` in `hugo.toml` renders
  them with `layouts/_default/redirect.html`, a noindex redirect to their homepage floor
- `content/skills/_index.md` — skills page
- `content/cv.md` — printable CV page

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

Every post needs a cover, `images.featured_image` (the build fails without it): a painting in `static/images/blog/covers/`, made with `web3d/pixel/paint_covers.py`. It also needs its pixel-art version in
`static/images/blog/covers/pixel/`, which the blog shows; the build fails with the `pixelate.py` command to make it.
The post shows it across the page behind its head, about 40 of its 108 rows on a wide screen: `coverFocus`, a row from 25 to 78 (default 54), picks the one to centre on, and a phone shows all of it.

Art inside a post goes in `static/images/blog/pixel/`, painted from `INLINE` in `paint_covers.py` at the covers' 192x108, which keeps it crisp: anything wider than 480px would get smeared webp sizes.

### New project
Create `content/projects/name.md` with a `link` and a `group` of `app`, `library`, `game` or `contribution`, which picks its section on `/projects/` (the build fails without either). Projects render via the custom homepage project list and can expose their CTA through `params.button`. Set `archived: true` once the repository is archived: the project stays listed, with an "Archived" label on `/projects/`, its case study and the homepage's Parking floor, and "(archived)" after its name in the Parking card and `llms.txt`.

### New experience
Create `content/experience/name.md` with `jobTitle`, `company`, `location`, `duration`, `summary`, and:
- `floor`: a quoted storey, such as `floor: "5"`, that no other entry uses. Floors 2 to 7 are the roles;
  `1`, `R`, `L`, `P` and `E` are taken by the template. A new storey (a single character: `8`, `9`) needs its room:
  its painting in `web3d/pixel/`, and in `web3d/pixel/gen_floors.py` its entry in `FLOORS` (which writes its colour
  into `data/floor_accents.yaml`), `EDGES` and `SIGNS`, and in `gen_exterior.py` its `LOOK` (where its street window
  looks into its strip). Then rebuild all the art, as CI does. The street needs no repaint: `stack_tower()` in
  `gen_exterior.py` builds the tower from the painting's own storeys, and the lift's order (`ORDER` in
  `web3d/src/art.js`) comes from `exterior.json`. Past nine storeys above ground the street's picture grows taller at
  its top (`RISE`, also in `exterior.json`, which `web3d/src/` slides the street's rows by), so the street shows
  smaller: with two more floors, a 1920x1080 screen goes from 3x to 2x and a 1280x720 one from 2x to 1x (1440x900
  stays 2x).
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
- Events (dashboard, Events): `cv-download` (the top bar's Download CV, and the city's Post Office), `social-<icon>` (its social icons:
  `social-linkedin`, `social-github`, `social-x`, `social-podcast`), `email` (a mailto on the homepage, the CV or the footer),
  `email-copy` (the Copy chip beside it), `discuss-linkedin` / `discuss-x` (a post's Discuss line), `author-cv` / `author-roof` (the author box's links under a post), `podcast-roof` (the roof's podcast links),
  `district-<key>` (the city panel's go link: `district-tower`, `district-library`, `district-workshop`, `district-radio`,
  `district-post`) — all `data-goatcounter-click`; `topic-<tag>` (a topic chip picked on the blog's index, `topic-all` for All, sent by `assets/js/library.js`); `floor-<key>` (the first time a visit's ride
  reaches a floor, e.g. `floor-5`, `floor-R`, `floor-E` for back on the street; the load's own floor is not counted)
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
