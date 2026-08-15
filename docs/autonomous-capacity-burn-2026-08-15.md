# Autonomous Capacity Burn - 2026-08-15

Monthly autonomous capacity-burn pass focused on keeping `projects/yonatankarp.github.io` deployed-quality and improving the visual QA trail.

## Delivered

- Added a machine-readable `manifest.json` output to `scripts/capture-screenshots.js`.
- Kept the existing screenshot README output, now pointing operators to the JSON manifest.
- Captured a fresh 12-screenshot local visual smoke set in `artifacts/2026-08-15-capacity-burn-visual-smoke/`.

## Evidence

Commands run:

```bash
git status --short --branch
npm run check
SITE_URL=http://127.0.0.1:1313/ npm run visual:capture
npm run visual:capture -- --out artifacts/2026-08-15-capacity-burn-visual-smoke
jq '{date, baseUrl, outputDirectory, serverMode, routes: (.routes|length), viewports: (.viewports|length), files: (.files|length)}' artifacts/2026-08-15-capacity-burn-visual-smoke/manifest.json
```

Results:

- Website repo started clean and aligned with `origin/main`.
- `npm run check` passed: blog assets, Hugo build, production metadata, generated HTML, CV print limit, and internal links.
- The first local visual capture passed and wrote 12 routine ignored screenshots to `artifacts/visual-smoke/2026-08-15/`.
- The first post-edit self-hosting capture failed because a manually started Hugo server was still occupying port `1313`; stopping that server resolved the issue.
- The final visual capture passed and wrote 12 screenshots plus README and JSON manifest to `artifacts/2026-08-15-capacity-burn-visual-smoke/`.
- Manifest sanity check reported 6 routes, 2 viewports, and 12 expected screenshot files.

## Files

- `scripts/capture-screenshots.js`
- `artifacts/2026-08-15-capacity-burn-visual-smoke/README.md`
- `artifacts/2026-08-15-capacity-burn-visual-smoke/manifest.json`
- `artifacts/2026-08-15-capacity-burn-visual-smoke/*.png`

## Next

Use the new manifest as the input contract for a future live-vs-local visual drift comparator, so production checks can report changed routes/files instead of relying only on manual screenshot inspection.
