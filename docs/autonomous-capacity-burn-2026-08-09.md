# Autonomous capacity burn - 2026-08-09

Timezone: Europe/Berlin

## Focus

Continue the deployed-quality website track by checking the published site directly, starting from the previous recommendation to compare live rendering against local smoke evidence.

## Delivered

- Fixed the visual smoke helper's readiness probe so HTTPS live-site captures work.
- Added `npm run visual:capture:live` for one-command published-site drift checks.
- Ran the full local website check suite after the fix.
- Captured a live 12-screenshot visual smoke set against `https://yonatankarp.com/`.
- Saved a durable live-drift audit under `artifacts/2026-08-09-live-drift-audit/audit.md`.

## Evidence

Commands:

```bash
git -C /home/yonatan/.openclaw/workspace/projects/yonatankarp.github.io status --short --branch
npm run check
SITE_URL=https://yonatankarp.com/ npm run visual:capture -- --out artifacts/2026-08-09-live-drift-audit
npm run visual:capture:live -- --out artifacts/2026-08-09-live-drift-audit-script
curl -I -L --max-time 20 https://yonatankarp.com/
```

Results:

- Website repo started clean and aligned with `origin/main`.
- The first live visual capture exposed a real bug: the helper used Node's `http` client for all readiness checks and failed on `https://yonatankarp.com/`.
- After the fix, live visual capture passed and wrote 12 screenshots in `artifacts/2026-08-09-live-drift-audit/`.
- The new `visual:capture:live` wrapper also passed and wrote 12 screenshots in `artifacts/2026-08-09-live-drift-audit-script/`.
- `npm run check` passed.
- Hugo build passed with 151 pages, 116 static files, and 15 processed images.
- Generated HTML checks passed across 94 files.
- CV print check passed at 2 A4 pages.
- Internal link check passed across 94 HTML files.
- Published home page returned HTTP 200 from GitHub Pages, with `last-modified: Sat, 08 Aug 2026 09:16:40 GMT`.

## Files

- `.gitignore`
- `README.md`
- `package.json`
- `scripts/capture-screenshots.js`
- `artifacts/2026-08-09-live-drift-audit/README.md`
- `artifacts/2026-08-09-live-drift-audit/audit.md`
- `artifacts/2026-08-09-live-drift-audit-script/README.md`
- `docs/autonomous-capacity-burn-2026-08-09.md`

## Next

Use `npm run visual:capture:live -- --out artifacts/<date>-live-drift-audit` after each production deploy, then only commit screenshot PNGs when they document a specific regression or durable design decision.
