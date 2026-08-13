# Autonomous capacity burn - 2026-08-13

Timezone: Europe/Berlin

## Focus

Continue the deployed-quality website track from the previous recommendation: turn `ff4k` into the first deeper project case-study page instead of leaving it as a one-paragraph external-docs card.

## Delivered

- Added a public `/projects/ff4k/` case-study page with context on the upstream blocker, Kotlin-native API boundary, storage model, coroutine-aware targeting, docs, repository, and license.
- Routed the homepage and project-list `ff4k` cards to the internal case-study page while keeping the external docs/repository links inside the case-study body.
- Added an explicit Hugo summary break so homepage/project cards keep the short portfolio summary instead of absorbing the full case-study body.
- Captured the normal visual-smoke set plus focused desktop/mobile screenshots for the generated `ff4k` case-study route.

## Evidence

Commands:

```bash
git status --short --branch
curl -L --max-time 20 -s https://yonatankarp.github.io/ff4k/
curl -L --max-time 20 -s https://api.github.com/repos/yonatankarp/ff4k
curl -L --max-time 20 -s https://raw.githubusercontent.com/yonatankarp/ff4k/main/README.md
npm run check
npm run visual:capture -- --out artifacts/2026-08-13-capacity-burn-ff4k-case-study
npx playwright screenshot --viewport-size=1440,1200 file:///home/yonatan/.openclaw/workspace/projects/yonatankarp.github.io/public/projects/ff4k/index.html artifacts/2026-08-13-capacity-burn-ff4k-case-study/ff4k-case-study-desktop-2026-08-13.png
npx playwright screenshot --viewport-size=390,1100 file:///home/yonatan/.openclaw/workspace/projects/yonatankarp.github.io/public/projects/ff4k/index.html artifacts/2026-08-13-capacity-burn-ff4k-case-study/ff4k-case-study-mobile-2026-08-13.png
rg -n "Why it exists|href=\"/projects/ff4k/\"|Case study|Kotlin Multiplatform feature flags library built" public/index.html public/projects/index.html public/projects/ff4k/index.html
```

Results:

- GitHub metadata confirmed `yonatankarp/ff4k` is public, Kotlin, Apache-2.0, GitHub Pages-enabled, and recently pushed on 2026-07-23.
- The public README confirmed the current project framing: Kotlin Multiplatform, Kotlin DSL, typed properties, kotlinx.serialization, JVM 17, and docs on GitHub Pages.
- `npm run check` passed: Hugo built 152 pages, generated HTML checks passed across 95 files, CV print stayed at 2 A4 pages, and internal links passed.
- Visual smoke captured 12 standard screenshots under `artifacts/2026-08-13-capacity-burn-ff4k-case-study/`.
- Focused Playwright screenshots captured the generated `ff4k` case-study page at desktop and mobile sizes.
- Generated HTML confirms homepage/project cards link to `/projects/ff4k/`, summaries remain short, and `/projects/ff4k/` contains the new case-study sections.

## Files

- `content/projects/ff4k.md`
- `layouts/index.html`
- `layouts/partials/project-entry.html`
- `artifacts/2026-08-13-capacity-burn-ff4k-case-study/README.md`
- `artifacts/2026-08-13-capacity-burn-ff4k-case-study/*.png`
- `docs/autonomous-capacity-burn-2026-08-13.md`

## Next

Add one more high-signal case-study page for `TaleKeeper`, focused on live audio ingestion, diarization, review workflow, and searchable campaign memory.
