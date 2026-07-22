# Autonomous Capacity Burn - 2026-07-22

Timezone: Europe/Berlin

## Focus

Continue the deployed-quality pass on `projects/yonatankarp.github.io`, starting from the previous recommendation to review project-list image quality and crop consistency on mobile.

## Delivered

- Verified the site repo started clean and synchronized with `origin/main`.
- Ran the full local release check successfully before and after the change.
- Captured a fresh 12-screenshot visual smoke set for home, projects, blog, CV, the self-compiling second brain post, and the Madeira travel page.
- Added generated fallback thumbnails for owned projects that do not yet have preview art, so the projects page keeps a consistent visual rhythm on desktop and mobile.
- Kept the open-source contribution list compact and text-only.

## Evidence

- `git status --short --branch`
  - Initial website result: `## main...origin/main`
- `npm run check`
  - Result before change: passed.
  - Result after change: passed.
  - Notes: system `hugo` is absent, so the build used bundled Hugo `v0.160.0`; built 151 pages.
- `npm run visual:capture -- --out artifacts/visual-smoke/2026-07-22`
  - Result: captured 12 screenshots in `artifacts/visual-smoke/2026-07-22/`.
  - Manual spot-check: `projects-desktop-2026-07-22.png` and `projects-mobile-2026-07-22.png` now show fallback thumbnails for `sse-mcp-server`, `exekutor`, and `Beat The Machine`.

## Changed Files

- `layouts/partials/project-entry.html`
- `assets/css/custom.css`
- `docs/autonomous-capacity-burn-2026-07-22.md`

## Next

Review the individual project image source assets and replace the generated fallbacks with real screenshots or product images for `sse-mcp-server`, `exekutor`, and `Beat The Machine`.
