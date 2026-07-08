# Autonomous Capacity Burn - 2026-07-08

Timezone: Europe/Berlin

## Focus

Continue the website follow-up from 2026-07-07: verify the deployed-quality visual smoke path and recheck dated Madeira 2026 logistics before the trip window.

## Delivered

- Re-ran the full static-site check suite and the permanent visual smoke capture matrix.
- Inspected the fresh Madeira desktop and mobile screenshots from `artifacts/visual-smoke/2026-07-08/`; both render the route guide, daily timeline, photos, decision rules, and source panels without visible overflow.
- Rechecked official Madeira sources for PR1, PR8, IFCN fees, and SIGA fares.
- Corrected the Madeira page's mountain-swap fee from `EUR 10.50 PR1 fee + transfer` to `EUR 4.50 PR1 fee + transfer`.
- Updated the PR1 restriction note and footer freshness marker from 5 Jul to 8 Jul 2026.

## Evidence

- `npm run check`
  - Result: passed.
  - Blog asset references exist across 15 blog markdown files.
  - Bundled Hugo `v0.160.0` built 151 pages because system `hugo` is not installed.
  - Generated metadata uses `https://yonatankarp.com` across 6 public files.
  - Generated HTML accessibility/placeholder checks passed across 94 HTML files.
  - Internal link checks passed across 94 HTML files.
- `npm run visual:capture`
  - Result: passed and captured 12 screenshots in `artifacts/visual-smoke/2026-07-08/`.
- Official source checks
  - Visit Madeira PR1 page: still `OPEN`, but accessible only between Pico do Areeiro and Pedra Rija Belvedere, and lists the visitor fee as `4,50 EUR`.
  - Visit Madeira PR8 page: still `OPEN`, lists `4,50 EUR` for visitors over 12, 3 km each way, 2:30 duration, and Baia d'Abra / Casa do Sardinha endpoints.
  - SIGA fare PDF under Ordinance No. 128/2026 confirms onboard municipal/intermunicipal fares of `2,05 EUR` / `2,65 EUR`, prepaid fares of `1,45 EUR` / `2,00 EUR`, and Aerobus prepaid fare of `5,55 EUR`.

## Changed Files

- `static/madeira-2026/index.html`
- `docs/autonomous-capacity-burn-2026-07-08.md`

## Next

Run one more Madeira logistics refresh within 24-48 hours of 12 Jul 2026, focusing on live bus timetable pages, PR1/PR8 trail status, and weather/sea conditions.
