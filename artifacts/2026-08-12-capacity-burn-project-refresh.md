# Capacity Burn Project Refresh - 2026-08-12

Timezone: Europe/Berlin

## Scope

Monthly autonomous capacity-burn pass focused on the personal website project list after the 2026-08-11 visual audit found no material layout regression and recommended content freshness as the next useful task.

## Findings

1. The website repo was clean and aligned with `origin/main` before edits.
2. Full local validation already passed before the copy change, so there was no urgent build or link blocker to fix first.
3. The project index intro was accurate but too generic for a Staff-engineer portfolio page; it did not name the current work pattern.
4. `ff4k`, `TaleKeeper`, `sse-mcp-server`, and the OpenAPI Generator contribution were high-signal entries, but their summaries under-explained the engineering boundary, recovery path, or operational value.
5. The visible homepage and `/projects/` route both render project summaries from the same Markdown source, so small content changes improve both surfaces without touching layouts or CSS.

## Changes

- Reframed the project index around reusable infrastructure and unclear systems rather than a generic list of things built.
- Expanded four high-priority project summaries with concrete system boundaries and value:
  - `ff4k`
  - `TaleKeeper`
  - `sse-mcp-server`
  - `openapi-generator (contributor)`

## Checks Run

- `git status --short --branch`
- `npm run check` before edits
- `npm run check` after edits
- `npm run visual:capture -- --out artifacts/2026-08-12-capacity-burn-visual-smoke`

## Next Recommended Work

Turn `ff4k` into the first deeper case-study page. It has the clearest narrative arc: upstream blocker, greenfield replacement, typed API design, storage backends, coroutine context propagation, and a docs site already linked from the portfolio.
