# Visual Smoke Capture - 2026-07-31

Base URL: http://127.0.0.1:1313/
Output directory: artifacts/2026-07-31-capacity-burn/
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

## Review Notes

- Home, projects, blog, CV, and the sampled blog post render in the dark redesign without obvious overflow, blank asset, or navigation failures at 1440px desktop and 390px mobile.
- The home page keeps the first viewport focused on Yonatan's staff-backend positioning, then exposes proof, about, experience, work, writing, testimonials, and contact without placeholder copy.
- Mobile navigation remains closed by default, keeps the Yonatan Karp-Rudin brand visible, and passes the script's size/label/control assertions.
- The Madeira 2026 page passes structure and asset checks, but it is a separate light standalone microsite rather than part of the dark portfolio visual system. If that page is meant to feel like the main site, align it in a dedicated pass.
- No code or content changes were made during this run because the project checks and visual smoke pass did not expose a material defect worth cosmetic churn.

## Files

- home-desktop-2026-07-31.png
- home-mobile-2026-07-31.png
- projects-desktop-2026-07-31.png
- projects-mobile-2026-07-31.png
- blog-desktop-2026-07-31.png
- blog-mobile-2026-07-31.png
- cv-desktop-2026-07-31.png
- cv-mobile-2026-07-31.png
- post-self-compiling-second-brain-desktop-2026-07-31.png
- post-self-compiling-second-brain-mobile-2026-07-31.png
- madeira-2026-desktop-2026-07-31.png
- madeira-2026-mobile-2026-07-31.png
