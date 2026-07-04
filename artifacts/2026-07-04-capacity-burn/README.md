# Capacity burn website QA - 2026-07-04

Timezone: Europe/Berlin

## Scope

Autonomous monthly capacity-burn pass focused on verifying that `projects/yonatankarp.github.io` remains deployment-quality after the recent visual redesign and smoke-test hardening.

## Findings

- The nested website repo is clean and aligned with `origin/main`; the earlier push-auth blocker is not present in this checkout state.
- `npm run check` passed: blog assets exist, Hugo production build succeeds through the bundled fallback, generated metadata remains on `https://yonatankarp.com`, generated HTML checks pass, and internal links resolve.
- Fresh Playwright visual capture produced 10 screenshots covering home, projects, blog, CV, and the self-compiling second brain post across desktop and mobile.
- Manual inspection of representative captures found no blank assets, broken nav chrome, or obvious text overlap on home desktop/mobile, projects mobile, blog desktop, or CV mobile.

## Verification

```bash
npm run check
npm run visual:capture -- --out artifacts/2026-07-04-capacity-burn
```

## Artifacts

- `home-desktop-2026-07-04.png`
- `home-mobile-2026-07-04.png`
- `projects-mobile-2026-07-04.png`
- `blog-desktop-2026-07-04.png`
- `cv-mobile-2026-07-04.png`
- plus the remaining route/viewport captures in this directory.

## Next

Add a lightweight route inventory or CI annotation for visual captures so each dated artifact directory can be checked for missing expected screenshots without relying on manual file counts.
