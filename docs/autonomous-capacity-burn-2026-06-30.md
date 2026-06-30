# Autonomous Capacity Burn - 2026-06-30

Timezone: Europe/Berlin

## Focus

Full scan for what is still missing on `projects/yonatankarp.github.io` after the recent redesign, visual QA, CI, metadata, and blog-polish passes.

## Current Health

- Local repo started clean and aligned with `origin/main` at `a3b1b73`.
- `npm run check` passed:
  - blog asset references exist across 15 blog markdown files,
  - Hugo built 151 pages through bundled `.tools/hugo/hugo` because system `hugo` is not installed,
  - generated metadata uses `https://yonatankarp.com` across the configured metadata guard files.
- Latest 10 GitHub Actions runs were successful, including the latest Pages deploy on 2026-06-30.
- Live production `https://yonatankarp.com/` returned `HTTP/2 200` and served correct `https://yonatankarp.com/` canonical, OpenGraph, Twitter image, and JSON-LD URLs.
- `npm run visual:capture` captured 10 current screenshots across home, projects, blog, CV, and a representative blog post in desktop/mobile viewports.
- Fresh visual samples showed no blank lazy-image frames, obvious mobile overflow, or major text collisions.

## What Is Missing

### 1. Accessibility pass for article body images

Generated-site audit found 39 article-body `<img>` tags with empty or missing useful alt text. These are mostly older migrated blog/tutorial images rendered from Markdown image syntax.

Why it matters: the site already fixed project thumbnail alt text, but the long-form blog archive still has a material accessibility gap.

Best next burn:

- Add a generated HTML check that fails on article-body images with empty alt text, excluding explicitly decorative images if any.
- Fix the highest-traffic or currently featured posts first.

### 2. Stronger generated-origin guard

The current metadata guard catches stale `http://yonatankarp.com` and verifies canonical/social metadata on selected pages. It does not yet validate `sitemap.xml`, nor does it reject generic local origins such as `http://localhost:1313` in generated discovery files.

Local note: after `npm run visual:capture`, `public/sitemap.xml` and `public/llms.txt` can contain local dev URLs because Hugo server output uses the local server origin. `public/` was not dirty in git, so this was not a commit risk in this scan, but the guard should be clearer about production-build expectations.

Best next burn:

- Extend `scripts/check-site-metadata.js` to include `sitemap.xml`.
- Fail on any absolute local/dev origin in production checks: `localhost`, `127.0.0.1`, and `http://yonatankarp.com`.
- Optionally make `visual:capture` avoid mutating production-oriented `public/` output, or document that local server output is disposable.

### 3. Blog index pagination edge

Generated audit found one generated page without an H1: `/blog/page/1/`.

This is likely a paginator duplicate or alias edge rather than a primary UX break, but it is still worth inspecting because it can affect accessibility and search semantics.

Best next burn:

- Decide whether `/blog/page/1/` should redirect/canonicalize to `/blog/`, or render the same H1 structure as the blog index.

### 4. Content freshness is uneven

The visual system and deployment pipeline are now ahead of the content. The freshest public content work is concentrated in:

- `content/blog/inject-multiple-implementations-spring.md` updated 2026-06-30,
- `content/blog/self-compiling-second-brain.md` updated 2026-06-18,
- several project/education/CV files from the June 13 migration wave.

The site reads well, but the staff-level narrative could use another content pass beyond visual polish.

Best next burn:

- Update CV/projects/experience content for the current Staff Engineer - Payments positioning.
- Add one or two new project entries or blog posts grounded in OpenClaw/agent operating-system work.
- Audit old article titles for capitalization consistency: examples still include `OpenApi`/`OpenAPI` inconsistencies.

### 5. Screenshot artifact policy is still noisy

The site has many dated screenshots tracked in `screenshots/`, and `npm run visual:capture` updates same-date screenshots in place. This scan changed `screenshots/blog-mobile-2026-06-30.png` by a small binary delta.

Best next burn:

- Decide whether screenshots are source-controlled evidence, CI artifacts only, or curated release artifacts.
- If source-controlled, add a small manifest or artifact README per capture date.
- If CI-only, ignore routine screenshots and keep only selected evidence under `artifacts/YYYY-MM-DD-*`.

### 6. Visual QA is good, but not assertion-backed

The screenshot workflow catches route load failures and produces visual evidence, but it does not yet assert common visual regressions beyond HTTP status.

Best next burn:

- Add lightweight Playwright assertions for:
  - no horizontal overflow on sampled mobile routes,
  - primary heading visible,
  - hero/proof section present on home,
  - blog cards/images non-empty,
  - mobile menu button stable and accessible.

### 7. System Hugo is still absent locally

Every local check relies on the bundled Hugo fallback because `hugo` is not installed globally. This is fine operationally and documented, but it shows up in every burn report.

Best next burn:

- Either accept the bundled binary as canonical and stop treating global Hugo absence as noteworthy, or install/pin the project-local toolchain more explicitly.

## Ranked Next Tasks

1. Add generated HTML accessibility checks for blog images, then fix missing alt text on featured/recent posts.
2. Extend metadata/origin guard to cover `sitemap.xml` and local-origin leaks.
3. Resolve `/blog/page/1/` H1/canonical behavior.
4. Define screenshot artifact policy and reduce routine binary churn.
5. Add Playwright non-visual assertions around mobile overflow and key page landmarks.
6. Make a content freshness pass on Staff Engineer - Payments, projects, and OpenClaw/agent-system writing.
7. Normalize older blog title casing and OpenAPI spelling.

## Evidence

- `git status --short --branch`
- `git remote -v`
- `npm run check`
- `gh run list --limit 10`
- `curl -I -L --max-time 20 https://yonatankarp.com/`
- `curl -L --max-time 20 https://yonatankarp.com/ | rg ...`
- `npm run visual:capture`
- generated HTML audit for titles, H1s, image alt text, placeholder text, and hash links
- source scan for TODO/FIXME/placeholders/dead hash links/generic AI copy
- visual inspection of current desktop/mobile screenshots

## Bottom Line

The site is now deployment-healthy and visually coherent. The useful autonomous burn is shifting from "make it render and deploy cleanly" to "make the generated site stricter, more accessible, less artifact-noisy, and more current as a staff-engineer narrative."
