# Autonomous Capacity Burn - 2026-08-25

Monthly autonomous capacity-burn pass focused on keeping the personal website deployable, visually stable, and aligned with the published site.

Timezone for this audit: Europe/Berlin.

## Delivered

- Ran the full local deployment-quality check suite.
- Captured a fresh 12-screenshot local visual smoke set.
- Captured a fresh 12-screenshot live visual smoke set from `https://yonatankarp.com/`.
- Compared fresh local screenshots against both the previous local baseline and the fresh live capture.
- Ran the external link probe across generated public HTML.

## Findings

1. The generated site remains deployable-quality: Hugo builds cleanly, metadata checks pass, generated HTML checks pass, CV print length stays at 2 A4 pages, and internal links pass.
2. Fresh local visual smoke passed across home, projects, blog, CV, the sampled long-form post, and Madeira 2026 at desktop and mobile widths.
3. Fresh live visual smoke passed across the same 12 route and viewport pairs, confirming the published site still satisfies the smoke assertions.
4. Local visual drift from the 2026-08-24 baseline is inside budget: 10 unchanged pairs, 2 changed pairs, 0 over budget. The changed pairs were `post-self-compiling-second-brain::mobile` at 0.2716% changed pixels and `projects::mobile` at 0.0954%.
5. Fresh local-vs-live drift is effectively nil: 11 unchanged pairs, 1 changed pair, 0 over budget. The only changed pair was `madeira-2026::mobile` at 0.0003% changed pixels.
6. External link health is clean: 152 external URLs were probed successfully across 96 generated HTML files.

## Evidence

Commands run:

```bash
git status --short --branch
git -C /home/yonatan/.openclaw/workspace/projects/yonatankarp.github.io status --short --branch
npm run check
npm run visual:capture -- --out artifacts/visual-smoke/2026-08-25
npm run visual:compare -- --baseline artifacts/visual-smoke/2026-08-24/manifest.json --candidate artifacts/visual-smoke/2026-08-25/manifest.json --fail-on-drift --max-changed-percent 1.0 --max-average-channel-delta 0.01 --max-channel-delta 24
npm run visual:capture:live -- --out artifacts/visual-smoke/2026-08-25-live
npm run visual:compare -- --baseline artifacts/visual-smoke/2026-08-25-live/manifest.json --candidate artifacts/visual-smoke/2026-08-25/manifest.json --fail-on-drift --max-changed-percent 1.0 --max-average-channel-delta 0.01 --max-channel-delta 24
npm run check:links:external
```

Results:

- `npm run check`: passed.
- `npm run visual:capture -- --out artifacts/visual-smoke/2026-08-25`: captured 12 screenshots and all built-in smoke assertions passed.
- `npm run visual:compare ... 2026-08-24 ... 2026-08-25`: 12 compared pairs, 10 unchanged, 2 changed, 0 missing or unmatched, 0 over budget.
- `npm run visual:capture:live -- --out artifacts/visual-smoke/2026-08-25-live`: captured 12 live screenshots and all built-in smoke assertions passed.
- `npm run visual:compare ... 2026-08-25-live ... 2026-08-25`: 12 compared pairs, 11 unchanged, 1 changed, 0 missing or unmatched, 0 over budget.
- `npm run check:links:external`: passed across 96 HTML files and 152 external URLs.

Generated but intentionally ignored screenshot artifacts:

- `artifacts/visual-smoke/2026-08-25/`
- `artifacts/visual-smoke/2026-08-25-live/`

## Files

- `docs/autonomous-capacity-burn-2026-08-25.md`

## Next

Move the next website capacity pass from verification to content value: draft the first deeper `ff4k` case-study page, then run the same check and visual smoke suite.
