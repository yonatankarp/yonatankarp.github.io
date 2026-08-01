# Autonomous capacity burn - 2026-08-01

Monthly capacity-burn pass focused on keeping `projects/yonatankarp.github.io` deployed-quality and continuing the previous recommendation to improve weak project thumbnails.

## Delivered

- Replaced the weak `sse-mcp-server`, `exekutor`, and `Beat The Machine` project thumbnails with consistent 16:10 project visuals.
- Added `scripts/generate-project-thumbnails.js` so these owned project thumbnails can be regenerated deterministically through Playwright instead of one-off image editing.
- Captured fresh desktop/mobile visual smoke evidence for the changed projects page and the standing route matrix.

## Evidence

- `npm run check`
  - Result: passed.
  - Notes: bundled Hugo `v0.160.0` built 151 pages; generated metadata stayed on `https://yonatankarp.com`; generated HTML checks passed across 94 files; CV print stayed at 2 A4 pages; internal links passed across 94 files.
- `node scripts/generate-project-thumbnails.js`
  - Result: regenerated `assets/images/projects/sse-mcp-server.png`, `assets/images/projects/exekutor.png`, and `assets/images/projects/beat-the-machine.png`.
- `npm run visual:capture -- --out artifacts/2026-08-01-capacity-burn`
  - Result: captured 12 screenshots in `artifacts/2026-08-01-capacity-burn/`.
  - Assertions covered route responses, visible `h1` and body text, mobile overflow, visible image loading, mobile nav accessibility, home proof sections, blog index rows, and Madeira route/day/photo/source content.
- Manual screenshot spot-check:
  - Desktop and mobile projects pages show the three revised project thumbnails with stable crop behavior and a more consistent visual rhythm.

## Files changed

- `assets/images/projects/sse-mcp-server.png`
- `assets/images/projects/exekutor.png`
- `assets/images/projects/beat-the-machine.png`
- `scripts/generate-project-thumbnails.js`
- `docs/autonomous-capacity-burn-2026-08-01.md`

## Next

Replace the remaining low-fidelity legacy game screenshots with source screenshots or documented project archive images, starting with `Larry The Last Zombie` and `Jacob's Choice`.
