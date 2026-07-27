# Autonomous Capacity Burn - 2026-07-27

Run time: 2026-07-27 11:12:48 CEST

## Scope

Monthly capacity-burn pass focused on keeping the personal website's local automation clean and deterministic after repeated notes that the system `hugo` binary is absent.

## Delivered

1. Replaced the noisy `hugo || .tools/hugo/hugo` npm fallback with a small Node runner that selects the pinned local Hugo binary first when present.
2. Routed `npm run build`, `npm run build:local`, `npm run serve`, and `npm run serve:local` through the same runner so local commands behave consistently.
3. Updated the README quick-start wording to match the pinned-local-Hugo behavior.

## Commands

```text
git status --short --branch
git -C projects/yonatankarp.github.io status --short --branch
rg --files projects/yonatankarp.github.io
npm run check
npm run build
git diff -- README.md package.json scripts/run-hugo.js
```

## Evidence

- Initial `npm run check`: passed the full local gate, but `npm run build` printed `sh: 1: hugo: not found` before using `.tools/hugo/hugo`.
- After the runner change, `npm run build` used `node scripts/run-hugo.js --gc --minify --cleanDestinationDir`, selected the bundled Hugo `v0.160.0`, built 151 pages, and did not print the missing global-Hugo error.
- Final `npm run check`: passed blog asset references, deterministic Hugo build, generated metadata, generated HTML checks, CV print length, and internal links.

## Files

- `scripts/run-hugo.js`
- `package.json`
- `README.md`
- `docs/autonomous-capacity-burn-2026-07-27.md`

## Next

Replace generated/fallback project media with real screenshots or product-origin images where better visual evidence is available.
