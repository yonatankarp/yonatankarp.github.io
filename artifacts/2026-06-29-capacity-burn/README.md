# Capacity burn visual polish - 2026-06-29

## Scope

Monthly autonomous capacity-burn pass focused on the personal website redesign.

## Findings

- The site build was healthy via the bundled Hugo binary, but the system `hugo` command is not installed.
- Blog and work-list content was rendering in all caps because `text-transform: uppercase` was applied to broad content containers and inherited by article titles, summaries, project descriptions, and experience copy.
- `scripts/capture-screenshots.js` did not honor `--out` or `--base`, so visual QA could not write directly into dated artifact folders without relying on environment variables and the default `screenshots/` path.

## Changes

- Narrowed the uppercase metadata CSS rule to actual metadata labels.
- Added `--out` and `--base` support to the screenshot capture script.
- Captured desktop and mobile screenshots for home, projects, blog, CV, and the self-compiling second brain post.

## Verification

```bash
npm run check
SITE_URL=http://127.0.0.1:1313/ npm run visual:capture -- --out artifacts/2026-06-29-capacity-burn --base http://127.0.0.1:1313/
```

`npm run check` passed: blog asset references exist, Hugo built 151 pages with the bundled `v0.160.0` binary, and generated metadata uses `https://yonatankarp.com`.

Visual capture produced 10 screenshots in this directory.
