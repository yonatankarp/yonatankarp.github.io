# Autonomous Capacity Burn - 2026-07-14

Timezone: Europe/Berlin

## Focus

Continue website deployment-quality hardening after the CV screen and print passes.

## Delivered

- Added an automated `check:cv-print` guard that renders `/cv/` through Playwright, reads the generated PDF with `pdfinfo`, and fails if the CV exceeds 2 A4 pages.
- Wired the print guard into `npm run check` after the Hugo build and generated HTML checks.
- Captured a fresh visual smoke set for the homepage, projects, blog, CV, long-form post, and Madeira page across desktop and mobile.

## Evidence

- `npm run check`
  - Result before edits: passed.
  - Result after edits: passed with the new `check:cv-print` guard included.
  - Blog asset references exist across 15 blog markdown files.
  - Bundled Hugo `v0.160.0` built 151 pages because system `hugo` is not installed.
  - Generated metadata uses `https://yonatankarp.com` across 6 public files.
  - Generated HTML accessibility/placeholder checks passed across 94 HTML files.
  - CV print check passed at 2 A4 pages with a limit of 2.
  - Internal link checks passed across 94 HTML files.
- `npm run visual:capture -- --out artifacts/visual-smoke/2026-07-14`
  - Result: passed.
  - Captured 12 screenshots in `artifacts/visual-smoke/2026-07-14/`.
  - Spot-checked homepage desktop/mobile, projects desktop/mobile, blog mobile, CV mobile, the self-compiling second brain post mobile, and Madeira mobile.

## Changed Files

- `package.json`
- `scripts/check-cv-print.js`
- `docs/autonomous-capacity-burn-2026-07-14.md`

## Next

Keep the next website pass focused on release readiness: verify the GitHub Pages workflow after push and only reopen visual polish if a current screenshot shows a concrete regression.
