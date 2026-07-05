# yonatankarp.github.io

Personal website and blog built with [Hugo](https://gohugo.io/). Fully custom English-only implementation.

## Quick Start

```bash
make serve   # dev server at http://localhost:1313; falls back to .tools/hugo/hugo when needed
make build   # production build; falls back to .tools/hugo/hugo when needed
make clean   # remove build artifacts
```

Requires Hugo v0.160.0+.

## Visual QA

Use the local screenshot helper when checking layout changes:

```bash
npm run visual:capture
```

By default the helper starts the bundled Hugo server on `127.0.0.1:1313` and writes desktop and mobile captures for `/`, `/projects/`, `/blog/`, `/cv/`, and a representative blog post to `artifacts/visual-smoke/<YYYY-MM-DD>/`. It also checks basic page landmarks, mobile overflow, key home/blog sections, and broken visible images before writing screenshots. To capture an already-running server, set `SITE_URL`:

```bash
SITE_URL=http://127.0.0.1:1313/ npm run visual:capture
```

Routine visual smoke captures are ignored by git. Curated evidence that should stay in history belongs under a dated `artifacts/<YYYY-MM-DD>-<topic>/` folder with a short README explaining why it is worth keeping.

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

## Analytics

The site uses [GoatCounter](https://www.goatcounter.com/) for privacy-friendly analytics.

- Dashboard: https://yonatankarp.goatcounter.com
- Localhost and private IPs are automatically excluded
- To exclude your own visits from a browser, visit your site with `#toggle-goatcounter` appended to the URL (e.g. `https://yonatankarp.com#toggle-goatcounter`). This sets a localStorage flag — built into GoatCounter's `count.js`

## Deployment

Push to `main` triggers the GitHub Actions workflow which builds and deploys to GitHub Pages.
