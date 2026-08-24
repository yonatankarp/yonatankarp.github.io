# Visual Smoke Capture - 2026-08-24

Base URL: http://127.0.0.1:1313/
Output directory: artifacts/2026-08-24-capacity-burn-local/
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

- home-desktop-2026-08-24.png
- home-mobile-2026-08-24.png
- projects-desktop-2026-08-24.png
- projects-mobile-2026-08-24.png
- blog-desktop-2026-08-24.png
- blog-mobile-2026-08-24.png
- cv-desktop-2026-08-24.png
- cv-mobile-2026-08-24.png
- post-self-compiling-second-brain-desktop-2026-08-24.png
- post-self-compiling-second-brain-mobile-2026-08-24.png
- madeira-2026-desktop-2026-08-24.png
- madeira-2026-mobile-2026-08-24.png

Machine-readable capture details are available in `manifest.json`.

## Capacity-Burn Audit

Timezone: Europe/Berlin

Outcome: deployable-quality verification, no source polish needed.

### Findings

- Full local validation passed: blog asset references, Hugo build, generated metadata, generated HTML checks, CV print page-count check, and internal link check all completed successfully.
- Local visual smoke passed across 6 routes and 2 viewports, covering home, projects, blog, CV, a long-form post, and the Madeira standalone page.
- Local capture compared against `artifacts/visual-smoke/2026-08-23-capacity-burn/manifest.json`: 11 of 12 pairs were unchanged. The only changed pair was `projects::desktop`, with 0.0452% changed pixels; this exceeded only the strict max-channel budget, not changed-pixel or average-channel budgets.
- Live visual smoke also passed against `https://yonatankarp.com/` in `artifacts/2026-08-24-capacity-burn-live/`.
- Local-to-live visual comparison stayed inside the practical drift budget: 10 unchanged pairs, 2 tiny changed pairs, 0 over budget. Manual review of home and projects desktop/mobile screenshots found no overflow, broken thumbnail, CTA, header, or footer defect.

### Commands

- `npm run check`
- `npm run visual:capture -- --out artifacts/2026-08-24-capacity-burn-local`
- `npm run visual:capture -- --base https://yonatankarp.com/ --out artifacts/2026-08-24-capacity-burn-live`
- `npm run visual:compare -- --baseline artifacts/visual-smoke/2026-08-23-capacity-burn/manifest.json --candidate artifacts/2026-08-24-capacity-burn-local/manifest.json --fail-on-drift --max-changed-percent 0.5 --max-average-channel-delta 1 --max-channel-delta 8`
- `npm run visual:compare -- --baseline artifacts/2026-08-24-capacity-burn-local/manifest.json --candidate artifacts/2026-08-24-capacity-burn-live/manifest.json --fail-on-drift --max-changed-percent 1 --max-average-channel-delta 2 --max-channel-delta 32`
- `gh auth status`

### Next

The next useful website task is content-level: update homepage positioning and contact CTA strategy if Yonatan wants the site to optimize for recruiter outreach, consulting leads, or personal technical authority.
