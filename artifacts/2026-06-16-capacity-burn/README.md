# Autonomous capacity burn: homepage viewport polish

Date: 2026-06-16
Timezone: Europe/Berlin
Project: `projects/yonatankarp.github.io`

## Finding

The redesigned homepage rendered cleanly, but the hero consumed the full first viewport on both desktop and mobile captures. That made the page feel like a terminal first screen instead of hinting that the proof section continues below.

## Change

- Tightened the homepage hero height, top margin, padding, heading scale, lede scale, and proof-card height on desktop.
- Compacted the mobile hero controls and hid the secondary multiplier panel on small screens, where it duplicated the proof/positioning content and pushed the proof section too far below the fold.
- Preserved the primary hero image, CTA hierarchy, proof cards, and desktop multiplier panel.

## Evidence

Build/check:

```text
npm run check
All blog asset references exist across 15 blog markdown files.
hugo not found globally; bundled .tools/hugo/hugo v0.160.0 built 151 pages successfully.
```

Smoke screenshots captured from the local Hugo server at `http://127.0.0.1:1313/`:

- `home-desktop-final.png` — 1440x1100, proof section label visible at bottom of first viewport.
- `home-mobile-final.png` — 390x1200, proof section heading visible at bottom of first viewport.

Notes:

- Earlier `home-*-after*.png` files are intermediate captures kept because no `trash` helper is available in this environment.
- Chromium logs included Google API registration warnings during headless screenshots; screenshots were still written successfully.
