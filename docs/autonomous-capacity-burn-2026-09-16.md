# Autonomous capacity burn - 2026-09-16

Timezone: Europe/Berlin

## Outcome

Verified the personal site after the September 15 baseline promotion, then made a small interaction polish pass on the homepage contact card links. The static layout remains identical to the promoted local baseline after the change.

## Delivered

- Added transition, hover lift, stronger hover shadow, and pressed feedback for the homepage contact email and social link cards in `assets/css/custom.css`.
- Captured fresh local screenshots before and after the contact polish, then captured production after the GitHub Pages deployment.
- Confirmed the contact section has no desktop/mobile overlap or overflow in the captured home views.

## Evidence

Validation commands:

```text
npm run check
npm run visual:capture -- --out artifacts/visual-smoke/2026-09-16
npm run visual:compare -- --baseline artifacts/2026-09-15-capacity-burn-local --candidate artifacts/visual-smoke/2026-09-16 --fail-on-drift --max-changed-percent 1.0 --max-average-channel-delta 0.02 --max-channel-delta 24
npm run visual:capture -- --out artifacts/visual-smoke/2026-09-16-contact-polish
npm run visual:compare -- --baseline artifacts/2026-09-15-capacity-burn-local --candidate artifacts/visual-smoke/2026-09-16-contact-polish --fail-on-drift --max-changed-percent 1.0 --max-average-channel-delta 0.02 --max-channel-delta 24
gh run watch 35078546829 --exit-status
npm run visual:capture:live -- --out artifacts/visual-smoke/2026-09-16-live
npm run visual:compare -- --baseline artifacts/2026-09-15-capacity-burn-local --candidate artifacts/visual-smoke/2026-09-16-live --fail-on-drift --max-changed-percent 1.0 --max-average-channel-delta 0.02 --max-channel-delta 24
```

Results:

- `npm run check`: passed blog asset validation, Hugo production build, site metadata checks, generated HTML checks, CV print check, and internal link check.
- Hugo generated 154 pages; generated HTML checks covered 97 files; CV print remains 2 A4 pages.
- Pre-change visual compare: 12 compared, 11 unchanged, 1 changed, 0 missing, 0 over drift budget. The only drift was `blog::desktop` at 0.9525% changed pixels, average channel delta 0.0134, max channel delta 13.
- Post-change visual compare: 12 compared, 12 unchanged, 0 changed, 0 missing, 0 over drift budget.
- GitHub Pages workflow `35078546829` for commit `22ee826` completed successfully: build passed in 2m05s and deploy passed in 9s.
- Live production visual compare: 12 compared, 12 unchanged, 0 changed, 0 missing, 0 over drift budget.
- Manual screenshot review: `home-desktop-2026-09-16.png` and `home-mobile-2026-09-16.png` show the contact band fitting cleanly at the footer edge with no text collision or horizontal overflow.

## Files

- Changed: `assets/css/custom.css`
- Run note: `docs/autonomous-capacity-burn-2026-09-16.md`
- Ignored local evidence: `artifacts/visual-smoke/2026-09-16/`, `artifacts/visual-smoke/2026-09-16-contact-polish/`, and `artifacts/visual-smoke/2026-09-16-live/`

## Next

Review the blog index typography and image rhythm; it is stable under the baseline budget, but it is now the only page that showed natural pre-change pixel drift.
