# Autonomous capacity burn - 2026-09-02

Timezone: Europe/Berlin

## Outcome

Tightened the personal site's Staff+ positioning after confirming the September 2 redesign baseline was stable. The site remains deployable and the contact path stays email-first, but the homepage now points more directly at Staff+ backend ownership work in payments, risk, compliance, and platform architecture.

## Changes

- Changed the homepage primary CTA from a generic conversation label to `Discuss Staff+ backend work`.
- Rewrote the homepage contact band around backend domain ownership instead of general clarity/code language.
- Updated contact priorities to name permanent Staff+ backend roles in Europe, payments/risk/compliance/platform architecture, and OSS/writing/teaching.
- Tightened the CV summary and Staff+ proof copy around service boundaries, API contracts, recovery paths, reusable tooling, and team-owned documentation.

## Evidence

- `git status --short --branch`: website repo started clean and synced with `origin/main`.
- `npm run check`: passed blog asset references, Hugo production build, metadata validation, generated HTML accessibility/placeholder checks, CV print limit, and internal link checks.
- `npm run visual:capture -- --out artifacts/visual-smoke/2026-09-02`: captured 12 route/viewport screenshots before the copy edit.
- `npm run visual:compare -- --baseline artifacts/2026-08-31-capacity-burn-local/manifest.json --candidate artifacts/visual-smoke/2026-09-02/manifest.json`: 12 compared, 12 unchanged, 0 missing/unmatched.
- `npm run visual:capture -- --out artifacts/visual-smoke/2026-09-02-post-copy`: captured 12 route/viewport screenshots after the copy edit.
- `npm run visual:compare -- --baseline artifacts/visual-smoke/2026-09-02/manifest.json --candidate artifacts/visual-smoke/2026-09-02-post-copy/manifest.json`: only home and CV changed, matching the edited copy; no unrelated page drift.
- Manual screenshot inspection: home desktop/mobile and CV desktop/mobile show contained text, intact contact band layout, and no visible overflow.

## Artifacts

- `artifacts/visual-smoke/2026-09-02/manifest.json`
- `artifacts/visual-smoke/2026-09-02-post-copy/manifest.json`

## Next

Run a live capture after the GitHub Pages deployment completes and compare production against the post-copy local manifest.
