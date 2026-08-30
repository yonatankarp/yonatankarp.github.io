# Autonomous capacity burn - 2026-08-30

Timezone: Europe/Berlin

## Outcome

The personal site is deployable and local output matches the published site across the visual smoke suite after hardening the screenshot helper.

This run found a visual QA false positive: Playwright full-page screenshots could show offscreen lazy blog thumbnails as fallback art even though the image files existed and element-level screenshots rendered them correctly. The capture helper now forces lazy images to eager loading during QA, waits for image decode/load, and screenshots the `body` element instead of using page-level `fullPage` capture. The shipped Hugo markup is unchanged.

## Evidence

- `git status --short --branch`: website repo started clean and synced (`main...origin/main`).
- `npm run check`: passed blog asset references, Hugo production build, metadata validation, generated HTML accessibility/placeholder checks, CV print limit, and internal link checks.
- `npm run visual:capture -- --out artifacts/visual-smoke/2026-08-30-local`: reproduced the false drift, with blog desktop showing unloaded offscreen thumbnails in the local full-page screenshot.
- Direct Playwright DOM probe: affected thumbnail `<img>` elements reported `complete: true`, non-zero natural dimensions, and visible computed styles.
- Direct element screenshots for the affected thumbnails rendered the expected tree and zipper cover art, isolating the failure to the capture primitive.
- `npm run visual:capture -- --out artifacts/visual-smoke/2026-08-30-local-patched`: passed 12 local route/viewport captures with the patched helper.
- `npm run visual:capture:live -- --out artifacts/visual-smoke/2026-08-30-live-patched`: passed 12 live route/viewport captures with the same patched helper.
- `npm run visual:compare -- --baseline artifacts/visual-smoke/2026-08-30-live-patched/manifest.json --candidate artifacts/visual-smoke/2026-08-30-local-patched/manifest.json`: 12 compared, 12 unchanged, 0 changed, 0 missing/unmatched.

## Files changed

- `scripts/capture-screenshots.js`
- `docs/autonomous-capacity-burn-2026-08-30.md`

## Next

The next useful site task remains content freshness: review homepage/CV positioning against Yonatan's current target opportunities and decide whether the contact CTA should stay email-first or point to a more specific conversation path.
