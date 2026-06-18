# 2026-06-18 capacity burn visual check

Purpose: verify the homepage redesign and fix any material rendering issue found during the autonomous capacity-burn block.

Finding: full-page Playwright screenshots only showed the initial viewport and left later homepage sections blank because `.js-enabled .reveal` set all unreached reveal nodes to `opacity: 0`.

Change: reveal animations now keep content visible and animate only vertical position. JavaScript still reveals nodes as they intersect and now reveals everything before print.

Evidence:

- `home-desktop-before.png` / `home-mobile-before.png`: initial viewport screenshots.
- `home-desktop-full-before.png` / `home-mobile-full-before.png`: failed full-page captures with hidden lower sections.
- `home-desktop-full-after.png` / `home-mobile-full-after.png`: successful full-page captures after the fix.

Checks run:

- `npm run check`
- `.tools/hugo/hugo server --bind 127.0.0.1 --port 1313 --disableFastRender`
- `npx --yes playwright@latest screenshot --full-page --viewport-size=1440,1200 http://127.0.0.1:1313/ artifacts/2026-06-18-capacity-burn/home-desktop-full-after.png`
- `npx --yes playwright@latest screenshot --full-page --viewport-size=390,1400 http://127.0.0.1:1313/ artifacts/2026-06-18-capacity-burn/home-mobile-full-after.png`
