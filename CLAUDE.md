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

The homepage (`layouts/index.html`) is the pixel-art career building. Its script and styles live in
`web3d/src/` and are bundled by Vite into `assets/building/` (gitignored), so plain `hugo` fails until
`npm run build:building` has run. That script also copies Mermaid's ESM build from `node_modules` into
`static/vendor/mermaid-<version>/` (gitignored, `scripts/vendor-mermaid.js`), which `assets/js/mermaid-loader.js`
imports on posts with a diagram, at the version `layouts/_default/baseof.html` reads from `package.json`. The art is in `static/building/pixel/`, made by the Python pipeline in
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

The art's numbers that `web3d/src/` draws by (strip size, lift doors, dither, each room's lamps, where each window looks
in, the street's geometry) are written into `static/building/pixel/exterior.json` by `gen_exterior.py` (`json OUT` writes
only that file) and bundled from there, and `data/floor_accents.yaml` is written by `gen_floors.py` from `FLOORS`: change
the Python, rerun it, never the copies. `pixel.js` is the lift and the floors, `street.js` the street view and its
flights, `art.js` what they share.

## Content Structure

- `content/experience/` — job entries (one .md per role)
- `content/education/` — education entries
- `content/projects/` — projects listed on the homepage's Parking floor and on `/projects/`
- `content/contributions/` — NOT used (contributions are in projects/)
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
---
```
Optional `discuss: {linkedin: <url>, x: <url>}` points the post's "Discuss this post" line at the thread where it was
shared; without it the line links to the LinkedIn and X profiles.

A Mermaid diagram needs a text alternative on its fence, ```` ```mermaid {title="…" desc="…"} ````: the title names it
(unique on the page) and the description says what it shows, one line each with no semicolon; the build fails without them.

A cover (`images.featured_image`, a painting in `static/images/blog/covers/`, made with `web3d/pixel/paint_covers.py`) also needs its pixel-art version in
`static/images/blog/covers/pixel/`, which the blog shows; the build fails with the `pixelate.py` command to make it.

### New project
Create `content/projects/name.md` with a `link` and a `group` of `app`, `library`, `game` or `contribution`, which picks its section on `/projects/` (the build fails without either). Projects render via the custom homepage project list and can expose their CTA through `params.button`. Set `archived: true` once the repository is archived: the project stays listed, with an "Archived" label on `/projects/`, its case study and the homepage's Parking floor, and "(archived)" after its name in the Parking card and `llms.txt`.

### New experience
Create `content/experience/name.md` with `jobTitle`, `company`, `location`, `duration`, `summary`, and:
- `floor`: a quoted storey, such as `floor: "5"`, that no other entry uses. Floors 2 to 7 are the roles;
  `1`, `R`, `L`, `P` and `E` are taken by the template. A new storey needs art: its entry in `FLOORS` in
  `web3d/pixel/gen_floors.py` (which writes its colour into `data/floor_accents.yaml`), a place in `ORDER` in
  `web3d/src/art.js`, and its painting in `web3d/pixel/`.
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
- Events (dashboard, Events): `cv-download` (the top bar's Download CV), `social-<icon>` (its social icons:
  `social-linkedin`, `social-github`, `social-x`, `social-podcast`), `email` (a mailto on the homepage or the CV),
  `email-copy` (the Copy chip beside it), `discuss-linkedin` / `discuss-x` (a post's Discuss line), `podcast-roof` (the roof's podcast links) — all `data-goatcounter-click`; `floor-<key>` (the first time a visit's ride
  reaches a floor, e.g. `floor-5`, `floor-R`, `floor-E` for back on the street; the load's own floor is not counted)
  and `step-in-<key>` (each Step inside), both from `web3d/src/guide.js`. A 404 counts as `404/<path>`.

## Deployment

Push to `main` triggers GitHub Actions workflow (`.github/workflows/deploy.yml`) which builds Hugo and deploys to GitHub Pages.

CI, the deploy and the weekly link check share `.github/actions/build-site`, which runs `npm run check:static`;
the workflows then run `npm run check:csp`, which also fails on axe's serious and critical findings. CI captures
the visual smoke screenshots from the built `public/` and compares them, without failing, with the last deploy's.
Node's version is `.nvmrc`.

Hugo is pinned once, as `HUGO_VERSION` and `HUGO_SHA256` in `.github/hugo.env`. Bump both values together:
`HUGO_SHA256` is the `hugo_extended_<version>_linux-amd64.deb` line of the release's `hugo_<version>_checksums.txt`,
and the install step fails when it does not match. The weekly `Pin staleness` workflow reports a stale pin and fails
on a wrong checksum (`npm run check:hugo-pin` runs the same check locally); nothing else watches that pin. For local
builds, put the same Hugo release at `.tools/hugo/hugo` (gitignored), which the npm scripts prefer over `hugo` on
the `PATH`; they warn when the Hugo they run is not the pinned version.

The weekly `External links` workflow runs `npm run check:links:external` and keeps one `external-links` issue open
while a link is broken. Rate limits and bot walls (HTTP 429, 503, 999) are warnings, not failures.
