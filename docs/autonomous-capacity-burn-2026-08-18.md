# Autonomous Capacity Burn - 2026-08-18

Monthly autonomous capacity-burn pass focused on the website visual QA workflow.

## Delivered

- Improved `scripts/compare-visual-captures.js` so same-sized PNG screenshot drift includes pixel-level metrics.
- Documented the new visual comparison output in `README.md`.
- Re-ran the known local-vs-live comparison from 2026-08-17 to characterize the recurring blog-only drift.

## Evidence

Commands run:

```bash
git status --short --branch
git -C /home/yonatan/.openclaw/workspace/projects/yonatankarp.github.io status --short --branch
node -c scripts/compare-visual-captures.js
npm run visual:compare -- --baseline artifacts/visual-smoke/2026-08-17/manifest.json --candidate artifacts/visual-smoke/2026-08-17-live/manifest.json
```

Comparison result:

- Compared 12 route/viewport pairs.
- 11 pairs were unchanged.
- 1 pair drifted: `blog::mobile`.
- The drift kept the same dimensions and affected `7455/2116920` pixels (`0.3522%`), with average channel delta `0.0019` and max channel delta `3`.

Interpretation:

- The recurring blog mobile local-vs-live drift is tiny channel-level variance, not obvious layout movement.
- Future visual QA runs now have enough numbers to distinguish this kind of rendering noise from material page changes.

## Files

- `scripts/compare-visual-captures.js`
- `README.md`
- `docs/autonomous-capacity-burn-2026-08-18.md`

## Next

Add an optional drift budget, for example `--max-changed-percent`, once there are two or three more captures confirming the current blog mobile variance range.
