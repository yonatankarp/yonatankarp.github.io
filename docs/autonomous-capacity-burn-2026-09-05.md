# Autonomous capacity burn - 2026-09-05

Timezone: Europe/Berlin

## Outcome

Promoted the new `sse-mcp-server` case study into the homepage selected-work list. The homepage now surfaces a current AI-agent infrastructure proof point instead of leaving it only on the full projects index.

## Changes

- Added `featured: true` to `content/projects/sse-mcp-server.md`.
- Verified the homepage selected-work section renders five items, including the `sse-mcp-server` local case study link and AI-agent infrastructure metadata.
- Captured fresh local visual smoke screenshots before and after the homepage promotion.

## Evidence

- `git status --short --branch`: website repo started clean and synced with `origin/main`.
- `npm run check`: passed blog asset references, Hugo production build, metadata validation, generated HTML checks, CV print limit, and internal link checks across 97 HTML files.
- `npm run visual:capture -- --out artifacts/visual-smoke/2026-09-05-capacity-burn-local`: captured 12 pre-change local route/viewport screenshots.
- `npm run visual:capture -- --out artifacts/visual-smoke/2026-09-05-sse-homepage-featured`: captured 12 post-change local route/viewport screenshots.
- Targeted generated HTML check: `selectedWorkItems: 5`, `hasSse: true`, `hasCaseStudy: true`.
- Manual screenshot inspection: desktop and mobile homepage layouts stayed readable after the fifth selected-work entry; no visible horizontal overflow or CTA wrapping issue was observed.

## Artifacts

- `artifacts/visual-smoke/2026-09-05-capacity-burn-local/manifest.json`
- `artifacts/visual-smoke/2026-09-05-sse-homepage-featured/manifest.json`
- `artifacts/visual-smoke/2026-09-05-sse-homepage-featured/home-desktop-2026-09-05.png`
- `artifacts/visual-smoke/2026-09-05-sse-homepage-featured/home-mobile-2026-09-05.png`

## Next

Run live visual capture and compare after GitHub Pages deploys, then record production parity if unchanged.
