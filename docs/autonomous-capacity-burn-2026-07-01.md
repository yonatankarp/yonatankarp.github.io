# Autonomous Capacity Burn - 2026-07-01

Timezone: Europe/Berlin

## Focus

Follow-up hardening for `projects/yonatankarp.github.io` visual smoke coverage and production metadata safety.

## Delivered

- Fixed the visual smoke script's mobile navigation assertion. It now checks the actual `.menu-toggle` control instead of a stale `.nav-toggle` selector.
- Strengthened the mobile assertion to verify the button is present, visible, at least 36x36px, labeled, initialized with `aria-expanded="false"`, and wired to `#primary-nav`.
- Added `--renderToMemory` to the Hugo server used by `npm run visual:capture`, so local screenshot capture does not rewrite `public/` with localhost production metadata.

## Evidence

- `npm run visual:capture` passed and captured 10 screenshots in `artifacts/visual-smoke/2026-07-01/`.
- `npm run check` passed after visual capture:
  - blog asset references exist across 15 blog markdown files,
  - bundled Hugo `v0.160.0` built 151 pages because system `hugo` is not installed,
  - generated metadata uses `https://yonatankarp.com` across 6 public files,
  - generated HTML accessibility/placeholder checks passed across 93 HTML files,
  - internal link checks passed across 93 HTML files.
- A deliberately parallel first run exposed the prior workflow hazard: `visual:capture` could leave `public/` with `http://localhost:1313` URLs while `check:site-metadata` expected production URLs. The render-to-memory fix removes that mutation path.

## Changed Files

- `scripts/capture-screenshots.js`
- `docs/autonomous-capacity-burn-2026-07-01.md`

## Next

Add a small README or manifest for visual smoke artifacts so ignored screenshot evidence remains easy to interpret by date without promoting routine binary churn into git history.
