# Autonomous Capacity Burn - 2026-08-20

Monthly autonomous capacity-burn pass focused on closing the visual QA drift-budget follow-up from the 2026-08-18 run.

## Delivered

- Added explicit visual drift budgets to `scripts/compare-visual-captures.js`.
- `--fail-on-drift` now fails only when changed same-size PNG pairs exceed a configured budget, while still failing for missing pairs, unmatched pairs, dimension changes, or unsupported diffs.
- Documented the budgeted compare workflow in `README.md`.

## Evidence

Commands run:

```bash
git status --short --branch
git -C /home/yonatan/.openclaw/workspace/projects/yonatankarp.github.io status --short --branch
node -c scripts/compare-visual-captures.js
npm run visual:compare -- --baseline artifacts/visual-smoke/2026-08-17/manifest.json --candidate artifacts/visual-smoke/2026-08-17-live/manifest.json --fail-on-drift --max-changed-percent 0.5 --max-average-channel-delta 0.01 --max-channel-delta 4
npm run visual:compare -- --baseline artifacts/visual-smoke/2026-08-17/manifest.json --candidate artifacts/visual-smoke/2026-08-17-live/manifest.json --fail-on-drift --max-changed-percent 0.1
npm run check
```

Results:

- Syntax check passed.
- Budgeted local-vs-live comparison passed with 12 compared pairs, 11 unchanged, 1 changed, 0 missing/unmatched, and 0 over budget.
- The changed pair was the known `blog::mobile` variance: `7455/2116920` pixels (`0.3522%`), average channel delta `0.0019`, max channel delta `3`.
- Intentionally tight `--max-changed-percent 0.1` comparison exited non-zero and marked `blog::mobile` as over budget, confirming the failure path.
- Full site check passed: blog asset references, Hugo production build, generated metadata, generated HTML checks, CV print limit, and internal links.

## Files

- `scripts/compare-visual-captures.js`
- `README.md`
- `docs/autonomous-capacity-burn-2026-08-20.md`

## Next

Run the next live visual smoke capture and use `--fail-on-drift --max-changed-percent 0.5 --max-average-channel-delta 0.01 --max-channel-delta 4` as the initial noise budget; tighten it only after a few more local-vs-live samples.
