# Autonomous capacity burn - 2026-09-13

Timezone: Europe/Berlin

## Outcome

Kept `kotlin-design-patterns` in the homepage selected-work section, but replaced the fragile one-line maintenance claim with a concrete project note backed by current repository evidence. Also hardened the link checker so separately deployed same-domain project sites can use canonical `yonatankarp.com` links without being mistaken for missing pages in this Hugo build.

## Changes

- Expanded `content/projects/kotlin-design-patterns.md` with context, project shape, current signal, and what the project demonstrates.
- Switched the project URL from the GitHub Pages subdomain to the canonical `https://yonatankarp.com/kotlin-design-patterns/`.
- Added a manual summary break so the homepage selected-work card stays concise after the expanded page copy.
- Updated `scripts/check-links.js` with an explicit allowlist for externally managed same-domain paths, currently `/kotlin-design-patterns/`.

## Evidence

Repository metadata checked with GitHub CLI:

- `yonatankarp/kotlin-design-patterns` is public, unarchived, Kotlin-primary, MIT licensed, and on default branch `main`.
- Latest push: `2026-09-07T21:19:32Z`.
- Recent CI and GitHub Pages runs for commit `d0f73d8` completed successfully on September 7, 2026.
- Live docs URL `https://yonatankarp.com/kotlin-design-patterns/` returned `HTTP/2 200`.

Validation commands:

```text
gh repo view yonatankarp/kotlin-design-patterns --json name,description,homepageUrl,updatedAt,pushedAt,defaultBranchRef,isArchived,isFork,stargazerCount,primaryLanguage,licenseInfo,url
gh api repos/yonatankarp/kotlin-design-patterns/commits?per_page=5
gh api repos/yonatankarp/kotlin-design-patterns/actions/runs?per_page=5
curl -I -L --max-time 20 https://yonatankarp.com/kotlin-design-patterns/
node -c scripts/check-links.js
npm run check
npm run check:links:external
npm run visual:capture -- --out artifacts/visual-smoke/2026-09-13-capacity-burn-final
```

Results:

- `npm run check`: passed across 154 generated pages and 97 checked HTML files.
- `npm run check:links:external`: passed across 97 HTML files and 152 external URLs.
- Visual smoke: captured 12 route/viewport screenshots in `artifacts/visual-smoke/2026-09-13-capacity-burn-final/`.
- Manual review of `home-desktop-2026-09-13.png` and `home-mobile-2026-09-13.png`: selected-work summary stayed contained; no obvious overlap, CTA wrapping defect, or horizontal overflow.
- Commit `7868195` was pushed to `origin/main`; GitHub accepted the direct push with the existing rule-bypass message.
- Pages workflow run `34749292175` was still queued with no jobs assigned after the initial watch window, so production deployment was not verified in this run.

## Next

Check Pages workflow run `34749292175`; if it completes successfully, capture a live visual smoke set and compare it against `artifacts/visual-smoke/2026-09-13-capacity-burn-final/`.
