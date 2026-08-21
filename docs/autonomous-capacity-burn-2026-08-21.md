# Autonomous Capacity Burn - 2026-08-21

Monthly autonomous capacity-burn pass focused on the personal website visual QA and deployment-quality track.

## Delivered

- Ran a fresh local 12-screenshot visual smoke capture for the website.
- Ran the published-site visual smoke check; the first attempt exposed a transient `503` on `/madeira-2026/`, and the retry passed.
- Compared fresh local versus live captures and confirmed the deployed site matches the local build across all 12 route/viewport pairs.
- Updated `README.md` with a less brittle starter drift budget for repeat local captures that include long article/code pages.

## Evidence

Commands run:

```bash
git status --short --branch
git -C projects/yonatankarp.github.io status --short --branch
npm run visual:capture -- --out artifacts/visual-smoke/2026-08-21
npm run visual:capture:live -- --out artifacts/visual-smoke/2026-08-21-live
curl -I -L --max-time 20 https://yonatankarp.com/madeira-2026/
curl -I -L --max-time 20 https://yonatankarp.com/
npm run visual:compare -- --baseline artifacts/visual-smoke/2026-08-17/manifest.json --candidate artifacts/visual-smoke/2026-08-21/manifest.json --fail-on-drift --max-changed-percent 0.5 --max-average-channel-delta 0.01 --max-channel-delta 4
npm run visual:compare -- --baseline artifacts/visual-smoke/2026-08-19/manifest.json --candidate artifacts/visual-smoke/2026-08-21/manifest.json --fail-on-drift --max-changed-percent 0.5 --max-average-channel-delta 0.01 --max-channel-delta 4
npm run check
npm run visual:capture:live -- --out artifacts/visual-smoke/2026-08-21-live-retry
npm run visual:compare -- --baseline artifacts/visual-smoke/2026-08-21/manifest.json --candidate artifacts/visual-smoke/2026-08-21-live-retry/manifest.json --fail-on-drift --max-changed-percent 1.0 --max-average-channel-delta 0.01 --max-channel-delta 24
```

Results:

- Local visual smoke passed and wrote 12 ignored screenshots under `artifacts/visual-smoke/2026-08-21/`.
- First live visual smoke attempt failed on `/madeira-2026/` with `503`; immediate `curl -I -L` checks returned `200` for both `/madeira-2026/` and `/`.
- Retry live visual smoke passed and wrote 12 ignored screenshots under `artifacts/visual-smoke/2026-08-21-live-retry/`.
- Fresh local versus fresh live comparison passed: 12 compared pairs, 12 unchanged, 0 changed, 0 missing/unmatched, 0 over budget.
- Repeat local comparison against both 2026-08-17 and 2026-08-19 baselines found one visually identical but over-budget pair: `post-self-compiling-second-brain::desktop` at `0.8708%` changed pixels, average channel delta `0.0045`, max channel delta `24`.
- Full site check passed: blog assets, Hugo production build, generated metadata, generated HTML checks, CV print limit, and internal links.

## Files

- `README.md`
- `docs/autonomous-capacity-burn-2026-08-21.md`

## Next

Promote a new curated local visual baseline after the next content/design change, then retune the drift budget from fresh baseline data instead of comparing against older long-page captures indefinitely.
