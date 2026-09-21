# Autonomous capacity burn - 2026-09-21

Timezone: Europe/Berlin

## Outcome

Promoted the Konsist upstream contribution from a short outbound project card to
an internal case study, continuing the portfolio shift from link directory to
evidence of technical judgment.

## Checks run

```text
git status --short --branch
git log --oneline --decorate --max-count=6
gh pr list --repo LemonAppDev/konsist --author yonatankarp --state merged --limit 20 --json number,title,mergedAt,url,additions,deletions,changedFiles
gh pr list --repo LemonAppDev/konsist --search "author:yonatankarp" --state all --limit 30 --json number,title,state,mergedAt,url
npm run check
npm run serve -- --bind 127.0.0.1 --port 1314
curl -I --fail http://127.0.0.1:1314/projects/konsist/
curl -s --fail http://127.0.0.1:1314/projects/konsist/ | rg -n "Konsist|Project technologies|representsType|3 merged upstream PRs|Open project|#719|snippet CI"
curl -s --fail http://127.0.0.1:1314/projects/ | rg -n "konsist|Case study|Static analysis" | head -20
SITE_URL=http://127.0.0.1:1314/ npm run visual:capture
```

## Evidence

- GitHub CLI showed 3 merged Konsist PRs by `yonatankarp`: #719
  `KON-553: Allow null values in representsType()`, #724 `KON-562:
  Improve snippet CI verification`, and #725 `KON-563: Run only 1 CI
  pipeline in parallel for each PR`.
- `npm run check` passed blog asset validation, Hugo production build, metadata
  checks, generated HTML checks, CV print checks, and internal link checks.
- Hugo generated 156 pages, up from 155 in the previous run, because
  `/projects/konsist/` now renders as a project page.
- Generated HTML checks covered 99 files, up from 98.
- Local server route smoke returned `HTTP/1.1 200 OK` for
  `/projects/konsist/`.
- The generated Konsist page includes the new summary, metadata strip,
  technology chips, outbound project link, nullable type-matching copy, snippet
  CI copy, and PR links.
- The projects list now links `konsist` to the internal case study and labels
  the CTA `Case study`.
- Visual smoke captured 12 screenshots in
  `artifacts/visual-smoke/2026-09-21/`.

## Files

- `content/projects/konsist.md`
- `docs/autonomous-capacity-burn-2026-09-21.md`

## Next

Promote `ff4j` into a concise internal case study that connects the merged
Jakarta migration PR to the later `ff4k` fork motivation.
