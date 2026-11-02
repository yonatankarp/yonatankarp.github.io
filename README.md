# yonatankarp.github.io

Personal website and blog built with [Hugo](https://gohugo.io/). Fully custom English-only implementation.

## Quick Start

```bash
npm ci                            # install the build and check tools
npx playwright install chromium   # the browser that prints the CV PDF
npm run serve                     # dev server at http://localhost:1313: builds the pixel building bundle, then hugo server
npm run build                     # production build: bundle, hugo --gc --minify, then the CV PDF
npm run check                     # production build plus the generated-site checks
```

Requires Node 22+ (`.nvmrc`) and Hugo v0.169.0, the version pinned as `HUGO_VERSION` in `.github/hugo.env` (see Toolchain Pins).
The npm scripts use `.tools/hugo/hugo` when it exists, otherwise `hugo` on the `PATH`, and warn when that Hugo is not the pinned version.
`npm run check` also needs `pdfinfo` from poppler (`brew install poppler` on macOS), Playwright's Chromium (`npx playwright install chromium`) and the network: its last step, `npm run check:csp`, loads every built page with its CSP enforced, fetching Mermaid and GoatCounter's `count.js` from their CDNs while stubbing GoatCounter's counter, and runs axe on each page, failing on any serious or critical finding.

`npm run check:links:external` probes every off-site link. It is not part of `npm run check`, since third-party sites fail for reasons of their own; the weekly `External links` workflow runs it and keeps one `external-links` issue open while a link is broken. HTTP 429, 503 and 999 (rate limits and bot walls) are warnings, and every failure gets one retry.

## Visual QA

Use the local screenshot helper when checking layout changes:

```bash
npm run visual:capture
```

By default the helper starts the bundled Hugo server on `127.0.0.1:1313` and writes desktop and mobile captures for `/`, `/projects/`, `/blog/`, `/cv/`, a representative blog post, `/search/` and `/skills/` to `artifacts/visual-smoke/<YYYY-MM-DD>/`. It also checks basic page landmarks, mobile overflow, key home/blog sections, and broken visible images before writing screenshots. With `--public` it serves the built `public/` instead, the minified files that ship, which is what CI does: the deploy uploads its captures as `visual-smoke-main`, and each pull request compares its own with them in the job summary without failing (the homepage animates, so its captures always differ a little). To capture an already-running server, set `SITE_URL`:

```bash
SITE_URL=http://127.0.0.1:1313/ npm run visual:capture
```

To check the current published GitHub Pages site directly:

```bash
npm run visual:capture:live
```

To compare two visual smoke manifests, usually local versus live or today versus a previous curated baseline:

```bash
npm run visual:compare -- --baseline artifacts/<baseline>/manifest.json --candidate artifacts/<candidate>/manifest.json
```

The comparator matches screenshots by route and viewport, verifies the referenced files exist, reports missing/unmatched pairs, and flags changed pairs by image hash or dimensions. When same-sized PNG screenshots drift, it also reports changed pixel count, changed percentage, average channel delta, and max channel delta so tiny rendering variance is easier to distinguish from real layout movement. Add `--fail-on-drift` when a CI-style non-zero exit is useful for changed screenshots.

For known tiny rendering variance, combine `--fail-on-drift` with explicit drift budgets. Changed pairs are still reported, but the command exits successfully when every changed pair stays within all configured budgets:

```bash
npm run visual:compare -- --baseline artifacts/local/manifest.json --candidate artifacts/live/manifest.json --fail-on-drift --max-changed-percent 0.5 --max-average-channel-delta 0.01 --max-channel-delta 4
```

For repeat local captures that include long article/code pages, use a slightly looser starter budget until there is a newer curated baseline:

```bash
npm run visual:compare -- --baseline artifacts/local/manifest.json --candidate artifacts/live/manifest.json --fail-on-drift --max-changed-percent 1.0 --max-average-channel-delta 0.01 --max-channel-delta 24
```

Visual smoke captures are ignored by git: `artifacts/` and `screenshots/` stay local.

The helper expects Playwright and a Chromium browser to be available locally:

```bash
npm install --save-dev playwright
npx playwright install chromium
```

## Architecture

- custom Hugo layouts in `layouts/`
- site styles in `assets/css/custom.css`
- small progressive enhancements in `assets/js/site.js`
- content remains markdown-first across blog, experience, education, projects, and skills

`CLAUDE.md` describes the current layout, the pixel skin and the content rules in more detail.

## Analytics

The site uses [GoatCounter](https://www.goatcounter.com/) for privacy-friendly analytics.

- Dashboard: https://yonatankarp.goatcounter.com
- Localhost and private IPs are automatically excluded
- To exclude your own visits from a browser, visit your site with `#toggle-goatcounter` appended to the URL (e.g. `https://yonatankarp.com#toggle-goatcounter`). This sets a localStorage flag — built into GoatCounter's `count.js`

## Toolchain Pins

Hugo is installed from a GitHub release by the shared build action, so its version
is a string in `.github/hugo.env`, not a dependency Dependabot can bump. The weekly
`Pin staleness` workflow compares that pin with Hugo's newest release and keeps a
single `toolchain-pin` issue in step with what it finds: it opens the issue when the
pin falls behind or `HUGO_SHA256` is not the release's published checksum of the
`.deb` (that one also fails the run), edits it as the answer changes, and closes it
once the pin catches up. When the release API cannot be reached it says so as a
warning on the run and leaves the issue alone. Run the same check locally:

```bash
npm run check:hugo-pin
```

It is deliberately outside `npm run check`: it needs the network, and its answer
changes when Hugo releases rather than when this repository changes, so it has no
business failing a pull request. Bumping Hugo means editing `HUGO_VERSION` and
`HUGO_SHA256` together in `.github/hugo.env` (the sha is the
`hugo_extended_<version>_linux-amd64.deb` line of the release's
`hugo_<version>_checksums.txt`) and letting `Validate Hugo build` decide.

## Deployment

Push to `main` triggers the GitHub Actions workflow which builds and deploys to GitHub Pages.
