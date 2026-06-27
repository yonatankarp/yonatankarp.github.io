# Autonomous Capacity Burn - 2026-06-27

Timezone: Europe/Berlin

## Focus

Continued the deployment-quality personal website track. The website repo started clean and aligned with `origin/main`; unrelated AI Signal Desk report churn in the parent OpenClaw workspace was left untouched.

## Findings

- The previous website deploy succeeded: GitHub Actions run `28228973929` completed successfully for `Improve visual QA lazy image capture`.
- Local validation passed with the expected fallback to bundled Hugo because system `hugo` is not installed.
- Fresh visual smoke captures rendered all 10 tracked routes/viewports without blank lazy-image frames in the sampled home, projects mobile, blog mobile, and CV mobile screenshots.
- Production served `https://yonatankarp.com/` successfully, but generated canonical and social URLs were `http://yonatankarp.com/...` because the deploy workflow overrode Hugo's `baseURL` with the GitHub Pages output.
- `layouts/partials/head_custom.html` was a stale duplicate GoatCounter include and was not referenced by the base layout.

## Change

- Pinned the Hugo production base URL to `https://yonatankarp.com/`.
- Removed the deploy workflow `--baseURL "${{ steps.pages.outputs.base_url }}/"` override so production canonical, OpenGraph, share, JSON-LD, and `llms.txt` URLs come from the repository configuration.
- Updated the structured-data person URL to `https://yonatankarp.com`.
- Deleted the unused duplicate `head_custom.html` partial.

## Checks

- `gh run list --limit 5`
  - Result: latest Pages deploy for `Improve visual QA lazy image capture` succeeded.
- `npm run check`
  - Result: blog asset references passed for 15 markdown files; Hugo build passed through bundled `.tools/hugo/hugo`.
- `npm run visual:capture`
  - Result: captured 10 screenshots in `screenshots/`.
- `curl -I -L --max-time 20 https://yonatankarp.com/`
  - Result: `HTTP/2 200`.
- `curl -L --max-time 20 https://yonatankarp.com/ | rg ...`
  - Result before change: live canonical/OpenGraph URLs used `http://yonatankarp.com/...`.

## Artifacts

- `screenshots/home-desktop-2026-06-27.png`
- `screenshots/home-mobile-2026-06-27.png`
- `screenshots/projects-desktop-2026-06-27.png`
- `screenshots/projects-mobile-2026-06-27.png`
- `screenshots/blog-desktop-2026-06-27.png`
- `screenshots/blog-mobile-2026-06-27.png`
- `screenshots/cv-desktop-2026-06-27.png`
- `screenshots/cv-mobile-2026-06-27.png`
- `screenshots/post-self-compiling-second-brain-desktop-2026-06-27.png`
- `screenshots/post-self-compiling-second-brain-mobile-2026-06-27.png`

## Next

After push, confirm the new Pages deployment succeeds and verify the live home page emits `https://yonatankarp.com/` canonical/OpenGraph URLs.
