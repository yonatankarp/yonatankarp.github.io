# Autonomous capacity burn - 2026-09-22

Timezone: Europe/Berlin

## Outcome

Promoted the ff4j upstream contribution from a one-line outbound project card
to an internal case study. The page now connects the merged Jakarta namespace
migration to the later ff4k replacement decision, making the portfolio read as
dependency modernization judgment instead of a loose link list.

## Checks run

```text
git status --short --branch
git -C /home/yonatan/.openclaw/workspace/projects/yonatankarp.github.io status --short --branch
git log --oneline --decorate -5
gh pr view 752 --repo ff4j/ff4j --json number,title,state,mergedAt,url,additions,deletions,changedFiles,body
gh pr list --repo ff4j/ff4j --author yonatankarp --state all --limit 20 --json number,title,state,mergedAt,url
gh repo view ff4j/ff4j --json description,homepageUrl,latestRelease,licenseInfo,repositoryTopics,pushedAt,url
npm run check
npm run serve -- --bind 127.0.0.1 --port 1314
curl -I --fail http://127.0.0.1:1314/projects/ff4j/
curl -s --fail http://127.0.0.1:1314/projects/ff4j/ | rg -n "ff4j|jakarta|PR #752|ff4k|Scope:"
curl -s --fail http://127.0.0.1:1314/projects/ | rg -n "ff4j|Case study|Jakarta namespace" | head -20
SITE_URL=http://127.0.0.1:1314/ npm run visual:capture
```

## Evidence

- GitHub CLI confirmed ff4j PR #752 was merged on 2025-12-20 with 155
  additions, 160 deletions, and 29 changed files.
- GitHub CLI showed Yonatan has one ff4j upstream PR, the merged Jakarta
  migration PR #752.
- `gh repo view` showed ff4j's latest release is still `2.0.0`, published on
  2023-02-07, which supports the case-study framing around merge status versus
  release availability.
- `npm run check` passed blog asset validation, Hugo production build,
  metadata checks, generated HTML checks, CV print checks, and internal link
  checks.
- Hugo generated 157 pages, up from 156 in the previous run, because
  `/projects/ff4j/` now renders as a project page.
- Generated HTML checks covered 100 files, up from 99.
- Local server route smoke returned `HTTP/1.1 200 OK` for `/projects/ff4j/`.
- The generated ff4j page includes the new summary, technology chips, outbound
  GitHub link, PR #752 link, migration details, ff4k relationship, and scope
  facts.
- The projects list now links `ff4j` to the internal case study and labels the
  CTA `Case study`.
- Visual smoke captured 12 screenshots in `artifacts/visual-smoke/2026-09-22/`.

## Files

- `content/projects/ff4j.md`
- `docs/autonomous-capacity-burn-2026-09-22.md`

## Next

Promote the next remaining outbound-only contribution card into an internal
case study, or run a live visual diff against `https://yonatankarp.com/` once
the latest site commits are deployed.
