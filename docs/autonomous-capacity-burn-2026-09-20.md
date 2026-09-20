# Autonomous capacity burn - 2026-09-20

Timezone: Europe/Berlin

## Outcome

Promoted the OpenAPI Generator contribution from a short outbound project card
to an internal case study and added compact project metadata to project detail
headers.

## Checks run

```text
git status --short --branch
git log --oneline --decorate --max-count=8
npm run check
npm run serve -- --bind 127.0.0.1 --port 1314
curl -I --fail http://127.0.0.1:1314/projects/openapi-generator/
curl -s --fail http://127.0.0.1:1314/projects/openapi-generator/ | rg -n "Spring Boot 4|Jackson 3|Project technologies|Open project|10 upstream PRs"
curl -s --fail http://127.0.0.1:1314/projects/ | rg -n "openapi-generator|Case study" | head -20
```

## Evidence

- `npm run check` passed blog asset validation, Hugo production build, metadata
  checks, generated HTML checks, CV print checks, and internal link checks.
- Hugo generated 155 pages, up from 154 in the previous live-smoke run, because
  `/projects/openapi-generator/` now renders as a project page.
- Generated HTML checks covered 98 files, up from 97.
- Local server route smoke returned `HTTP/1.1 200 OK` for
  `/projects/openapi-generator/`.
- The generated OpenAPI project page includes the new summary, metadata strip,
  technology chips, outbound project link, and case-study sections.
- The projects list now links `openapi-generator` to the internal case study and
  labels the CTA `Case study`.

## Files

- `content/projects/openapi-generator.md`
- `layouts/_default/single.html`
- `docs/autonomous-capacity-burn-2026-09-20.md`

## Next

Continue turning the remaining high-signal contribution cards into internal
case studies, starting with `konsist` or `ff4j`, so the portfolio reads less
like a link directory and more like evidence of technical judgment.
