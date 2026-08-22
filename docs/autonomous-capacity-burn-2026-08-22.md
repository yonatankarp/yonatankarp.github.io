# Autonomous Capacity Burn - 2026-08-22

Monthly autonomous capacity-burn pass focused on keeping the personal website deployable and catching live-facing drift before it becomes user-visible.

Timezone for this audit: Europe/Berlin.

## Delivered

- Ran the full local deployment-quality check suite.
- Captured a fresh 12-screenshot visual smoke set for the local Hugo site.
- Compared the fresh visual capture against the 2026-08-21 local baseline with the current drift budget.
- Ran the external link probe across generated public HTML.

## Findings

1. The generated site remains deployable-quality: Hugo builds cleanly, metadata checks pass, generated HTML checks pass, CV print length stays at 2 A4 pages, and internal links pass.
2. The fresh local visual smoke capture passed across home, projects, blog, CV, the sampled long-form post, and Madeira 2026 at desktop and mobile widths.
3. Local visual drift is limited to the known `post-self-compiling-second-brain::desktop` pair: 144,990 of 16,649,280 pixels changed, 0.8708%, average channel delta 0.0045, max channel delta 24. This is inside the configured budget and matches the prior long-page variance pattern.
4. External link health is clean: 152 external URLs were probed successfully across 96 generated HTML files.
5. Project mobile screenshots still read coherently after the recent project case-study work: cards retain visible media, titles, dates, tags, and CTAs without obvious horizontal overflow.

## Evidence

Commands run:

```bash
git status --short --branch
git -C /home/yonatan/.openclaw/workspace/projects/yonatankarp.github.io status --short --branch
npm run check
npm run visual:capture -- --out artifacts/visual-smoke/2026-08-22
npm run visual:compare -- --baseline artifacts/visual-smoke/2026-08-21/manifest.json --candidate artifacts/visual-smoke/2026-08-22/manifest.json --fail-on-drift --max-changed-percent 1.0 --max-average-channel-delta 0.01 --max-channel-delta 24
npm run check:links:external
```

Results:

- `npm run check`: passed.
- `npm run visual:capture -- --out artifacts/visual-smoke/2026-08-22`: captured 12 screenshots and all built-in smoke assertions passed.
- `npm run visual:compare ...`: 12 compared pairs, 11 unchanged, 1 changed, 0 missing or unmatched, 0 over budget.
- `npm run check:links:external`: passed across 96 HTML files and 152 external URLs.

Generated but intentionally ignored screenshot artifacts:

- `artifacts/visual-smoke/2026-08-22/`

## Files

- `docs/autonomous-capacity-burn-2026-08-22.md`

## Next

Run the next website pass against the published site with `npm run visual:capture:live`, then compare fresh local versus fresh live manifests before making any further design changes.
