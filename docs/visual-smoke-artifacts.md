# Visual Smoke Artifacts

`npm run visual:capture` records local screenshot evidence under `artifacts/visual-smoke/<date>/`.
That directory is git-ignored because routine captures are binary churn, but each capture now includes a local
`README.md` manifest beside the PNG files.

## What Gets Captured

- Routes: `/`, `/projects/`, `/blog/`, `/cv/`, `/blog/self-compiling-second-brain/`, and `/madeira-2026/`.
- Viewports: desktop `1440x1100` and mobile `390x1200`.
- Files: `<route>-<viewport>-<YYYY-MM-DD>.png`.

## What The Script Verifies

- Every route returns a successful HTTP response.
- Every page renders a visible `h1` and substantial body text.
- Mobile pages avoid horizontal overflow.
- Visible images are loaded and have non-zero natural dimensions.
- The mobile menu button is visible, accessible, closed by default, and wired to `#primary-nav`.
- The home page keeps its hero and proof sections.
- The blog index renders multiple article rows/cards.
- The standalone Madeira page keeps route guide cards, itinerary day sections, visible photos, and source panels.

## Operational Notes

- Without `--base` or `SITE_URL`, the helper starts the bundled/local Hugo server with `--renderToMemory`.
- `--renderToMemory` prevents visual capture from rewriting `public/` with localhost metadata.
- Keep per-run human notes in the relevant `docs/autonomous-capacity-burn-*.md` report when a capture supports a design change.
- Promote a screenshot into tracked git history only when it documents a specific durable decision or regression example.
