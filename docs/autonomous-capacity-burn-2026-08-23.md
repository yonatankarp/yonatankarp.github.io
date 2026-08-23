# Autonomous Capacity Burn - 2026-08-23

Monthly autonomous capacity-burn pass focused on verifying the personal website redesign, published-site parity, and link health.

Timezone for this audit: Europe/Berlin.

## Delivered

- Ran the full local deployment-quality check suite.
- Captured a fresh local 12-screenshot visual smoke set.
- Compared the fresh local capture against the 2026-08-22 local baseline.
- Captured a fresh live 12-screenshot visual smoke set from `https://yonatankarp.com/`.
- Compared fresh local output against the live site.
- Ran the external link probe across generated public HTML.

## Findings

1. The site remains deployment-quality locally: Hugo builds 153 pages, generated metadata checks pass, generated HTML checks pass across 96 files, CV print output stays at 2 A4 pages, and internal links pass.
2. Local visual output is stable against the previous local baseline: 12 compared screenshot pairs, 12 unchanged, 0 missing or unmatched, and 0 over budget.
3. Live output is effectively in parity with local output: 12 compared screenshot pairs, 11 unchanged, 1 changed, 0 missing or unmatched, and 0 over budget.
4. The only local-versus-live drift is the known long-page desktop variance on `post-self-compiling-second-brain::desktop`: 144,990 of 16,649,280 pixels changed, 0.8708%, average channel delta 0.0045, max channel delta 24. This remains inside the configured budget.
5. External link health is clean: 152 external URLs were probed successfully across 96 generated HTML files.
6. Manual review of the captured home desktop/mobile and projects mobile screenshots found no material visual regression worth changing in this pass. The homepage keeps a clear first-viewport identity signal, mobile navigation is visible, proof/project/writing sections stack coherently, and no obvious horizontal overflow appears in the sampled screenshots.

## Evidence

Commands run:

```bash
git status --short --branch
git -C /home/yonatan/.openclaw/workspace/projects/yonatankarp.github.io status --short --branch
npm run check
npm run visual:capture -- --out artifacts/visual-smoke/2026-08-23-capacity-burn
npm run visual:compare -- --baseline artifacts/visual-smoke/2026-08-22/manifest.json --candidate artifacts/visual-smoke/2026-08-23-capacity-burn/manifest.json --fail-on-drift --max-changed-percent 1.0 --max-average-channel-delta 0.01 --max-channel-delta 24
npm run check:links:external
npm run visual:capture:live -- --out artifacts/visual-smoke/2026-08-23-live
npm run visual:compare -- --baseline artifacts/visual-smoke/2026-08-23-capacity-burn/manifest.json --candidate artifacts/visual-smoke/2026-08-23-live/manifest.json --fail-on-drift --max-changed-percent 1.0 --max-average-channel-delta 0.01 --max-channel-delta 24
```

Results:

- `npm run check`: passed.
- `npm run visual:capture -- --out artifacts/visual-smoke/2026-08-23-capacity-burn`: captured 12 screenshots and all built-in smoke assertions passed.
- Local baseline comparison: 12 compared pairs, 12 unchanged, 0 over budget.
- `npm run check:links:external`: passed across 96 HTML files and 152 external URLs.
- `npm run visual:capture:live -- --out artifacts/visual-smoke/2026-08-23-live`: captured 12 live screenshots and all built-in smoke assertions passed.
- Local-versus-live comparison: 12 compared pairs, 11 unchanged, 1 changed, 0 over budget.

Generated but intentionally ignored screenshot artifacts:

- `artifacts/visual-smoke/2026-08-23-capacity-burn/`
- `artifacts/visual-smoke/2026-08-23-live/`

## Files

- `docs/autonomous-capacity-burn-2026-08-23.md`

## Next

Run a focused content polish pass on the project pages: the project list is visually stable, so the next useful improvement is tightening summaries and taxonomy labels rather than another layout change.
