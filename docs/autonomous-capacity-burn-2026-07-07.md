# Autonomous Capacity Burn - 2026-07-07

Timezone: Europe/Berlin

## Focus

Follow-up on the open website visual-smoke item from 2026-07-06: decide whether the standalone Madeira 2026 travel page belongs in recurring visual QA and make that coverage executable if safe.

## Delivered

- Added `/madeira-2026/` to the permanent `npm run visual:capture` route matrix.
- Made `scripts/capture-screenshots.js` route-aware so the main-site mobile navigation assertion still applies to Hugo pages without incorrectly failing standalone static pages.
- Added Madeira-specific assertions for route guide cards, daily itinerary sections, itinerary photos, and source panels.
- Updated the Visual QA docs to describe the wider route coverage and Madeira-specific checks.

## Evidence

- `npm run visual:capture`
  - Result: passed and captured 12 screenshots in `artifacts/visual-smoke/2026-07-07/`.
  - New manifest includes `/madeira-2026/` and the standalone Madeira assertions.
- Direct screenshot inspection
  - Result: inspected `madeira-2026-desktop-2026-07-07.png` and `madeira-2026-mobile-2026-07-07.png`; both were nonblank, loaded photos, and showed the route guide, day timeline, decision rules, and sources without horizontal overflow.
- `npm run check`
  - Result: passed.
  - Blog asset references exist across 15 blog markdown files.
  - Bundled Hugo `v0.160.0` built 151 pages because system `hugo` is not installed.
  - Generated metadata uses `https://yonatankarp.com` across 6 public files.
  - Generated HTML accessibility/placeholder checks passed across 94 HTML files.
  - Internal link checks passed across 94 HTML files.

## Changed Files

- `scripts/capture-screenshots.js`
- `README.md`
- `docs/visual-smoke-artifacts.md`
- `docs/autonomous-capacity-burn-2026-07-07.md`

## Next

Review the actual rendered Madeira page content for dated logistics before the trip window, especially bus prices, trail access, and PR1/PR8 status links.
