# Autonomous capacity burn - 2026-09-06

Timezone: Europe/Berlin

## Outcome

Verified the post-promotion homepage shape after `sse-mcp-server` became a featured selected-work item. The five-item selected-work section should stay for now: each item carries a distinct signal, the local and production renderings match exactly, and the screenshots show no material layout issue that would justify removing a proof point.

## Findings

1. The website repository started clean and aligned with `origin/main` at `90f723d`.
2. The full local check suite passed: blog assets, Hugo production build, production metadata, generated HTML checks, CV print limit, and internal links.
3. The homepage selected-work section now has five coherent proof points: `ff4k`, `openapi-generator`, `TaleKeeper`, `sse-mcp-server`, and `kotlin-design-patterns`.
4. Fresh local visual smoke captured 12 route/viewport screenshots. Manual review of the homepage desktop/mobile and projects mobile captures found no overlap, horizontal clipping, missing visible media, or CTA wrapping defect.
5. Fresh live visual smoke captured 12 production screenshots, and local-vs-live comparison reported 12 unchanged pairs with no missing or over-budget drift.

## Evidence

```text
git status --short --branch
npm run check
npm run visual:capture -- --out artifacts/visual-smoke/2026-09-06-capacity-burn-local
npm run visual:capture:live -- --out artifacts/visual-smoke/2026-09-06-capacity-burn-live
npm run visual:compare -- --baseline artifacts/visual-smoke/2026-09-06-capacity-burn-local/manifest.json --candidate artifacts/visual-smoke/2026-09-06-capacity-burn-live/manifest.json --fail-on-drift --max-changed-percent 0.5 --max-average-channel-delta 0.01 --max-channel-delta 4
gh auth status
git ls-remote origin refs/heads/main
```

Results:

- `npm run check`: passed across 154 generated pages and 97 checked HTML files.
- Local visual capture: 12 screenshots under `artifacts/visual-smoke/2026-09-06-capacity-burn-local/`.
- Live visual capture: 12 screenshots under `artifacts/visual-smoke/2026-09-06-capacity-burn-live/`.
- Visual comparison: 12 compared, 12 unchanged, 0 changed, 0 missing/unmatched, 0 over budget.
- GitHub CLI: authenticated as `yonatankarp`; token redacted from logs.
- Remote `main`: `90f723dc92c743a349c12a466a1a5ff86638121d`.

## Artifacts

- `artifacts/visual-smoke/2026-09-06-capacity-burn-local/manifest.json`
- `artifacts/visual-smoke/2026-09-06-capacity-burn-live/manifest.json`
- `artifacts/visual-smoke/2026-09-06-capacity-burn-local/home-desktop-2026-09-06.png`
- `artifacts/visual-smoke/2026-09-06-capacity-burn-local/home-mobile-2026-09-06.png`
- `artifacts/visual-smoke/2026-09-06-capacity-burn-local/projects-mobile-2026-09-06.png`

## Next

Do a content-freshness pass on `kotlin-design-patterns`: either keep it featured with stronger current maintenance evidence, or replace it with a newer local case study if the project is no longer an active signal.
