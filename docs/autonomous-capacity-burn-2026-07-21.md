# Autonomous Capacity Burn - 2026-07-21

Timezone: Europe/Berlin

## Focus

Continue the deployed-quality pass on `projects/yonatankarp.github.io`, starting from the previous recommendation to review CV and long-form post scannability.

## Delivered

- Verified the site repo started clean and synchronized with `origin/main`.
- Ran the full local release check successfully before and after the change.
- Captured a fresh 12-screenshot visual smoke set for home, projects, blog, CV, the self-compiling second brain post, and the Madeira travel page.
- Tightened narrow-screen article header presentation so long blog titles keep their presence without consuming as much of the first mobile viewport.
- Preserved desktop article layout and CV print behavior.

## Evidence

- `git status --short --branch`
  - Initial website result: `## main...origin/main`
- `npm run check`
  - Result before change: passed.
  - Result after change: passed.
  - Notes: system `hugo` is absent, so the build used bundled Hugo `v0.160.0`; built 151 pages.
- `npm run visual:capture -- --out artifacts/visual-smoke/2026-07-21`
  - Result: captured 12 screenshots in `artifacts/visual-smoke/2026-07-21/`.
  - Script assertions covered route responses, visible h1/body content, mobile horizontal overflow, visible image loading, mobile header owner visibility, mobile nav accessibility, and route-specific content counts.
- Manual screenshot spot-check:
  - The long-form article mobile hero now uses a smaller balanced title scale, tighter header spacing, compact metadata/chip gaps, and a denser table of contents.
  - Desktop article framing remained visually stable after the mobile-only CSS change.

## Changed Files

- `assets/css/custom.css`
- `docs/autonomous-capacity-burn-2026-07-21.md`
- `artifacts/visual-smoke/2026-07-21/`

## Next

Review project-list image quality and crop consistency on mobile; several cards are functional but still vary noticeably in visual density and polish.
