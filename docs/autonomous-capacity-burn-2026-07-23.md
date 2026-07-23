# Autonomous Capacity Burn - 2026-07-23

Timezone: Europe/Berlin

## Focus

Continue the deployed-quality personal website pass from the previous recommendation: replace generated fallback project thumbnails with real project-origin screenshots or product images where safe.

## Delivered

- Verified the nested website repo started clean and synchronized with `origin/main`.
- Replaced the generated fallback thumbnails for `sse-mcp-server`, `exekutor`, and `Beat The Machine` with real assets from their public project repositories.
- Hardened `npm run visual:capture` so Playwright navigates on `domcontentloaded`, then waits briefly for `networkidle` as a best-effort stabilization step before the existing page/image assertions. This avoids flaky full-run failures when late network idle does not arrive, while still failing on bad HTTP responses, broken page basics, mobile overflow, or broken visible images.
- Captured a fresh 12-screenshot visual smoke set and manually spot-checked the projects desktop/mobile captures.

## Evidence

- `git ls-remote https://github.com/yonatankarp/sse-mcp-server.git HEAD`
  - Result: readable at `6dbb49fbc8705dcb8333412d02661e3c3544b40b`.
- `git ls-remote https://github.com/yonatankarp/exekutor.git HEAD`
  - Result: readable at `a81efb09debd7e90f33b9f52786c4406ce0601d1`.
- `git ls-remote https://github.com/yonatankarp/beat-the-machine-ddd.git HEAD`
  - Result: readable at `288a6afd2ceb5bfb5a8a62b9bc41d647cee85a57`.
- `npm run check`
  - Result: passed.
  - Notes: system `hugo` is absent, so the build used bundled Hugo `v0.160.0`; built 151 pages and processed 11 images.
- `npm run visual:capture -- --out artifacts/visual-smoke/2026-07-23`
  - Initial result before harness patch: failed twice on hard `networkidle` navigation timeouts after partial screenshots were written.
  - Result after harness patch: captured 12 screenshots in `artifacts/visual-smoke/2026-07-23/`.
- Manual screenshot spot-check:
  - `projects-desktop-2026-07-23.png` shows real thumbnails for `sse-mcp-server`, `exekutor`, and `Beat The Machine`.
  - `projects-mobile-2026-07-23.png` keeps the project list readable with no obvious overlap or broken images.

## Changed Files

- `assets/images/projects/sse-mcp-server.png`
- `assets/images/projects/exekutor.png`
- `assets/images/projects/beat-the-machine.png`
- `scripts/capture-screenshots.js`
- `docs/autonomous-capacity-burn-2026-07-23.md`

## Next

Run a live-site deployment confirmation after this commit lands, then compare the published `/projects/` page against the local visual smoke capture for published-vs-local drift.
