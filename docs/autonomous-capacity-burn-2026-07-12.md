# Autonomous Capacity Burn - 2026-07-12

Timezone: Europe/Berlin

## Focus

Continue the July 11 website next step: tighten repeated homepage and CV work-history wording now that the visual redesign and deployment checks are stable.

## Delivered

- Tightened homepage hero/proof copy so the above-the-fold staff-level evidence emphasizes service boundaries, recovery paths, tooling, and ownership instead of repeating specs/runbooks/contracts.
- Updated the current Staff Payments experience entry with a clearer outcome-oriented description of compliance failure handling and the Backstage cronjob monitor.
- Aligned the CV summary and Staff+ focus bullets with the revised positioning.
- Re-ran full static checks and visual smoke capture after the content edits.

## Evidence

- `git status --short --branch`
  - Website repo result before edits: `## main...origin/main`.
  - Parent workspace had unrelated AI Signal Desk report changes; left untouched.
- `npm run check`
  - Result: passed.
  - Blog asset references exist across 15 blog markdown files.
  - Bundled Hugo `v0.160.0` built 151 pages because system `hugo` is not installed.
  - Generated metadata uses `https://yonatankarp.com` across 6 public files.
  - Generated HTML accessibility/placeholder checks passed across 94 HTML files.
  - Internal link checks passed across 94 HTML files.
- `npm run visual:capture`
  - Result: passed.
  - Captured 12 screenshots in `artifacts/visual-smoke/2026-07-12/`.
  - Assertions covered HTTP success, visible `h1`, minimum rendered text, mobile horizontal overflow, visible image loading, mobile nav accessibility, home proof sections, blog card count, and Madeira route/day/photo/source sections.
- Manual visual spot-checks
  - `home-desktop-2026-07-12.png` and `home-mobile-2026-07-12.png` render the revised hero/proof/experience copy without visible overlap.
  - `cv-desktop-2026-07-12.png` and `cv-mobile-2026-07-12.png` render the revised CV summary and current-role content without horizontal overflow or broken wrapping.
- Commit and push
  - Commit: `5d82297` (`Tighten homepage and CV positioning`).
  - Push: succeeded to `origin/main`.

## Changed Files

- `data/home/en.yaml`
- `content/experience/billie-staff-payments.md`
- `layouts/_default/cv.html`
- `docs/autonomous-capacity-burn-2026-07-12.md`

## Next

Run a focused CV information-density pass: the content now reads cleaner, but the mobile CV is still long and would benefit from turning the experience paragraphs into scannable bullets or shorter sections.
