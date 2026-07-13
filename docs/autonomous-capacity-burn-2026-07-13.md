# Autonomous Capacity Burn - 2026-07-13

Timezone: Europe/Berlin

## Focus

Continue the July 12 website next step: make the CV easier to scan on mobile without reopening the broader visual redesign.

## Delivered

- Added structured `summary` and `highlights` metadata to every experience entry.
- Updated the CV template to render each role as a short summary plus compact bullet highlights, with responsive two-column bullets on desktop and single-column bullets on mobile.
- Updated the homepage experience timeline to use the shorter `summary` field so the front page no longer inherits dense full-role prose.
- Added scoped CSS for CV highlights that matches the existing CV visual system.

## Evidence

- `git status --short --branch`
  - Website repo result before edits: `## main...origin/main`.
  - Parent workspace had unrelated AI Signal Desk report/source-discovery changes; left untouched.
- `npm run check`
  - Result: passed.
  - Blog asset references exist across 15 blog markdown files.
  - Bundled Hugo `v0.160.0` built 151 pages because system `hugo` is not installed.
  - Generated metadata uses `https://yonatankarp.com` across 6 public files.
  - Generated HTML accessibility/placeholder checks passed across 94 HTML files.
  - Internal link checks passed across 94 HTML files.
- `npm run visual:capture`
  - Result: passed.
  - Captured 12 screenshots in `artifacts/visual-smoke/2026-07-13/`.
  - Manual spot-checks covered `cv-desktop-2026-07-13.png`, `cv-mobile-2026-07-13.png`, and `home-mobile-2026-07-13.png`.

## Changed Files

- `assets/css/custom.css`
- `content/experience/billie-senior-risk.md`
- `content/experience/billie-staff-payments.md`
- `content/experience/billie-staff-risk.md`
- `content/experience/inuitive.md`
- `content/experience/nice.md`
- `content/experience/sumup.md`
- `layouts/_default/cv.html`
- `layouts/index.html`
- `docs/autonomous-capacity-burn-2026-07-13.md`

## Next

Run a print/PDF pass on `/cv/`: the screen CV now scans better, but print CSS may need tighter spacing and page-break control after the bullet conversion.
