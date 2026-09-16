# Autonomous capacity burn - 2026-09-16

Timezone: Europe/Berlin

## Outcome

Verified the personal site after the September 15 baseline promotion, then made a small interaction polish pass on the homepage contact card links. The static layout remains identical to the promoted local baseline after the change.

## Delivered

- Added transition, hover lift, stronger hover shadow, and pressed feedback for the homepage contact email and social link cards in `assets/css/custom.css`.
- Captured fresh local screenshots before and after the contact polish.
- Confirmed the contact section has no desktop/mobile overlap or overflow in the captured home views.

## Evidence

Validation commands:

```text
npm run check
npm run visual:capture -- --out artifacts/visual-smoke/2026-09-16
npm run visual:compare -- --baseline artifacts/2026-09-15-capacity-burn-local --candidate artifacts/visual-smoke/2026-09-16 --fail-on-drift --max-changed-percent 1.0 --max-average-channel-delta 0.02 --max-channel-delta 24
npm run visual:capture -- --out artifacts/visual-smoke/2026-09-16-contact-polish
npm run visual:compare -- --baseline artifacts/2026-09-15-capacity-burn-local --candidate artifacts/visual-smoke/2026-09-16-contact-polish --fail-on-drift --max-changed-percent 1.0 --max-average-channel-delta 0.02 --max-channel-delta 24
```

Results:

- `npm run check`: passed blog asset validation, Hugo production build, site metadata checks, generated HTML checks, CV print check, and internal link check.
- Hugo generated 154 pages; generated HTML checks covered 97 files; CV print remains 2 A4 pages.
- Pre-change visual compare: 12 compared, 11 unchanged, 1 changed, 0 missing, 0 over drift budget. The only drift was `blog::desktop` at 0.9525% changed pixels, average channel delta 0.0134, max channel delta 13.
- Post-change visual compare: 12 compared, 12 unchanged, 0 changed, 0 missing, 0 over drift budget.
- Manual screenshot review: `home-desktop-2026-09-16.png` and `home-mobile-2026-09-16.png` show the contact band fitting cleanly at the footer edge with no text collision or horizontal overflow.

## Files

- Changed: `assets/css/custom.css`
- Run note: `docs/autonomous-capacity-burn-2026-09-16.md`
- Ignored local evidence: `artifacts/visual-smoke/2026-09-16/` and `artifacts/visual-smoke/2026-09-16-contact-polish/`

## Next

Run a production live capture after GitHub Pages deploys the commit, then compare it against `artifacts/2026-09-15-capacity-burn-local`.
