# Autonomous Capacity Burn - 2026-07-20

Timezone: Europe/Berlin

## Focus

Continue hardening `projects/yonatankarp.github.io` after the recent visual redesign work.

## Delivered

- Verified the website repo started clean and synchronized with `origin/main`.
- Ran the full local release check successfully.
- Captured a fresh 12-screenshot visual smoke set for home, projects, blog, CV, the self-compiling second brain post, and the Madeira travel page.
- Found a mobile brand regression in the sticky header: the small-screen CSS hid `Yonatan Karp-Rudin` and left only `Staff Software Engineer` visible.
- Fixed the mobile header so it keeps the name as the first brand signal while tightening both brand lines to preserve space beside the menu button.
- Added a visual-smoke assertion so mobile route captures fail if `Yonatan Karp-Rudin` disappears from the header again.

## Evidence

- `git status --short --branch`
  - Initial website result: `## main...origin/main`
- `npm run check`
  - Result: passed.
  - Notes: system `hugo` is absent, so the build used bundled Hugo `v0.160.0`; built 151 pages.
- `npm run visual:capture -- --out artifacts/visual-smoke/2026-07-20`
  - Result: captured 12 screenshots in `artifacts/visual-smoke/2026-07-20/`.
  - Script assertions covered route responses, visible h1/body content, mobile horizontal overflow, visible image loading, mobile header owner visibility, mobile nav accessibility, and route-specific content counts.
- Manual screenshot spot-check:
  - Before the CSS fix, mobile screenshots showed only `Staff Software Engineer` in the header.
  - After the CSS fix, `Yonatan Karp-Rudin` and `Staff Software Engineer` are both visible on the mobile home and projects screenshots with no scripted overflow failure.

## Changed Files

- `assets/css/custom.css`
- `scripts/capture-screenshots.js`
- `docs/autonomous-capacity-burn-2026-07-20.md`

## Next

Do a focused desktop/mobile content pass on the CV and long-form post pages; they pass checks, but the mobile screenshots are dense enough to merit a typography and scannability review.
