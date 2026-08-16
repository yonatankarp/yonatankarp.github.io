# Autonomous Capacity Burn - 2026-08-16

Monthly autonomous capacity-burn pass focused on `projects/yonatankarp.github.io` visual QA reliability.

## Delivered

- Hardened `scripts/capture-screenshots.js` against local Hugo port collisions.
- Added `--port` parsing and validation for local visual captures.
- Preserved `SITE_URL` and `--base` behavior for existing-server and live capture modes.
- Captured a fresh 12-screenshot local visual smoke set in `artifacts/2026-08-16-capacity-burn-visual-smoke/`.

## Evidence

Commands run:

```bash
git status --short --branch
npm run check
npm run visual:capture -- --out artifacts/2026-08-16-capacity-burn-visual-smoke
jq '{date, baseUrl, outputDirectory, serverMode, routes: (.routes|length), viewports: (.viewports|length), files: (.files|length)}' artifacts/2026-08-16-capacity-burn-visual-smoke/manifest.json
```

Collision check:

```bash
node -e 'require("http").createServer((req,res)=>res.end("occupied")).listen(1313,"127.0.0.1",()=>setInterval(()=>{},1000))'
npm run visual:capture -- --out artifacts/2026-08-16-capacity-burn-visual-smoke
```

Results:

- Website repo started clean and aligned with `origin/main`.
- `npm run check` passed: blog assets, Hugo build, production metadata, generated HTML, CV print limit, and internal links.
- With port `1313` deliberately occupied, visual capture selected `http://127.0.0.1:1314/`.
- Final visual smoke capture passed and wrote 12 screenshots plus README and JSON manifest.
- Manifest sanity check reported 6 routes, 2 viewports, and 12 screenshot files.

## Files

- `scripts/capture-screenshots.js`
- `artifacts/2026-08-16-capacity-burn-visual-smoke/README.md`
- `artifacts/2026-08-16-capacity-burn-visual-smoke/manifest.json`
- `artifacts/2026-08-16-capacity-burn-visual-smoke/*.png`

## Next

Add a manifest-driven live-vs-local visual drift comparator so future production checks can report changed route/viewport pairs directly.
