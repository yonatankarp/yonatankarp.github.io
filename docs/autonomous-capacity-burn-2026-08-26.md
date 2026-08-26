# Autonomous Capacity Burn - 2026-08-26

Monthly autonomous capacity-burn pass focused on continuing the personal website work from verification into portfolio content value.

Timezone for this audit: Europe/Berlin.

## Delivered

- Expanded the `ff4k` project page from a short case-study shell into a clearer engineering case study.
- Added problem framing, design goals, architecture boundaries, trade-offs, and collaboration/hiring signal.
- Rebuilt and checked the generated Hugo site.
- Captured a fresh 12-screenshot local visual smoke set.

## Findings

1. The site remains buildable and deployable after the `ff4k` content expansion.
2. Generated HTML still passes the placeholder/accessibility guardrails across 96 files.
3. CV print output remains within the 2-page A4 limit.
4. Internal links still pass across generated HTML.
5. Visual smoke capture completed across the standard 12 route/viewport pairs.
6. Strict visual comparison against 2026-08-25 failed because the content expansion changed home/projects page heights and shifted mobile pixels. This is expected content drift, not an observed rendering failure.

## Evidence

Commands run:

```bash
git status --short --branch
git -C /home/yonatan/.openclaw/workspace/projects/yonatankarp.github.io status --short --branch
npm run check
npm run visual:capture -- --out artifacts/visual-smoke/2026-08-26
npm run visual:compare -- --baseline artifacts/visual-smoke/2026-08-25/manifest.json --candidate artifacts/visual-smoke/2026-08-26/manifest.json --fail-on-drift --max-changed-percent 1.0 --max-average-channel-delta 0.01 --max-channel-delta 24
```

Results:

- `npm run check`: passed.
- `npm run visual:capture -- --out artifacts/visual-smoke/2026-08-26`: captured 12 screenshots and all built-in smoke assertions passed.
- `npm run visual:compare ... 2026-08-25 ... 2026-08-26`: compared 12 pairs; 8 unchanged, 4 changed, 0 missing or unmatched, 4 over budget. Changed pairs were `home::desktop`, `home::mobile`, `projects::desktop`, and `projects::mobile`.

Generated but intentionally ignored screenshot artifacts:

- `artifacts/visual-smoke/2026-08-26/`

## Files

- `content/projects/ff4k.md`
- `docs/autonomous-capacity-burn-2026-08-26.md`

## Next

Use the next website capacity pass to add a small architecture diagram or annotated API snippet to the `ff4k` page, then refresh visual baselines once the intentional content growth is accepted.
