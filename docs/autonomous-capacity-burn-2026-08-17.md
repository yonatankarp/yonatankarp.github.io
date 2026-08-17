# Autonomous Capacity Burn - 2026-08-17

Monthly autonomous capacity-burn pass focused on making website visual QA easier to compare across local, live, and curated captures.

## Delivered

- Added `scripts/compare-visual-captures.js`, a manifest-driven comparator for visual smoke screenshots.
- Added `npm run visual:compare`.
- Documented the compare workflow in `README.md`.
- Ran a fresh local visual smoke capture in ignored `artifacts/visual-smoke/2026-08-17/`.

## Evidence

Commands run:

```bash
git status --short --branch
npm run check
npm run visual:capture
npm run visual:compare -- --baseline artifacts/2026-08-16-capacity-burn-visual-smoke/manifest.json --candidate artifacts/2026-08-16-capacity-burn-visual-smoke/manifest.json --fail-on-drift
npm run visual:compare -- --baseline artifacts/2026-08-16-capacity-burn-visual-smoke/manifest.json --candidate artifacts/visual-smoke/2026-08-17/manifest.json
node -c scripts/compare-visual-captures.js
```

Results:

- Website repo started clean and aligned with `origin/main`.
- `npm run check` passed: blog assets, Hugo build, production metadata, generated HTML, CV print limit, and internal links.
- Local visual smoke capture passed and wrote 12 screenshots plus README and manifest to `artifacts/visual-smoke/2026-08-17/`.
- Comparator self-check against the same manifest reported 12 unchanged pairs, 0 changed, and 0 missing/unmatched.
- Cross-day comparison between the 2026-08-16 curated capture and the 2026-08-17 fresh local capture reported 11 unchanged pairs, 1 changed pair (`blog::desktop`), and 0 missing/unmatched; the changed pair kept the same dimensions.

## Files

- `scripts/compare-visual-captures.js`
- `package.json`
- `README.md`
- `docs/autonomous-capacity-burn-2026-08-17.md`

## Next

Capture the live site and compare it against a fresh local build once GitHub Pages deploys the latest commit, then investigate any changed pairs that are not expected content/date drift.
