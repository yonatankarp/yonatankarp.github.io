# Autonomous capacity burn - 2026-09-15

Timezone: Europe/Berlin

## Outcome

Verified the personal site remains build-clean after the September 13-14 content and visual-tooling changes, captured fresh local and live visual smoke sets, checked the current layout against the latest curated local baseline, promoted the reviewed September 15 capture as the new local baseline, and confirmed production matches it.

No code or content polish was made in this run. The only new issue is expected baseline drift on the homepage and projects page after the Kotlin Design Patterns project copy was strengthened on September 13. The drift is geometric but small: the affected pages are 24-55 px taller, with no capture assertion failures, no mobile horizontal overflow, and no obvious manual-review defect in the homepage screenshot.

## Evidence

Repository state:

- `git status --short --branch`: `main...origin/main`, clean at start.
- `git remote -v`: `origin` uses `https://github.com/yonatankarp/yonatankarp.github.io.git`.
- Recent commits after the September 12 local baseline: `7868195` strengthened Kotlin Design Patterns project signal; `cb09999` recorded queued Pages state; `dafd884` allowed capture directories in visual compare.

Validation commands:

```text
npm run check
npm run visual:capture -- --out artifacts/visual-smoke/2026-09-15
npm run visual:compare -- --baseline artifacts/2026-09-12-capacity-burn-local/manifest.json --candidate artifacts/visual-smoke/2026-09-15/manifest.json --fail-on-drift --max-changed-percent 1.0 --max-average-channel-delta 0.01 --max-channel-delta 24
npm run visual:compare -- --baseline artifacts/2026-09-15-capacity-burn-local --candidate artifacts/visual-smoke/2026-09-15
npm run visual:capture:live -- --out artifacts/visual-smoke/2026-09-15-live
npm run visual:compare -- --baseline artifacts/2026-09-15-capacity-burn-local --candidate artifacts/visual-smoke/2026-09-15-live --fail-on-drift --max-changed-percent 1.0 --max-average-channel-delta 0.02 --max-channel-delta 24
```

Results:

- `npm run check`: passed blog asset validation, Hugo production build, site metadata, generated HTML checks, CV print check, and internal link check.
- Hugo build generated 154 pages; generated HTML checks covered 97 files; CV print remains 2 A4 pages.
- `npm run visual:capture`: captured 12 screenshots in `artifacts/visual-smoke/2026-09-15/`.
- Visual smoke assertions passed for route responses, visible `h1`, body text floor, mobile overflow, visible images, mobile header/nav, home/blog landmarks, and Madeira page landmarks.
- `npm run visual:compare`: compared 12 route/viewport pairs against `artifacts/2026-09-12-capacity-burn-local/manifest.json`; 8 unchanged, 4 changed, 0 missing or unmatched.
- Changed pairs: `home::desktop` 1440x8269 -> 1440x8296, `home::mobile` 390x12822 -> 390x12877, `projects::desktop` 1440x4512 -> 1440x4536, `projects::mobile` 390x8236 -> 390x8284.
- Manual review of `artifacts/visual-smoke/2026-09-15/home-desktop-2026-09-15.png`: no obvious overlap, blank render, broken hero image, unreadable card, or footer/contact collapse.
- Promoted baseline check: comparing `artifacts/2026-09-15-capacity-burn-local` back to `artifacts/visual-smoke/2026-09-15` reported 12 compared, 12 unchanged, 0 changed, 0 missing or unmatched.
- GitHub Pages workflow `34951808828` for commit `5df882c` completed successfully: build passed in 59s and deploy passed in 9s.
- Live capture: `npm run visual:capture:live -- --out artifacts/visual-smoke/2026-09-15-live` captured 12 screenshots from `https://yonatankarp.com/`.
- Live-vs-local comparison: 12 compared, 12 unchanged, 0 changed, 0 missing or unmatched, 0 over drift budget.

## Files

- Run note: `docs/autonomous-capacity-burn-2026-09-15.md`
- Curated local baseline manifest: `artifacts/2026-09-15-capacity-burn-local/manifest.json`
- Curated local baseline README: `artifacts/2026-09-15-capacity-burn-local/README.md`
- Fresh local visual manifest: `artifacts/visual-smoke/2026-09-15/manifest.json`
- Fresh local screenshots: `artifacts/visual-smoke/2026-09-15/*.png`
- Fresh live visual manifest: `artifacts/visual-smoke/2026-09-15-live/manifest.json`
- Fresh live screenshots: `artifacts/visual-smoke/2026-09-15-live/*.png`

## Next

For the next website capacity burn, review homepage/contact positioning rather than visual stability; the current production deployment is build-clean and visually identical to the promoted baseline.
