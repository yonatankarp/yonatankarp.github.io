# Autonomous Capacity Burn - 2026-07-26

Run time: 2026-07-26 11:12:57 CEST

## Scope

Monthly capacity-burn pass focused on the personal website's deployed-quality baseline after the previous external-link drift fix.

## Delivered

1. Re-ran the full local website quality gate against the current `main` checkout.
2. Captured a fresh 12-screenshot visual smoke set for home, projects, blog, CV, the self-compiling second brain post, and the Madeira 2026 standalone page.
3. Confirmed the latest GitHub Pages deployment for the previous fix succeeded and the live homepage/projects routes return HTTP 200.
4. Committed and pushed this audit artifact, then watched the triggered Pages workflow to successful completion.

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
```

## Evidence

- `npm run check`: passed blog asset references, Hugo build via `.tools/hugo/hugo`, generated metadata, generated HTML checks, CV print limit, and internal links.
- `npm run visual:capture -- --out artifacts/visual-smoke/2026-07-26`: captured 12 screenshots and passed the scripted assertions for HTTP responses, visible `h1`/body text, mobile overflow, visible image loading, mobile header/nav, home sections, blog index rows, and Madeira route/itinerary/source panels.
- Manual screenshot spot-check: sampled home desktop, projects mobile, blog mobile, and CV mobile; no obvious broken images, horizontal overflow, header collision, or title/card overlap.
- `gh run list --limit 5`: latest `main` deployment `30152513538` completed successfully for `Fix website external link drift` on 2026-07-25.
- Live checks: `https://yonatankarp.com/` and `https://yonatankarp.com/projects/` returned HTTP 200. The live homepage includes canonical/OpenGraph URLs under `https://yonatankarp.com/` and the expected Yonatan Karp-Rudin staff-engineer identity copy.
- Audit commit pushed to `origin/main`; GitHub Pages workflow `30196085773` completed successfully after the push, including build, metadata checks, generated HTML checks, CV print length, internal links, artifact upload, and deploy.

## Files

- `artifacts/visual-smoke/2026-07-26/README.md`
- `artifacts/visual-smoke/2026-07-26/*.png`
- `docs/autonomous-capacity-burn-2026-07-26.md`

## Findings

1. The website is currently release-clean locally and deployed successfully from the latest pushed commit.
2. The routine visual smoke output remains ignored by git, matching the existing artifact policy in `docs/visual-smoke-artifacts.md`.
3. Parent workspace has unrelated AI Signal Desk report/source-discovery churn and two untracked project directories; this pass left those untouched.

## Next

Replace generated/fallback project media with real screenshots or product-origin images for the remaining projects where better visual evidence is available.
