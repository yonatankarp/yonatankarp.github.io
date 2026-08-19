# Capacity Burn Visual Smoke Audit - 2026-08-19

Timezone for this audit: Europe/Berlin.

## Outcome

The local Hugo site is deployable-quality based on the current automated checks and
manual screenshot inspection. No production code/content changes were needed.

## Checks Run

- `npm run check`
  - Blog asset references exist across 15 markdown files.
  - Hugo production build passed with 153 pages, 116 static files, and 15 processed images.
  - Generated site metadata uses `https://yonatankarp.com` across 6 public files.
  - Generated HTML accessibility/placeholder checks passed across 96 files.
  - CV print check passed at 2 A4 pages.
  - Internal link check passed across 96 HTML files; external probing skipped.
- `npm run visual:capture`
  - Captured 12 screenshots across 6 routes and 2 viewports.
  - All built-in visual smoke assertions passed.
- `npm run visual:compare -- --baseline artifacts/2026-08-16-capacity-burn-visual-smoke/manifest.json --candidate artifacts/2026-08-19-capacity-burn/manifest.json`
  - Compared pairs: 12.
  - Unchanged: 11.
  - Changed: 1.
  - Missing or unmatched: 0.
  - Changed pair: `blog::desktop`, same dimensions, 37,648/3,949,920 pixels changed,
    0.9531%, average channel delta 1.1087, max channel delta 231.

## Manual Inspection Notes

- Home desktop: hero, proof sections, selected work, writing, testimonials, and contact
  section render without obvious overlap or blank media.
- Home mobile: navigation and stacked content remain readable; no visible horizontal
  overflow in the captured viewport.
- Madeira mobile: dense itinerary content, source panels, and photo cards render in a
  single-column flow without obvious layout breakage.

Base URL: http://127.0.0.1:1313/
Output directory: artifacts/visual-smoke/2026-08-19/
Server mode: local Hugo server with --renderToMemory

## Routes

- home: /
- projects: /projects/
- blog: /blog/
- cv: /cv/
- post-self-compiling-second-brain: /blog/self-compiling-second-brain/
- madeira-2026: /madeira-2026/

## Viewports

- desktop: 1440x1100
- mobile: 390x1200

## Assertions

- HTTP response succeeds for every captured route.
- Each page renders a visible h1 and at least 200 characters of body text.
- Mobile pages do not horizontally overflow the viewport.
- Visible images are loaded with non-zero natural dimensions.
- Mobile header keeps Yonatan Karp-Rudin visible as the brand signal.
- Mobile navigation button is visible, at least 36x36px, labeled, closed by default, and wired to #primary-nav.
- Home page contains the hero and proof sections.
- Blog index contains multiple article rows/cards.
- Standalone Madeira page contains route cards, daily itinerary sections, photos, and source panels.

## Files

- home-desktop-2026-08-19.png
- home-mobile-2026-08-19.png
- projects-desktop-2026-08-19.png
- projects-mobile-2026-08-19.png
- blog-desktop-2026-08-19.png
- blog-mobile-2026-08-19.png
- cv-desktop-2026-08-19.png
- cv-mobile-2026-08-19.png
- post-self-compiling-second-brain-desktop-2026-08-19.png
- post-self-compiling-second-brain-mobile-2026-08-19.png
- madeira-2026-desktop-2026-08-19.png
- madeira-2026-mobile-2026-08-19.png

Machine-readable capture details are available in `manifest.json`.
