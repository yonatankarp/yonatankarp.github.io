# Autonomous Capacity Burn - 2026-07-19

Timezone: Europe/Berlin

## Focus

Continue the `projects/yonatankarp.github.io` redesign hardening after the prior blog-thumbnail polish baseline.

## Delivered

- Confirmed the website repo started clean and synchronized with `origin/main`.
- Audited the prior backlog item for coverless blog thumbnails.
- Found the current article set already has `images.featured_image` for every blog post; only `content/blog/_index.md` lacks one, as expected.
- Hardened the blog list template so future coverless posts still render a stable editorial thumbnail block instead of dropping the visual column.
- Added a generated HTML guard requiring one `.post-row__thumb` per blog `.post-row` across paginated blog index pages.
- Ran the full local release suite successfully.
- Captured a fresh 12-screenshot visual smoke set across desktop and mobile.

## Evidence

- `git status --short --branch`
  - Initial website result: `## main...origin/main`
- `for f in content/blog/*.md; do if ! rg -q "featured_image" "$f"; then basename "$f"; fi; done | wc -l`
  - Result: `1`
- `for f in content/blog/*.md; do if ! rg -q "featured_image" "$f"; then basename "$f"; fi; done | head -30`
  - Result: `_index.md`
- `npm run check`
  - Result: passed.
  - Notes: system `hugo` is absent, so the build used bundled Hugo `v0.160.0`; built 151 pages.
- `npm run visual:capture -- --out artifacts/visual-smoke/2026-07-19`
  - Result: captured 12 screenshots in `artifacts/visual-smoke/2026-07-19/`.
  - Manual spot-check: blog desktop and mobile screenshots render cleanly with stable thumbnail sizing and no visible overlap.

## Changed Files

- `layouts/blog/list.html`
- `assets/css/custom.css`
- `scripts/check-generated-html.js`
- `docs/autonomous-capacity-burn-2026-07-19.md`

## Notes

- This is a future-proofing improvement rather than a visible content change today, because all current blog articles already have curated covers.
- Routine visual smoke screenshots are ignored by git per the repo README. This report records the artifact path instead of committing bulky screenshot files.

## Next

Add a small fixture-style regression path for coverless blog rows, or move to the next visual content gap: curated covers/metadata for any new posts before publication.
