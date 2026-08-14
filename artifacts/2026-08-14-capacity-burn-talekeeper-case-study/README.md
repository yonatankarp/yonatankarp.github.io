# TaleKeeper case-study visual smoke - 2026-08-14

Timezone: Europe/Berlin

## Scope

Turn the featured `TaleKeeper` project from an external-docs card into an internal portfolio case-study page, then verify that the route, project cards, and responsive rendering work.

## Captures

- `home-desktop-2026-08-14.png`
- `home-mobile-2026-08-14.png`
- `projects-desktop-2026-08-14.png`
- `projects-mobile-2026-08-14.png`
- `talekeeper-case-study-desktop-2026-08-14.png`
- `talekeeper-case-study-mobile-2026-08-14.png`
- Standard visual-smoke captures for blog, CV, Madeira, and the self-compiling second-brain post are also in this directory.

## Verification Notes

- `npm run check` passed after the change.
- Hugo generated 153 pages and 96 checked HTML files, up from 152/95 before enabling the `TaleKeeper` page.
- Smoke checking caught that the old `build.render: never` front matter suppressed `/projects/talekeeper/` and produced an empty homepage case-study link. The final content removes that override.
- `curl -I http://127.0.0.1:1313/projects/talekeeper/` returned `200 OK`.
- Generated HTML confirms homepage and project-list links point to `/projects/talekeeper/`.
