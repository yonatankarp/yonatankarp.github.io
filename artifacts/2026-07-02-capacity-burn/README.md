# Capacity burn visual QA - 2026-07-02

## Scope

Autonomous monthly capacity-burn pass focused on verifying the redesigned personal website and tightening any obvious internal tooling issue found during the run.

## Findings

- `npm run check` passed through the bundled Hugo fallback: blog assets, production build, generated metadata, generated HTML, and internal links are healthy.
- Fresh Playwright screenshots rendered cleanly for home, projects, blog, CV, and the self-compiling second brain post across desktop and mobile.
- Running visual capture with `--base http://127.0.0.1:1313/` while no server was running failed with a generic timeout, which made the operator recovery path less clear than it should be.

## Changes

- Improved `scripts/capture-screenshots.js` timeout messages so external-server mode tells the operator to start Hugo separately or omit `--base` / `SITE_URL`.
- Captured dated visual evidence in this artifact directory.

## Verification

```bash
npm run check
npm run visual:capture -- --out artifacts/2026-07-02-capacity-burn --base http://127.0.0.1:1313/
npm run visual:capture -- --out artifacts/2026-07-02-capacity-burn
```

The `--base` command intentionally documented the no-server failure path. The self-hosting command captured 10 screenshots successfully.
