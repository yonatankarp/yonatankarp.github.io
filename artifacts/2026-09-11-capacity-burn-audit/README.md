# Capacity burn visual QA audit - 2026-09-11

Purpose: validate local and live readiness for `yonatankarp.com`, then fix any material issue found in the visual QA path.

Timezone for run log: Europe/Berlin.

## Outcome

The website build and route smoke checks passed locally and against the live site. The first local/live visual comparison exposed a false drift on the desktop blog screenshot: older below-fold blog thumbnails were present in generated HTML and on the live site, but local full-body screenshots captured the thumbnail fallback background before those progressive JPEGs painted.

I tightened `scripts/capture-screenshots.js` so `waitForPageImages` now:

- forces images to eager loading,
- waits for load/decode,
- scrolls each non-zero-size image into view,
- gives Chromium animation frames before returning to the top for screenshot capture.

The rerun fixed the visible thumbnail mismatch. Remaining local/live visual diffs are small rendering variance, not layout/content drift.

## Evidence

Commands run:

```bash
npm run check
npm run visual:capture -- --out artifacts/2026-09-11-capacity-burn-local
npm run visual:capture:live -- --out artifacts/2026-09-11-capacity-burn-live
npm run visual:compare -- --baseline artifacts/2026-09-11-capacity-burn-local/manifest.json --candidate artifacts/2026-09-11-capacity-burn-live/manifest.json
npm run visual:capture -- --out artifacts/2026-09-11-capacity-burn-local-v2
npm run visual:capture:live -- --out artifacts/2026-09-11-capacity-burn-live-v2
npm run visual:compare -- --baseline artifacts/2026-09-11-capacity-burn-local-v2/manifest.json --candidate artifacts/2026-09-11-capacity-burn-live-v2/manifest.json
```

Key results:

- `npm run check` passed: blog assets, Hugo build, site metadata, generated HTML, CV print, and internal links.
- Initial compare: 12 pairs compared, 11 unchanged, 1 changed; `blog::desktop` had a visible thumbnail paint mismatch.
- Rerun compare after the harness fix: 12 pairs compared, 9 unchanged, 3 changed; all changed pairs were same-dimension small pixel variance.
- Manual screenshot spot-check confirmed local and live desktop blog thumbnails now render the same covers.

Retained capture evidence:

- `artifacts/2026-09-11-capacity-burn-local-v2/`
- `artifacts/2026-09-11-capacity-burn-live-v2/`

Superseded pre-fix captures were moved to `/tmp/openclaw-capacity-burn-2026-09-11/` rather than committed.

## Next

Add a visual compare threshold preset for routine local/live checks so benign antialiasing variance can be treated as pass/fail evidence without manual interpretation.
