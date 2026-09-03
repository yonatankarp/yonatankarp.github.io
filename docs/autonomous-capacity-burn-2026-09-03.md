# Autonomous capacity burn - 2026-09-03

Timezone: Europe/Berlin

## Outcome

Tightened the personal site's public proof ordering so project surfaces support the current Staff+ backend positioning instead of relying on chronology. The homepage selected-work block now leads with the strongest reusable-backend evidence, and the projects index exposes a compact project-kind label for faster scanning.

## Changes

- Changed homepage selected-work sorting from project date to explicit `weight`.
- Changed the projects index group sorting from date to explicit `weight`.
- Added project weights across all project entries so ranking is durable and reviewable in frontmatter.
- Added visible project-kind metadata to project rows, with compact accent styling.
- Added missing project-kind labels for older/smaller projects and contribution entries.

## Evidence

- `git status --short --branch`: website repo started clean and synced with `origin/main`.
- `npm run check`: passed blog asset references, Hugo production build, metadata validation, generated HTML accessibility/placeholder checks, CV print limit, and internal link checks.
- `npm run visual:capture -- --out artifacts/visual-smoke/2026-09-03-project-proof-ordering`: captured 12 route/viewport screenshots.
- `npm run visual:compare -- --baseline artifacts/visual-smoke/2026-09-02-post-copy/manifest.json --candidate artifacts/visual-smoke/2026-09-03-project-proof-ordering/manifest.json`: 12 compared, 8 unchanged, 4 changed, 0 missing/unmatched. Changed pairs were the intended home and projects desktop/mobile surfaces.
- Manual screenshot inspection: home desktop shows selected-work order as `ff4k`, `openapi-generator`, `TaleKeeper`, `kotlin-design-patterns`; projects desktop/mobile show project-kind labels, contained text, and no visible overflow.
- Generated HTML inspection confirmed projects index order starts with `Open source library / ff4k`, `Self-hosted tool / TaleKeeper`, `AI-agent infrastructure / sse-mcp-server`, and contribution order starts with `openapi-generator`.
- `git push origin main`: pushed commit `726c302` to the HTTPS GitHub origin.
- `gh run watch 33737934799 --exit-status`: GitHub Pages workflow passed; build finished in 2m12s and deploy finished in 8s.
- `npm run visual:capture:live -- --out artifacts/visual-smoke/2026-09-03-project-proof-ordering-live`: captured 12 production route/viewport screenshots.
- `npm run visual:compare -- --baseline artifacts/visual-smoke/2026-09-03-project-proof-ordering/manifest.json --candidate artifacts/visual-smoke/2026-09-03-project-proof-ordering-live/manifest.json`: 12 compared, 12 unchanged, 0 missing/unmatched.

## Artifacts

- `artifacts/visual-smoke/2026-09-03-project-proof-ordering/manifest.json`
- `artifacts/visual-smoke/2026-09-03-project-proof-ordering/home-desktop-2026-09-03.png`
- `artifacts/visual-smoke/2026-09-03-project-proof-ordering/home-mobile-2026-09-03.png`
- `artifacts/visual-smoke/2026-09-03-project-proof-ordering/projects-desktop-2026-09-03.png`
- `artifacts/visual-smoke/2026-09-03-project-proof-ordering/projects-mobile-2026-09-03.png`
- `artifacts/visual-smoke/2026-09-03-project-proof-ordering-live/manifest.json`

## Next

Review whether `sse-mcp-server` should become a featured homepage item once it has a stronger public docs/case-study target; right now it is visible on the projects index but not selected work.
