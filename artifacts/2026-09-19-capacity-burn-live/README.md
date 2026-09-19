# Visual Smoke Capture - 2026-09-19

Base URL: https://yonatankarp.com/
Output directory: artifacts/2026-09-19-capacity-burn-live/
Server mode: existing server

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

- home-desktop-2026-09-19.png
- home-mobile-2026-09-19.png
- projects-desktop-2026-09-19.png
- projects-mobile-2026-09-19.png
- blog-desktop-2026-09-19.png
- blog-mobile-2026-09-19.png
- cv-desktop-2026-09-19.png
- cv-mobile-2026-09-19.png
- post-self-compiling-second-brain-desktop-2026-09-19.png
- post-self-compiling-second-brain-mobile-2026-09-19.png
- madeira-2026-desktop-2026-09-19.png
- madeira-2026-mobile-2026-09-19.png

Machine-readable capture details are available in `manifest.json`.

## Baseline comparison

Compared against `artifacts/2026-09-18-capacity-burn-blog-meta` after the
September 18 blog metadata polish.

- Compared pairs: 12
- Unchanged: 11
- Changed: 1
- Missing or unmatched: 0

Changed pair:

- `blog::mobile`: same dimensions; 131637/2192970 px changed, 6.0027%, average
  channel delta 0.0739, max channel delta 20.

Manual inspection of the baseline and live mobile blog screenshots found the
same layout, content order, metadata, pagination, search, tags, reading tracks,
and footer. The diff appears to be rendering/rasterization variance rather than
a production layout regression.
