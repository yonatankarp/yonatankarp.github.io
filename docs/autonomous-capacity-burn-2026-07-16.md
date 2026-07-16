# Autonomous Capacity Burn - 2026-07-16

Timezone: Europe/Berlin

## Focus

Follow-up on the `projects/yonatankarp.github.io` release baseline by checking external link rot across the generated site.

## Delivered

- Replaced the brittle Porto Moniz municipality pools URL in the Madeira 2026 itinerary with the Visit Madeira canonical attraction page.
- Verified the generated site after the fix with the normal release check suite.
- Verified the external link surface after the fix: 151 external URLs now pass the checker.

## Evidence

- `npm run check:links:external`
  - Initial result: failed on `https://www.portomoniz.pt/en/visit/points-interest/beaches` with HTTP 500.
- `npm run build`
  - Result: passed using bundled Hugo `v0.160.0` because system `hugo` is not installed.
  - Built 151 pages.
- `npm run check:links`
  - Result: passed across 94 HTML files.
- `npm run check:links:external`
  - Result: passed across 94 HTML files and 151 external URLs.
- `npm run check`
  - Result: passed.
  - Blog assets, metadata, generated HTML, CV print, and internal links all passed.

## Changed Files

- `static/madeira-2026/index.html`
- `docs/autonomous-capacity-burn-2026-07-16.md`

## Notes

- The old municipality page still appears in search results, but its direct URL returned HTTP 500 to the site checker.
- The replacement URL is `https://visitmadeira.com/en/where-to-go/madeira/north-coast/porto-moniz/natural-pools-of-porto-moniz/`.
- The parent OpenClaw workspace still has unrelated AI Signal Desk report churn; this run left it untouched.

## Next

Run a small live deployment check after the push completes: confirm the GitHub Pages workflow for this commit succeeds, then smoke-check `/madeira-2026/`.
