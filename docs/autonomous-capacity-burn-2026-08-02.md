# Autonomous capacity burn - 2026-08-02

Timezone: Europe/Berlin

## Focus

Continue the website visual-polish backlog after the 2026-08-01 thumbnail pass. The next useful item was replacing the weakest remaining legacy game thumbnails, starting with `Larry The Last Zombie` and `Jacob's Choice`.

## Delivered

- Extended the reproducible project thumbnail generator to cover `larry-the-last-zombie` and `jacobs-choice`.
- Generated new 16:10 PNG thumbnails for both game projects so the projects list no longer falls back to visibly lower-fidelity legacy screenshots.
- Captured a fresh 12-screenshot visual smoke set in `artifacts/2026-08-02-capacity-burn/`.

## Evidence

Commands:

```bash
npm run check
npm run visual:capture
npm run project-thumbnails:generate
npm run check
npm run visual:capture -- --out artifacts/2026-08-02-capacity-burn
```

Results:

- `npm run check` passed before and after the thumbnail change.
- Hugo build passed with 151 pages, 116 static files, and 11 processed images after the change.
- Generated HTML checks passed across 94 files.
- CV print check passed at 2 A4 pages.
- Internal link check passed across 94 HTML files; external probing was skipped by the repo's default check.
- Visual capture passed and wrote 12 screenshots for home, projects, blog, CV, the sampled blog post, and Madeira 2026.

Manual screenshot spot-check:

- `artifacts/2026-08-02-capacity-burn/projects-desktop-2026-08-02.png`
- `artifacts/2026-08-02-capacity-burn/projects-mobile-2026-08-02.png`

Both show `Larry The Last Zombie` and `Jacob's Choice` with stable generated thumbnails, matching the rhythm of the other recently generated project visuals without mobile overflow or row overlap.

## Files

- `scripts/generate-project-thumbnails.js`
- `assets/images/projects/larry-the-last-zombie.png`
- `assets/images/projects/jacobs-choice.png`
- `artifacts/2026-08-02-capacity-burn/`
- `docs/autonomous-capacity-burn-2026-08-02.md`

## Next

Check whether any project thumbnails still have better source-origin media available than generated previews, then move to live published-vs-local screenshot drift if the project list is good enough.
