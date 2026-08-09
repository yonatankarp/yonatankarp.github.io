# Live deployment drift audit - 2026-08-09

Timezone: Europe/Berlin
Base URL checked: https://yonatankarp.com/

## Focus

Verify that the local visual smoke harness can check the published site directly, then use it against the live GitHub Pages deployment.

## Delivered

- Fixed `scripts/capture-screenshots.js` so the readiness probe supports HTTPS `SITE_URL` and `--base` values.
- Added `npm run visual:capture:live` for one-command live deployment-drift checks.
- Ran the full local deployment-quality check suite after the fix.
- Captured a live 12-screenshot visual smoke set against `https://yonatankarp.com/` in this artifact directory.
- Manually spot-checked the live home desktop, home mobile, and projects mobile screenshots for obvious layout drift.

## Evidence

Commands:

```bash
npm run check
SITE_URL=https://yonatankarp.com/ npm run visual:capture -- --out artifacts/2026-08-09-live-drift-audit
npm run visual:capture:live -- --out artifacts/2026-08-09-live-drift-audit-script
curl -I -L --max-time 20 https://yonatankarp.com/
```

Results:

- Initial live capture failed before the fix with `TypeError [ERR_INVALID_PROTOCOL]: Protocol "https:" not supported. Expected "http:"`.
- Live capture passed after the fix and wrote 12 screenshots for home, projects, blog, CV, the sampled blog post, and Madeira 2026.
- The new `visual:capture:live` wrapper passed and wrote 12 screenshots in `artifacts/2026-08-09-live-drift-audit-script/`.
- `npm run check` passed after the fix.
- Hugo build passed with 151 pages, 116 static files, and 15 processed images.
- Generated site metadata used `https://yonatankarp.com` across 6 public files.
- Generated HTML checks passed across 94 files.
- CV print check passed at 2 A4 pages.
- Internal link check passed across 94 HTML files.
- The published home page returned HTTP 200 from GitHub Pages, with `last-modified: Sat, 08 Aug 2026 09:16:40 GMT`.

## Screenshot review

- `home-desktop-2026-08-09.png`: live homepage keeps the hero, proof, about, work, writing, testimonials, and contact sections visible with no obvious missing media.
- `home-mobile-2026-08-09.png`: live mobile page keeps the header brand, menu button, hero CTA, proof cards, timeline, work cards, testimonials, and contact block readable without horizontal overflow.
- `projects-mobile-2026-08-09.png`: live project cards preserve image aspect ratios, metadata, tags, and CTAs without visible collision.

## Notes

The PNG files remain local evidence and are ignored by git for this live-drift audit because they are routine binary capture output. The durable record is this audit plus the generated `README.md` manifests.

## Next

Use `npm run visual:capture:live -- --out artifacts/<date>-live-drift-audit` after each production deploy, then commit screenshot PNGs only when they document a specific regression or durable design decision.
