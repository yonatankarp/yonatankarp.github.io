# Autonomous Capacity Burn - 2026-06-28

Timezone: Europe/Berlin

## Focus

Continued the deployment-quality personal website track. The parent OpenClaw workspace had unrelated AI Signal Desk report churn, so this run stayed inside the clean `projects/yonatankarp.github.io` repository.

## Findings

- The website repo started clean and aligned with `origin/main` at `1de139e`.
- Production `https://yonatankarp.com/` now serves `https://yonatankarp.com/` canonical, OpenGraph, Twitter image, and JSON-LD URLs.
- Local validation passed with the expected fallback to bundled Hugo because system `hugo` is not installed.
- The previous canonical regression had no generated-site guard in `npm run check`, CI, or deploy.

## Change

- Added `scripts/check-site-metadata.js`, which inspects built `public/` pages and `llms.txt` for stale `http://yonatankarp.com` URLs and validates canonical/social metadata uses `https://yonatankarp.com`.
- Wired the metadata guard into `npm run check`.
- Added the same guard after Hugo builds in both CI and Pages deploy workflows, before screenshot capture or artifact upload.

## Checks

- `curl -L --max-time 20 https://yonatankarp.com/ | rg -n "canonical|og:url|og:image|twitter:image|application/ld\\+json|http://yonatankarp.com|https://yonatankarp.com"`
  - Result: live home page uses `https://yonatankarp.com/` metadata and no stale `http://yonatankarp.com` match.
- `npm run check`
  - Result: blog asset references passed for 15 markdown files; Hugo build passed through bundled `.tools/hugo/hugo`; generated metadata check passed across 5 public files.

## Artifacts

- `scripts/check-site-metadata.js`
- `.github/workflows/ci.yml`
- `.github/workflows/deploy.yml`
- `package.json`

## Next

After push, confirm the Pages deployment succeeds with the new generated metadata guard in the deploy job.
