# Autonomous capacity burn - 2026-08-03

Timezone: Europe/Berlin

## Focus

Continue the website visual-polish backlog after the 2026-08-02 project-thumbnail pass. The remaining material issue on the projects index was the open-source contribution section: four contribution rows still rendered as text-only entries while the main project list had consistent preview media.

## Delivered

- Extended `scripts/generate-project-thumbnails.js` with contribution thumbnails for `ff4j`, `Konsist`, `openapi-generator`, and `java-design-patterns`.
- Generated four new 16:10 PNG preview assets under `assets/images/projects/`.
- Wired the open-source contribution list to the same media-aware project-entry partial as the main project list.
- Captured a fresh 12-screenshot visual smoke set in `artifacts/2026-08-03-capacity-burn/`.

## Evidence

Commands:

```bash
npm run project-thumbnails:generate
npm run check
npm run visual:capture -- --out artifacts/2026-08-03-capacity-burn
```

Results:

- Thumbnail generation completed for nine generated project previews, including the four new contribution assets.
- `npm run check` passed.
- Hugo build passed with 151 pages, 116 static files, and 15 processed images after wiring contribution media.
- Generated HTML checks passed across 94 files.
- CV print check passed at 2 A4 pages.
- Internal link check passed across 94 HTML files; external probing was skipped by the repo's default check.
- Visual capture passed and wrote 12 screenshots for home, projects, blog, CV, the sampled blog post, and Madeira 2026.

Manual screenshot spot-check:

- `artifacts/2026-08-03-capacity-burn/projects-desktop-2026-08-03.png`
- `artifacts/2026-08-03-capacity-burn/projects-mobile-2026-08-03.png`

Both show the open-source contribution section using stable thumbnails without mobile overflow or row overlap.

## Files

- `scripts/generate-project-thumbnails.js`
- `layouts/projects/list.html`
- `assets/images/projects/ff4j.png`
- `assets/images/projects/konsist.png`
- `assets/images/projects/openapi-generator.png`
- `assets/images/projects/java-design-patterns.png`
- `artifacts/2026-08-03-capacity-burn/`
- `docs/autonomous-capacity-burn-2026-08-03.md`

## Next

Compare the published site against the local build and resolve any deployment drift now that the project media polish pass is complete.
