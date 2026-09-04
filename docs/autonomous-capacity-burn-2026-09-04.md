# Autonomous capacity burn - 2026-09-04

Timezone: Europe/Berlin

## Outcome

Turned the `sse-mcp-server` project entry from a stub external link into a local case study so the projects index has a stronger AI-agent infrastructure proof point after the September 3 project ordering work.

## Changes

- Added a project description, richer tech metadata, and year metadata for `sse-mcp-server`.
- Promoted `sse-mcp-server` to a rendered local case study page.
- Added concise sections covering the problem, architecture, trade-offs, demonstrated engineering signal, and current public shape.
- Preserved the GitHub repository as the primary external action link.

## Evidence

- `git status --short --branch`: website repo started clean and synced with `origin/main`.
- `git ls-remote https://github.com/yonatankarp/sse-mcp-server.git HEAD`: public repository resolved at `6dbb49fbc8705dcb8333412d02661e3c3544b40b`.
- `curl -fsSL https://raw.githubusercontent.com/yonatankarp/sse-mcp-server/main/README.md`: verified public README claims used for the case study: Spring Boot Kotlin, SSE endpoint, Flowise integration, Docker Compose, manifest discovery, math/date-time example tools.
- `npm run check`: passed blog asset references, Hugo production build, metadata validation, generated HTML checks, CV print limit, and internal link checks. Generated page count rose from 153 to 154, and checked HTML files rose from 96 to 97.
- `npm run visual:capture -- --out artifacts/visual-smoke/2026-09-04-sse-mcp-case-study`: captured 12 route/viewport screenshots.
- Targeted Playwright smoke against `http://127.0.0.1:1314/projects/sse-mcp-server/`: desktop and mobile returned HTTP 200, title `sse-mcp-server | Yonatan Karp-Rudin`, H1 `sse-mcp-server`, GitHub repo link present, expected section headings present, and zero horizontal overflow.
- `git push origin main`: pushed commit `88451cc` to the HTTPS GitHub origin.
- `gh run watch 33857552518 --exit-status`: GitHub Pages workflow passed; build finished in 5m14s and deploy finished in 8s.
- Targeted Playwright smoke against `https://yonatankarp.com/projects/sse-mcp-server/`: desktop and mobile returned HTTP 200, title `sse-mcp-server | Yonatan Karp-Rudin`, H1 `sse-mcp-server`, GitHub repo link present, expected section headings present, and zero horizontal overflow.
- `npm run visual:capture:live -- --out artifacts/visual-smoke/2026-09-04-sse-mcp-case-study-live`: captured 12 production route/viewport screenshots.
- `npm run visual:compare -- --baseline artifacts/visual-smoke/2026-09-04-sse-mcp-case-study/manifest.json --candidate artifacts/visual-smoke/2026-09-04-sse-mcp-case-study-live/manifest.json`: 12 compared, 12 unchanged, 0 missing/unmatched.

## Artifacts

- `artifacts/visual-smoke/2026-09-04-sse-mcp-case-study/manifest.json`
- `artifacts/visual-smoke/2026-09-04-sse-mcp-case-study/sse-mcp-server-desktop-2026-09-04.png`
- `artifacts/visual-smoke/2026-09-04-sse-mcp-case-study/sse-mcp-server-mobile-2026-09-04.png`
- `artifacts/visual-smoke/2026-09-04-sse-mcp-case-study-live/manifest.json`

## Next

Decide whether `sse-mcp-server` should become a homepage selected-work item, or keep it as a deeper projects-index proof point until the repository README and docs are stronger.
