# Capacity Burn Visual Polish - 2026-09-17

Timezone: Europe/Berlin

## Scope

Autonomous monthly capacity-burn pass focused on the personal website. The repository was clean and aligned with `origin/main` before edits, so this run targeted a small visual polish issue instead of repository recovery.

## Findings

1. The site builds cleanly with Hugo v0.160.0 and renders 154 pages.
2. Visual smoke capture passed all route assertions across home, projects, blog, CV, the self-compiling Second Brain post, and the Madeira standalone page.
3. The homepage mobile selected-work section made every project CTA a full-width pill because the global small-screen button rule applied inside compact project rows.
4. Those full-width project CTAs added avoidable vertical weight and made the project cards scan less like a portfolio list.

## Changes

- Added a narrower `.project-row__meta .button` override for project/work row actions.
- Kept full-width buttons elsewhere on small screens, including hero/contact flows where broad tap targets still make sense.
- Captured before/after screenshot sets for review.

## Checks Run

- `git status --short --branch`
- `npm run build`
- `npm run visual:capture -- --out artifacts/2026-09-17-capacity-burn-before`
- `npm run visual:capture -- --out artifacts/2026-09-17-capacity-burn-after`
- `npm run check`
- `npm run visual:compare -- --baseline artifacts/2026-09-17-capacity-burn-before --candidate artifacts/2026-09-17-capacity-burn-after`
- `npm run visual:capture:live -- --out artifacts/2026-09-17-capacity-burn-live`
- `npm run visual:compare -- --baseline artifacts/2026-09-17-capacity-burn-after --candidate artifacts/2026-09-17-capacity-burn-live`

## Evidence

- Before screenshots: `artifacts/2026-09-17-capacity-burn-before/`
- After screenshots: `artifacts/2026-09-17-capacity-burn-after/`
- Live production screenshots: `artifacts/2026-09-17-capacity-burn-live/`
- Local before/after visual comparison: 12 pairs compared, 9 unchanged, 3 changed, 0 missing or unmatched.
- Expected local visual deltas:
  - `home::mobile`: height changed from 12877px to 12834px after compact project CTAs.
  - `blog::mobile`: 3.0485% pixel drift from regenerated local capture timing.
  - `projects::desktop`: 0.1436% pixel drift from local render/capture variance.
- Local after/live production visual comparison: 12 pairs compared, 11 unchanged, 1 changed, 0 missing or unmatched.
- Expected live visual delta:
  - `projects::desktop`: 0.1436% pixel drift from render/capture variance.

## Next Recommended Work

Use the next capacity-burn block to audit the blog index and post templates for scanability now that the homepage work/project rows are stable.
