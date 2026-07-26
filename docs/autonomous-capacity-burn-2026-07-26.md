# Autonomous Capacity Burn - 2026-07-26

Run time: 2026-07-26 11:12:57 CEST

## Scope

Monthly capacity-burn pass focused on the personal website's deployed-quality baseline after the previous external-link drift fix.

## Delivered

1. Re-ran the full local website quality gate against the current `main` checkout.
2. Captured a fresh 12-screenshot visual smoke set for home, projects, blog, CV, the self-compiling second brain post, and the Madeira 2026 standalone page.
3. Confirmed the latest GitHub Pages deployment for the previous fix succeeded and the live homepage/projects routes return HTTP 200.
4. Found a real CI-only flake in the CV print checker after pushing the first audit commit: GitHub Actions timed out waiting for `networkidle` on the static `/cv/` page.
5. Hardened `scripts/check-cv-print.js` to navigate on `domcontentloaded`, then treat `networkidle` as a short best-effort stabilization wait before running the existing print/page-count assertion.

## Commands

```text
git status --short --branch
git -C projects/yonatankarp.github.io status --short --branch
npm run check
npm run visual:capture -- --out artifacts/visual-smoke/2026-07-26
gh run list --limit 5
curl -I -L --max-time 20 https://yonatankarp.com/
curl -L --max-time 20 https://yonatankarp.com/ | rg -n "canonical|og:url|Yonatan Karp-Rudin|Staff Software Engineer"
curl -I -L --max-time 20 https://yonatankarp.com/projects/
git push origin main
gh run watch 30196085773 --exit-status
gh run watch 30196166184 --exit-status
gh run view 30196166184 --job 89777988225 --log
npm run check:cv-print
npm run check
```

## Evidence

- `npm run check`: passed blog asset references, Hugo build via `.tools/hugo/hugo`, generated metadata, generated HTML checks, CV print limit, and internal links.
- `npm run visual:capture -- --out artifacts/visual-smoke/2026-07-26`: captured 12 screenshots and passed the scripted assertions for HTTP responses, visible `h1`/body text, mobile overflow, visible image loading, mobile header/nav, home sections, blog index rows, and Madeira route/itinerary/source panels.
- Manual screenshot spot-check: sampled home desktop, projects mobile, blog mobile, and CV mobile; no obvious broken images, horizontal overflow, header collision, or title/card overlap.
- `gh run list --limit 5`: latest `main` deployment `30152513538` completed successfully for `Fix website external link drift` on 2026-07-25.
- Live checks: `https://yonatankarp.com/` and `https://yonatankarp.com/projects/` returned HTTP 200. The live homepage includes canonical/OpenGraph URLs under `https://yonatankarp.com/` and the expected Yonatan Karp-Rudin staff-engineer identity copy.
- First audit commit pushed to `origin/main`; GitHub Pages workflow `30196085773` completed successfully after the push, including build, metadata checks, generated HTML checks, CV print length, internal links, artifact upload, and deploy.
- Amended audit push triggered workflow `30196166184`, which failed in `Check CV print length` with `page.goto: Timeout 30000ms exceeded` while waiting for `networkidle` on `http://127.0.0.1:34393/cv/`.
- After the navigation hardening, `npm run check:cv-print` passed locally with 2 A4 pages, and `npm run check` passed the full local gate again.

## Files

- `artifacts/visual-smoke/2026-07-26/README.md`
- `artifacts/visual-smoke/2026-07-26/*.png`
- `docs/autonomous-capacity-burn-2026-07-26.md`
- `scripts/check-cv-print.js`

## Findings

1. The website is release-clean locally after the CV print checker hardening.
2. The routine visual smoke output remains ignored by git, matching the existing artifact policy in `docs/visual-smoke-artifacts.md`.
3. The CV print checker had the same fragile hard dependency on `networkidle` that was already removed from the visual capture path on 2026-07-23.
4. Parent workspace has unrelated AI Signal Desk report/source-discovery churn and two untracked project directories; this pass left those untouched.

## Next

Replace generated/fallback project media with real screenshots or product-origin images for the remaining projects where better visual evidence is available.
