# Autonomous capacity burn - 2026-09-19

Timezone: Europe/Berlin

## Outcome

Verified the live `yonatankarp.com` deployment against the latest local visual
baseline from the September 18 blog metadata polish. Production is serving the
expected redesigned site across the smoke routes.

## Checks run

```text
git status --short --branch
git log --oneline --decorate --max-count=5
git remote -v
npm run check
npm run visual:capture:live -- --out artifacts/2026-09-19-capacity-burn-live
npm run visual:compare -- --baseline artifacts/2026-09-18-capacity-burn-blog-meta --candidate artifacts/2026-09-19-capacity-burn-live
```

## Evidence

- `npm run check`: passed blog asset validation, Hugo production build, site
  metadata checks, generated HTML checks, CV print check, and internal link
  check.
- Hugo build generated 154 pages; generated HTML checks covered 97 files; CV
  print remains 2 A4 pages.
- Live visual smoke capture wrote 12 screenshots to
  `artifacts/2026-09-19-capacity-burn-live/`.
- Visual comparison against `artifacts/2026-09-18-capacity-burn-blog-meta`:
  12 pairs compared, 11 unchanged, 1 changed, 0 missing or unmatched.
- The single changed pair was `blog::mobile`, with the same dimensions and a
  low average channel delta. Manual screenshot inspection found no content,
  ordering, overflow, or layout regression.
- The nested website repo was clean before the run and `main` matched
  `origin/main` at `c232706` before this evidence commit.

## Files

- `artifacts/2026-09-19-capacity-burn-live/README.md`
- `artifacts/2026-09-19-capacity-burn-live/manifest.json`
- `artifacts/2026-09-19-capacity-burn-live/*.png`
- `docs/autonomous-capacity-burn-2026-09-19.md`

## Next

Continue with a targeted content polish pass on the project detail pages; the
visual deployment path is verified, so the next leverage is substance and
scannability rather than deploy/auth repair.
