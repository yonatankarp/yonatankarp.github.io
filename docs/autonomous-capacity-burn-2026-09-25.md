# Autonomous Capacity Burn - 2026-09-25

Timezone: Europe/Berlin

## Focus

Continue the project-page polish pass from the previous autonomous run: project image aspect ratios, detail-page media consistency, and mobile CTA alignment.

## Delivered

- Added consistent project cover imagery to project case-study pages using existing `assets/images/projects/*` assets.
- Normalized project list thumbnails and project article covers to a 16:9 frame.
- Reworked project entry title/CTA alignment from flex wrapping to a stable two-column grid, with a mobile fallback below 520px.
- Captured a fresh local visual smoke set after the CSS/template changes.

## Evidence

- `npm run check` passed:
  - blog asset references exist across 15 blog markdown files
  - Hugo production build generated 157 pages
  - generated HTML accessibility/placeholder checks passed across 100 files
  - CV print check stayed within 2 A4 pages
  - internal link check passed across 100 HTML files
- `SITE_URL=http://127.0.0.1:43441/ npm run visual:capture -- --out artifacts/2026-09-25-capacity-burn-project-polish` captured 12 screenshots.
- Playwright detail-page smoke for `/projects/ff4k/` verified:
  - 390px viewport: cover rendered at 322x181, no horizontal overflow
  - 1440px viewport: cover rendered at 984x554, no horizontal overflow
- Generated HTML check confirmed `public/projects/ff4k/index.html` and `public/projects/openapi-generator/index.html` include `article__cover--project` images.

## Files

- `layouts/_default/single.html`
- `assets/css/custom.css`
- `artifacts/2026-09-25-capacity-burn-project-polish/README.md`
- `artifacts/2026-09-25-capacity-burn-project-polish/manifest.json`
- `artifacts/2026-09-25-capacity-burn-project-polish/*.png`
- `docs/autonomous-capacity-burn-2026-09-25.md`

## Notes

The workspace root still contains a large unrelated AI Signal Desk/report backlog, so this run kept the commit scoped to the independent website repository.

## Next

Compare the 2026-09-25 local visual capture against production after the website push/deploy completes, then record deployment evidence.
