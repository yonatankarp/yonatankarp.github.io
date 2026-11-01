# Personal Website - yonatankarp.github.io

## Stack

- **Hugo** static site generator (v0.169.0, pinned as `HUGO_VERSION` in the workflows; see Deployment)
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
```

The homepage (`layouts/index.html`) is the pixel-art career building. Its script and styles live in
`web3d/src/` and are bundled by Vite into `assets/building/` (gitignored), so plain `hugo` fails until
`npm run build:building` has run. The art is in `static/building/pixel/`, made by the Python pipeline in
`web3d/pixel/` (Draw Things paintings, pixelated and animated in code). Each experience entry's `floor`
front matter places it in the building; testimonials need a `pullQuote` that is an exact excerpt.

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
A cover (`images.featured_image`, a photo in `static/images/blog/covers/`) also needs its pixel-art version in
`static/images/blog/covers/pixel/`, which the blog shows; the build fails with the `pixelate.py` command to make it.

### New project
Create `content/projects/name.md` with a `link` (the build fails without one). Projects render via the custom homepage project list and can expose their CTA through `params.button`.

### New experience
Create `content/experience/name.md` with `jobTitle`, `company`, `location`, `duration`, `summary`, and:
- `floor`: a quoted storey, such as `floor: "5"`, that no other entry uses. Floors 2 to 7 are the roles;
  `1`, `R`, `L`, `P` and `E` are taken by the template. A new storey needs art: a key in
  `data/floor_accents.yaml`, a place in `ORDER` in `web3d/src/pixel.js`, and its painting in `web3d/pixel/`.
- `highlights`: a list; the first three show on the floor's card, the rest inside it.

`layouts/index.html` fails the build naming the file when `floor` or `highlights` is wrong.

## Images

- Profile photo: `assets/images/showcase/`
- Testimonial photos: `assets/images/testimonials/`
- Blog images: `static/images/blog/`
- All blog images are stored locally — no external CDN dependencies

## Analytics

- **GoatCounter** for privacy-friendly analytics (script in `layouts/partials/head.html`)
- Dashboard: `https://yonatankarp.goatcounter.com`
- Localhost and private IPs are automatically excluded
- To exclude your own visits from a browser, visit `https://yonatankarp.com#toggle-goatcounter` (sets a localStorage flag, built into `count.js`)
- Events (dashboard, Events): `cv-download` (the top bar's Download CV), `social-<icon>` (its social icons:
  `social-linkedin`, `social-github`, `social-x`, `social-podcast`), `email` (a mailto on the homepage or the CV),
  `email-copy` (the Copy chip beside it) — all `data-goatcounter-click`; `floor-<key>` (the first time a visit's ride
  reaches a floor, e.g. `floor-5`, `floor-R`, `floor-E` for back on the street; the load's own floor is not counted)
  and `step-in-<key>` (each Step inside), both from `web3d/src/guide.js`. A 404 counts as `404/<path>`.

## Deployment

Push to `main` triggers GitHub Actions workflow (`.github/workflows/deploy.yml`) which builds Hugo and deploys to GitHub Pages.

Hugo is pinned twice, as `HUGO_VERSION` and `HUGO_SHA256` in both
`.github/workflows/ci.yml` and `.github/workflows/deploy.yml`. Bump both values
together, in both files: `HUGO_SHA256` is the `hugo_extended_<version>_linux-amd64.deb`
line of the release's `hugo_<version>_checksums.txt`, and the install step fails
when it does not match. The weekly `Pin staleness` workflow reports a stale or
disagreeing pin and fails on a wrong checksum (`npm run check:hugo-pin` runs the
same check locally); nothing else watches that pin. For local builds, put the same
Hugo release at `.tools/hugo/hugo` (gitignored), which the npm scripts prefer over
`hugo` on the `PATH`.
