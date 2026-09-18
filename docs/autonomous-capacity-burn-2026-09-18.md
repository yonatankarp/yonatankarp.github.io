# Autonomous capacity burn - 2026-09-18

Timezone: Europe/Berlin

## Outcome

Polished the blog index scanability by making article effort metadata consistent across the featured post and regular rows.

The featured article now shows publish date, estimated reading time, and word count before the summary. Regular blog rows now include estimated reading time in the same metadata line, so readers can scan recency and effort before opening an article.

## Changes

- Added reading-time calculation to `layouts/blog/list.html` for the featured article and each paginated row.
- Added a `featured-article__meta` style in `assets/css/custom.css` so the new metadata reads as subdued scan text instead of body copy.
- Captured a fresh local visual smoke set after the change.

## Checks run

```text
git status --short --branch
npm run check
npm run visual:capture -- --out artifacts/2026-09-18-capacity-burn-blog-meta
npm run visual:compare -- --baseline artifacts/2026-09-17-capacity-burn-after --candidate artifacts/2026-09-18-capacity-burn-blog-meta
```

## Evidence

- `npm run check`: passed blog asset validation, Hugo production build, site metadata checks, generated HTML checks, CV print check, and internal link check.
- Hugo build generated 154 pages; generated HTML checks covered 97 files; CV print remains 2 A4 pages.
- Visual smoke capture wrote 12 screenshots to `artifacts/2026-09-18-capacity-burn-blog-meta/`.
- Visual comparison against the September 17 post-polish baseline: 12 pairs compared, 9 unchanged, 3 changed, 0 missing or unmatched.
- Expected changed pairs:
  - `blog::desktop`: page height changed from 2743px to 2779px after adding metadata.
  - `blog::mobile`: page height changed from 5429px to 5623px after adding metadata.
  - `projects::desktop`: unchanged dimensions with 0.1436% pixel drift, matching the known local capture variance seen on September 17.

## Files

- `layouts/blog/list.html`
- `assets/css/custom.css`
- `artifacts/2026-09-18-capacity-burn-blog-meta/README.md`
- `artifacts/2026-09-18-capacity-burn-blog-meta/manifest.json`
- `artifacts/2026-09-18-capacity-burn-blog-meta/*.png`

## Next

Run a live capture after GitHub Pages deploys this commit, then compare it against `artifacts/2026-09-18-capacity-burn-blog-meta` to confirm production picked up only the intended blog-index metadata change.
