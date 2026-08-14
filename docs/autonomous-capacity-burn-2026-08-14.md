# Autonomous capacity burn - 2026-08-14

Timezone: Europe/Berlin

## Focus

Continue the deployed-quality website track by giving `TaleKeeper` the same internal project case-study treatment that `ff4k` received in the previous capacity block.

## Delivered

- Added a public `/projects/talekeeper/` case-study page covering the product problem, local-first workflow, engineering shape, runtime model, and current archived repo status.
- Changed the homepage and projects-list `TaleKeeper` card from an external docs link to an internal `Case study` link.
- Removed the stale `build.render: never` front matter that would have created an empty case-study link without generating the actual page.
- Captured standard visual-smoke screenshots plus focused desktop/mobile screenshots for the new route.

## Evidence

Commands:

```bash
git status --short --branch
curl -L --max-time 20 -s https://api.github.com/repos/yonatankarp/TaleKeeper
curl -L --max-time 20 -s https://raw.githubusercontent.com/yonatankarp/TaleKeeper/main/README.md
curl -L --max-time 20 -s https://yonatankarp.github.io/TaleKeeper/
npm run check
npm run visual:capture -- --out artifacts/2026-08-14-capacity-burn-talekeeper-case-study
npm run serve -- --bind 127.0.0.1 --port 1313 --disableFastRender
curl -I --max-time 10 http://127.0.0.1:1313/projects/talekeeper/
npx playwright screenshot --viewport-size=1440,1300 http://127.0.0.1:1313/projects/talekeeper/ artifacts/2026-08-14-capacity-burn-talekeeper-case-study/talekeeper-case-study-desktop-2026-08-14.png
npx playwright screenshot --viewport-size=390,1200 http://127.0.0.1:1313/projects/talekeeper/ artifacts/2026-08-14-capacity-burn-talekeeper-case-study/talekeeper-case-study-mobile-2026-08-14.png
rg -n "href=/projects/talekeeper/|href=\"/projects/talekeeper/\"|Case study|Why it exists|Public repo status|Self-hosted TTRPG session recorder" public/index.html public/projects/index.html public/projects/talekeeper/index.html
```

Results:

- GitHub metadata confirmed `yonatankarp/TaleKeeper` is public, archived, Python, GitHub Pages-enabled, pushed on 2026-05-25, and has three open issues.
- Public README confirmed the current project framing: offline D&D recording, Whisper transcription, speaker diarization, local LLM summaries, FastAPI backend, Svelte 5 frontend, SQLite data storage, Docker Compose option, optional image generation via OpenAI-compatible endpoints, and Apple Silicon hardware notes.
- `npm run check` passed: Hugo built 153 pages, generated HTML checks passed across 96 files, CV print stayed at 2 A4 pages, and internal links passed.
- `curl -I` against local Hugo returned `HTTP/1.1 200 OK` for `/projects/talekeeper/`.
- Visual smoke captured 12 standard screenshots under `artifacts/2026-08-14-capacity-burn-talekeeper-case-study/`.
- Focused Playwright screenshots captured the generated `TaleKeeper` case-study page at desktop and mobile sizes through the local server.
- Generated HTML confirms homepage/project cards link to `/projects/talekeeper/` and the case-study page contains the new sections.

## Files

- `content/projects/talekeeper.md`
- `artifacts/2026-08-14-capacity-burn-talekeeper-case-study/README.md`
- `artifacts/2026-08-14-capacity-burn-talekeeper-case-study/*.png`
- `docs/autonomous-capacity-burn-2026-08-14.md`

## Next

Audit the remaining featured project cards for `caseStudy` candidates and convert one more high-signal project only where there is enough public source material to avoid thin portfolio content.
