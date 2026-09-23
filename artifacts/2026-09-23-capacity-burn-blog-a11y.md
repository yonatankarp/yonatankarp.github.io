# Capacity Burn Blog Accessibility Polish - 2026-09-23

Timezone: Europe/Berlin

## Scope

Autonomous capacity-burn pass focused on the next recommended work from the 2026-09-17 visual-polish artifact: audit the blog index and post templates for scanability and polish.

## Findings

1. The site repository was clean and aligned with `origin/main` before edits.
2. `npm run check` passed before changes, including the Hugo build, generated HTML checks, metadata checks, CV print check, and internal link check.
3. The blog sidebar search field used placeholder text as its only visible programmatic name. Placeholders are not a reliable label, and the input had no stable id for direct association.
4. The blog and article templates otherwise already had good scanability primitives: reading time, word counts, tags, thumbnails/fallbacks, table of contents, share actions, and related posts.

## Changes

- Added a reusable `.sr-only` utility beside the existing skip-link accessibility styles.
- Added an explicit hidden `<label>` and stable `id="blog-search"` to the blog sidebar search input.
- Captured a fresh visual smoke set after the CSS/template change.

## Checks Run

- `git status --short --branch`
- `git -C projects/yonatankarp.github.io status --short --branch`
- `npm run check`
- `npm run visual:capture -- --out artifacts/2026-09-23-capacity-burn-blog-a11y`
- `rg -n "blog-search|sr-only" public/blog/index.html public/css -S`
- `git diff -- assets/css/custom.css layouts/blog/list.html`

## Evidence

- Generated HTML contains `<label class=sr-only for=blog-search>Search articles</label>` before the search input.
- Visual smoke capture produced 12 screenshots across home, projects, blog, CV, the self-compiling Second Brain article, and Madeira 2026 at desktop and mobile sizes.
- Screenshot manifest: `artifacts/2026-09-23-capacity-burn-blog-a11y/manifest.json`
- Screenshot README: `artifacts/2026-09-23-capacity-burn-blog-a11y/README.md`

## Next Recommended Work

Run a production visual capture after this commit is deployed, then compare it against `artifacts/2026-09-23-capacity-burn-blog-a11y/` to verify the live site matches the local smoke evidence.
