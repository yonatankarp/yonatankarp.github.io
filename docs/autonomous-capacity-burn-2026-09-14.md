# Autonomous capacity burn - 2026-09-14

Timezone: Europe/Berlin

## Outcome

Verified that the previously queued GitHub Pages deployment is no longer blocked, captured a fresh live visual smoke set, and fixed the visual comparison helper so future runs can compare capture directories directly instead of requiring callers to point at `manifest.json`.

## Changes

- Updated `scripts/compare-visual-captures.js` so `--baseline` and `--candidate` accept either a manifest file or a capture directory containing `manifest.json`.
- Captured live screenshots for the homepage, projects, blog, CV, Madeira page, and the self-compiling second-brain post in `artifacts/visual-smoke/2026-09-14-live-capacity-burn/`.
- Added this run log with deployment, smoke, and comparison evidence.

## Evidence

Deployment and live checks:

- `gh run list --repo yonatankarp/yonatankarp.github.io --limit 8 --json ...` showed the latest deploy run `34749377646` completed with conclusion `success`.
- `gh run view 34749377646 --repo yonatankarp/yonatankarp.github.io --json ...` showed both `build` and `deploy` jobs completed successfully on September 13, 2026.
- `curl -I -L --max-time 20 https://yonatankarp.com/` returned `HTTP/2 200`; `last-modified: Sun, 13 Sep 2026 09:25:52 GMT`.
- `curl -I -L --max-time 20 https://yonatankarp.com/kotlin-design-patterns/` returned `HTTP/2 200`; confirms the externally managed same-domain path remains reachable.

Validation commands:

```text
node -c scripts/compare-visual-captures.js
npm run check
npm run visual:capture:live -- --out artifacts/visual-smoke/2026-09-14-live-capacity-burn
npm run visual:compare -- --baseline artifacts/visual-smoke/2026-09-13-capacity-burn-final --candidate artifacts/visual-smoke/2026-09-14-live-capacity-burn
```

Results:

- `node -c scripts/compare-visual-captures.js`: passed.
- `npm run check`: passed across 154 generated pages, 97 generated HTML files, 15 blog markdown files, 6 metadata files, CV print length, and internal links.
- `npm run visual:capture:live`: captured 12 screenshots in `artifacts/visual-smoke/2026-09-14-live-capacity-burn/`.
- `npm run visual:compare`: now succeeds when given directories; compared 12 route/viewport pairs, found 11 unchanged, 1 changed, 0 missing or unmatched.
- Drift detail: only `blog::desktop` changed, with `37624/3949920` pixels changed (`0.9525%`), average channel delta `0.0134`, max channel delta `13`.
- Manual review of `home-desktop-2026-09-14.png` and `home-mobile-2026-09-14.png`: no obvious overlap, blank render, broken hero image, or mobile horizontal composition failure.

## Next

Investigate the small live-vs-local `blog::desktop` drift if it repeats in the next capture; likely causes are live image loading, cache timing, or date/order differences rather than a deployment failure.
