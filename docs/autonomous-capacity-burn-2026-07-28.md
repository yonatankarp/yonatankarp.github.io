# Autonomous Capacity Burn - 2026-07-28

Run time: 2026-07-28 11:18:44 CEST

## Scope

Monthly capacity-burn pass focused on keeping the personal website deployable and improving the already-redesigned projects page without disturbing unrelated workspace changes.

## Delivered

1. Verified the nested website repo was clean and up to date with `origin/main` before editing.
2. Ran the full local site gate successfully.
3. Captured before/after visual smoke screenshots for the home, projects, blog, CV, self-compiling-second-brain, and Madeira routes.
4. Polished project list rows so hover/focus no longer shifts row content horizontally and CTA labels read as stable rounded targets.

## Commands

```text
git -C projects/yonatankarp.github.io status --short --branch
git -C projects/yonatankarp.github.io remote -v
npm run check
npm run visual:capture -- --out artifacts/visual-smoke/2026-07-28-before
npm run visual:capture -- --out artifacts/visual-smoke/2026-07-28-after
git diff --stat
```

## Evidence

- `npm run check` passed blog asset references, deterministic Hugo build, site metadata, generated HTML checks, CV print length, and internal links across 94 generated HTML files.
- Before and after visual smoke capture each saved 12 screenshots and passed route, text, image, mobile overflow, mobile nav, and Madeira-specific assertions.
- Manual spot-check of the projects desktop and mobile screenshots found no content overlap or horizontal overflow after the CSS change.

## Files

- `assets/css/custom.css`
- `docs/autonomous-capacity-burn-2026-07-28.md`

## Next

Replace or recapture the weakest remaining project thumbnails with real product-origin screenshots where better source material is available.
