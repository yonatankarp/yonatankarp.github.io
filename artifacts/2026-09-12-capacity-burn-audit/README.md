# Website Capacity Burn Audit - 2026-09-12

Timezone for this audit: Europe/Berlin.

## Scope

Monthly autonomous capacity-burn check for the personal site repository. The work focused on deployment readiness and visual regression evidence for the current redesign state.

## Result

The site is build-clean and visually healthy across the core smoke set. Local and live captures match on 11 of 12 route/viewport pairs. The only changed pair is the desktop blog page, with same dimensions and a small pixel drift that is not visible on manual review.

No visual/content polish change was justified by the evidence in this run.

## Evidence

- `npm run check`
  - Passed blog asset validation across 15 markdown files.
  - Built with Hugo `v0.160.0`.
  - Generated 154 pages.
  - Passed site metadata checks.
  - Passed generated HTML accessibility/placeholder checks across 97 files.
  - Passed CV print check at 2 A4 pages.
  - Passed internal link check across 97 HTML files.
- `node scripts/capture-screenshots.js --out artifacts/2026-09-12-capacity-burn-local`
  - Captured 12 local screenshots.
  - Assertion set included route response health, visible `h1`, body text floor, mobile overflow, image natural dimensions, mobile header/nav, home/blog/Madeira landmarks.
- `SITE_URL=https://yonatankarp.com/ node scripts/capture-screenshots.js --out artifacts/2026-09-12-capacity-burn-live`
  - Captured 12 live production screenshots with the same assertion set.
- `npm run visual:compare -- --baseline artifacts/2026-09-12-capacity-burn-local/manifest.json --candidate artifacts/2026-09-12-capacity-burn-live/manifest.json --fail-on-drift --max-changed-percent 1.0 --max-average-channel-delta 0.01 --max-channel-delta 24`
  - Compared pairs: 12.
  - Unchanged: 11.
  - Changed: 1.
  - Missing or unmatched: 0.
  - Changed pair: `blog::desktop`, same dimensions, `37624/3949920` pixels changed, `0.9525%`, average channel delta `0.0134`, max channel delta `13`.

## Files

- Local manifest: `artifacts/2026-09-12-capacity-burn-local/manifest.json`
- Live manifest: `artifacts/2026-09-12-capacity-burn-live/manifest.json`
- Screenshot PNGs remain local-only and ignored by git.

## Notes

- Repository state before the audit was clean and synchronized with `origin/main`.
- Remote uses HTTPS: `https://github.com/yonatankarp/yonatankarp.github.io.git`.
- The workspace root has unrelated AI Signal Desk and wiki changes; they were not touched.

## Next Recommended Task

Promote a fresh curated visual baseline from the current redesign state, then use it as the reference for future `visual:compare --fail-on-drift` runs.
