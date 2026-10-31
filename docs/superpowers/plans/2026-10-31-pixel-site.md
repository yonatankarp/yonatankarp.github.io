# Pixel Skin for the Rest of the Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One top bar on every page, and the CV's pixel skin on the projects list, case studies, search, skills and 404, with an image slot that only appears once a project's Draw Things painting exists.

**Architecture:** The CV's tokens and components move out of `.cv-page` into a shared `.px-skin` block in `assets/css/custom.css`. A new partial `pixel-bar.html` replaces `site-header.html` in `baseof.html` and the CV's own bar. `baseof.html` adds `px-skin px-page` to `<body>` only for the in-scope page types, so the blog, tags and other lists keep their old look under the new bar. The projects list and the CV are standalone templates. Case studies get their own `layouts/projects/single.html`.

**Tech Stack:** Hugo (v0.160.0+), plain CSS, vanilla JS, Node check scripts in `scripts/`, Playwright for visual capture.

**Spec:** `docs/superpowers/specs/2026-10-31-pixel-site-design.md`

**Reference spike (read, do not merge):** worktree `../yonatankarp.github.io-projects-spike`, branch `spike/pixel-projects`: `layouts/projects/list.html`, `layouts/partials/pixel-bar.html`, and the `SPIKE` blocks at the end of `assets/css/custom.css`. Yonatan approved how its /projects/ page looks.

## Global Constraints

- Work on one branch, `feat/pixel-site`, cut from `main`. Nothing merges until every task is done.
- Out of scope: reskinning the blog list, blog posts, tag pages and `static/madeira-2026/`. The blog gets the new top bar and nothing else.
- No animation, canvas or banners outside the homepage. No header art on any page (the CV loses `.cv-head__art`).
- Jersey 15 (`--pixel-font`) is for display text only; body text is Outfit.
- Top bar items, in order: name plate "Yonatan Karp-Rudin" (links to `/`), tabs **Projects · Blog · CV**, then **Download CV** (`/yonatan-karp-rudin-cv.pdf`, `download`). At 760px and below, the Download CV text is hidden and the icon stays.
- No "Building", "Home", "About" or "Search" tab.
- The layout works at 390px wide with no horizontal scroll.
- Keep focus rings drawn inside the stepped clip-path, a skip link per page, and readable contrast on amber and dark buttons.
- Delete old CSS and JS once nothing uses them; do not leave dead code.
- Commit messages and docs: no em dashes. End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- `npm run check` and `npm run visual:capture` pass at the end of every task.

## Review Focus

1. **Blog pages after the header swap.** `/blog/`, a post and `/tags/<tag>/` must look as they do on main apart from the bar. A shared token name (`--ink`, `--panel`) leaking into old CSS would recolour them. Pinned in Task 1 (screenshot compare of `/blog/` and a post against main).
2. **Current-tab highlighting on nested URLs.** `/projects/ff4k/`, `/blog/page/2/` and `/tags/kotlin/` must highlight Projects, Blog and Blog. Hugo's `/blog` menu URL has no trailing slash today. Pinned in Task 1's check.
3. **A project with no painting.** No empty `<img>`, no placeholder box, no broken `src` on the card or the case study. Pinned in Task 2 and Task 3 checks.
4. **Outbound vs case-study links.** A card without `caseStudy: true` must open `link` in a new tab with `rel="noopener"`, and show its `params.button.btnText` with ↗. Pinned in Task 2's check.
5. **The CV PDF.** The bar must not print, and the PDF must stay within 2 A4 pages. Pinned in Task 1 by `npm run check:cv-print`.

---

### Task 1: Shared pixel skin and top bar on every page

**Files:**
- Create: `layouts/partials/pixel-bar.html`
- Modify: `assets/css/custom.css` (the `.cv-page` block from line 3751: split into a shared `.px-skin` block and a CV-only block; add `.px-bar` styles; delete `.site-header`, `.brand`, `.menu-toggle`, `.primary-nav` rules)
- Modify: `layouts/_default/baseof.html` (swap the header partial; body classes)
- Modify: `layouts/partials/head.html:41` (add `family=Jersey+15` to the existing Google Fonts link)
- Modify: `layouts/_default/cv.html` (use the partial; remove `.cv-head__art`; drop its own Jersey 15 link, line 12) and `layouts/index.html:28` (drop its Jersey 15 link)
- Delete: `layouts/partials/site-header.html`
- Modify: `assets/js/site.js` (delete the `.menu-toggle` block, lines 5 to 30)
- Modify: `hugo.toml` (delete the `[menus]` block, lines 99 to 124)
- Modify: `scripts/check-generated-html.js`, `scripts/capture-screenshots.js`

**Interfaces:**
- Produces: partial `pixel-bar.html`, called as `{{ partial "pixel-bar.html" . }}` with the page as context. Markup: `<header class="px-bar">`, `.px-bar__left` holding `a.px-bar__name` and `nav.px-bar__tabs[aria-label="Site"]`, then `a.px-download`. The current tab has `aria-current="page"`.
- Produces: CSS class `.px-skin`, which carries the tokens `--ink --panel --panel-hi --well --px-text --px-soft --amber --px --pixel-font --stepped` plus body font and background, and the shared components `.px-sheet` (the dark panel, from `.cv`), `.px-kicker`, `.px-section` with its `h2` rule (from `.cv-section` / `.cv-page h2`), and `.px-chip`. `.px-bar` declares the same tokens itself so it renders correctly on old-style pages.
- Produces: `<body>` in baseof gets `px-skin px-page` when `or (eq .Type "projects") (eq .Type "search") (eq .Type "skills") (eq .Kind "404")`.

- [ ] **Step 1: Write the failing check.** In `scripts/check-generated-html.js`, for every built route except `/` and `/madeira-2026/` and redirect pages, assert:
  - exactly one `class="px-bar"`;
  - tab hrefs in order `/projects/`, `/blog/`, `/cv/`;
  - one `px-download` linking to `/yonatan-karp-rudin-cv.pdf`;
  - `aria-current="page"` on the Projects tab for routes under `/projects/`, on Blog for routes under `/blog/` and `/tags/`, on CV for `/cv/`, and on no tab otherwise;
  - no `site-header` or `menu-toggle` anywhere.

  On every page with `px-bar`, also assert the Google Fonts link includes `Jersey+15` (exactly one such link). On `/cv/`, assert there is no `cv-head__art`.
- [ ] **Step 2: Run it and watch it fail.** Run `npm run build && npm run check:generated-html`. Expected: FAIL listing `missing px-bar` for `/blog/`, `/projects/`, `/cv/` and others.
- [ ] **Step 3: Build the partial and skin.** Port `pixel-bar.html` from the spike, with these renames: `cv-bar*` becomes `px-bar*`, `cv-download` becomes `px-download`. Match the current tab with `hasPrefix .RelPermalink`, and treat `/tags/` as Blog. Move the tokens and the shared components into `.px-skin`, and rename `--cv-text`/`--cv-soft` to `--px-text`/`--px-soft` everywhere. On the CV body, use `class="px-skin cv-page"`. In print, hide `.px-bar` where `.cv-bar` was hidden.
- [ ] **Step 4: Update the visual capture routes.** In `scripts/capture-screenshots.js`, set `requireMobileNav: false` on every route and delete the mobile-nav assertion (its line-65 text and its checks at lines 334 and 391 to 414). Add `[".px-bar__name", 1, "name plate"]` and `[".px-download", 1, "CV download"]` to the projects, blog, cv and post routes. These replace the cv route's `.cv-bar__name` and `.cv-download` checks.
- [ ] **Step 5: Run and pass.** Run `npm run check && npm run visual:capture`. Expected: all pass, and the CV PDF is at most 2 pages.
- [ ] **Step 6: Compare the blog by eye.** Capture `/blog/` and `/blog/self-compiling-second-brain/` on main and on the branch at 1400px and 390px. Below the bar, they must be identical. If they differ, a token leaked: scope it under `.px-skin`/`.px-bar`.
- [ ] **Step 7: Commit.** Message: `feat(site): one pixel top bar on every page`.

### Task 2: Projects list in the pixel skin

**Files:**
- Modify: `layouts/projects/list.html` (rewrite as a standalone page, as in the spike)
- Delete: `layouts/partials/project-entry.html`, its `.project-entry*` and `.project-list*` CSS, and the old `/projects` page-head CSS if unused
- Delete: `scripts/generate-project-thumbnails.js`, the `project-thumbnails:generate` npm script, and the 15 generated PNGs in `assets/images/projects/`
- Move: `assets/images/projects/{emmas-inferno,jacobs-choice,larry-the-last-zombie}.jpg` to `web3d/pixel/paintings/reference/` (references for the later paintings, deleted after painting)
- Create: `layouts/partials/project-painting.html`
- Modify: `assets/css/custom.css` (`.px-card` styles from the spike, renamed onto `.px-skin` tokens)
- Modify: `scripts/check-generated-html.js`, `scripts/capture-screenshots.js`

**Interfaces:**
- Consumes: `pixel-bar.html`, `.px-skin`, `.px-sheet`, `.px-section`, `.px-chip` from Task 1.
- Produces: partial `project-painting.html`, called with `(dict "page" $p "max" 640)`. It looks up `assets/images/projects/pixel/<File.BaseFileName>.png` and renders nothing when the file is missing. Otherwise it renders `<img class="px-painting" alt="{title} painting">`, resized with `.Resize "<w>x NearestNeighbor"` where `w = mul $img.Width (div $max $img.Width)` (the largest whole multiple that fits; native size if the source is wider than `max`), with `image-rendering: pixelated`.

- [ ] **Step 1: Write the failing check.** On `/projects/`:
  - `h2` texts are exactly "My projects" then "Open-source contributions";
  - there is one `li.px-card` per project page (count the `content/projects/*.md` files other than `_index.md`, currently 15);
  - every card whose source has `caseStudy: true` has a `.px-cta` reading "Case study" and an internal href;
  - every other card's link has `target="_blank"` and `rel="noopener"`, and its CTA text equals its `btnText`;
  - there is no `px-pic`, no `cv-head__art` and no element with an empty `src`;
  - the page has no `px-page` footer.

  Paintings are read from disk: for each project, if `assets/images/projects/pixel/<slug>.png` exists, its card has exactly one `img.px-painting` with non-empty alt; otherwise the card has no `img`. (Zero paintings exist at first, so the check must pass with none.) To exercise the painting branch by hand, copy any PNG to `assets/images/projects/pixel/ff4k.png`, build, run the check, then delete it; never commit it.
- [ ] **Step 2: Run it and watch it fail.** Run `npm run build && npm run check:generated-html`. Expected: FAIL on the missing `px-card`.
- [ ] **Step 3: Implement.** Port the spike's list.html, with these changes:
  - `body class="px-skin px-projects"`;
  - the pixel bar partial;
  - no image slot, only the painting partial;
  - CTA `Case study →` (amber `.px-cta`), or `btnText ↗` (`.px-cta.px-cta--out`), defaulting to "View";
  - the whole card links via the title link's `::after`;
  - grid of 3 columns, then 2 below 1000px, then 1 below 640px.

  Keep the kicker "Parking · Projects".
- [ ] **Step 4: Run and pass.** Run `npm run check && npm run visual:capture`. Also take a 1400px screenshot of `/projects/` and compare it against the spike at `http://localhost:1314/projects/`. Expected: identical apart from the missing placeholder slots.
- [ ] **Step 5: Commit.** Message: `feat(projects): pixel project cards with paintings when present`.

### Task 3: Case-study pages

**Files:**
- Create: `layouts/projects/single.html` (via baseof; `define "main"`)
- Modify: `layouts/_default/single.html` (delete the `eq .Type "projects"` branch, lines 8 to 26)
- Modify: `layouts/partials/site-footer.html` and its CSS (footer restyled under `.px-page` only)
- Modify: `assets/css/custom.css` (`.px-prose`: headings in Jersey 15, Outfit body, links in amber, `pre`/`code`/tables in `.px-well` frames; build these so the blog project can reuse them)
- Modify: `scripts/check-generated-html.js`

**Interfaces:**
- Consumes: `.px-skin`, `.px-page`, `.px-sheet`, `.px-kicker`, `.px-chip`, `project-painting.html` (with `"max" 1200`).
- Produces: `.px-prose`, the reusable article-body class.

- [ ] **Step 1: Write the failing check.** For each `/projects/<slug>/` page:
  - body has `px-skin px-page`;
  - one `h1` equal to the title without " (contributor)";
  - a `.px-kicker` with the projectKind;
  - years and tech chips;
  - an "Open project ↗" link to `link` with `rel="noopener"`;
  - content inside `.px-prose`;
  - no `article__cover` and no empty `src`; one `img.px-painting` only if `assets/images/projects/pixel/<slug>.png` exists, read from disk as in Task 2;
  - a footer containing the GitHub, LinkedIn and email links.

  Note: today, case-study pages render only for the 6 `caseStudy: true` projects, because the others have `build.render: never`.
- [ ] **Step 2: Run it and watch it fail.** Run `npm run build && npm run check:generated-html`.
- [ ] **Step 3: Implement** the template and the CSS. A visible copy button on code blocks already comes from `assets/js/site.js:58`, but it only targets `.article__content pre`, so keep that class on the prose wrapper (`class="article__content px-prose"`).
- [ ] **Step 4: Run and pass.** Run `npm run check && npm run visual:capture`. Add a capture route `{ name: "case-study", path: "/projects/ff4k/" }` that requires `.px-bar__name` and `.px-prose`.
- [ ] **Step 5: Commit.** Message: `feat(projects): pixel case-study pages`.

### Task 4: Search, skills and 404

**Files:**
- Modify: `layouts/_default/search.html`, `layouts/skills/list.html`, `layouts/404.html` (wrap in `.px-sheet` and use `.px-kicker`, `.px-section`, `.px-chip`; drop the `reveal` classes)
- Modify: `assets/css/custom.css` (`.search-input`/`.search-result` restyled under `.px-page`; delete `.page-head`, `.practice-card`, `.skill-pill*` and `.hero__actions` rules if nothing else uses them)
- Modify: `scripts/check-generated-html.js`, `scripts/capture-screenshots.js`

**Interfaces:**
- Consumes: everything from Task 1 and `site.js`'s search hooks `#site-search` and `#search-results` (keep both ids).

- [ ] **Step 1: Write the failing check.**
  - `/search/`, `/skills/` and `/404.html` have body classes `px-skin px-page`, one `.px-sheet` and no `class="reveal`.
  - `/search/` still has `#site-search` and `#search-results`.
  - `/404.html` links to `/` and `/blog/`.
- [ ] **Step 2: Run it and watch it fail.**
- [ ] **Step 3: Implement.** In the skills copy, "Where he is strongest" and the other "he" lines are page content. Leave the wording alone.
- [ ] **Step 4: Run and pass.** Run `npm run check && npm run visual:capture`. Add capture routes for `/search/` and `/skills/`. In a browser, type "kotlin" into `/search/`. Expected: results appear, styled as pixel cards.
- [ ] **Step 5: Commit.** Message: `feat(site): pixel search, skills and 404 pages`.

### Task 5: Pause button label on the homepage

**Files:**
- Modify: `layouts/index.html:47-49` (add `<span data-building-pause-label>Pause</span>` inside `.building-pause`)
- Modify: `web3d/src/pixel.js:80-84` (`label()` also sets the span's text to "Pause" or "Play")
- Modify: `web3d/src/pixel.css` (show the span beside the icon; hide it at 760px and below, as with `.building-download span`)
- Modify: `scripts/capture-screenshots.js` (home route)

- [ ] **Step 1: Write the failing check.** On the home route at desktop size, require `[data-building-pause-label]` to be visible with the text "Pause". After clicking `.building-pause`, the text is "Play". On mobile, the label is hidden and the button is still at least 36x36px.
- [ ] **Step 2: Run it and watch it fail.** Run `npm run visual:capture`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run and pass.** Run `npm run check && npm run visual:capture`.
- [ ] **Step 5: Commit.** Message: `feat(home): visible label on the pause button`.

### Task 6: Final pass

- [ ] **Step 1: Look for dead CSS and JS.** Grep `assets/css/custom.css` for every class prefix deleted from templates in Tasks 1 to 4 (`site-header`, `brand`, `menu-toggle`, `primary-nav`, `project-entry`, `project-list`, `page-head`, `practice-card`, `skill-pill`, `cv-bar`, `cv-download`, `cv-head__art`). For each one, run `grep -r` over `layouts/` and `assets/js/`, and delete the rule if nothing uses it. Keep anything the blog still uses.
- [ ] **Step 2: Update the project CLAUDE.md.** Fix `static/js/site.js` to `assets/js/site.js`. In one line, say the pixel skin lives in `.px-skin` in `assets/css/custom.css` and the top bar is `layouts/partials/pixel-bar.html`.
- [ ] **Step 3: Run everything.** Run `npm run check && npm run visual:capture`. Expected: all pass.
- [ ] **Step 4: Commit.** Message: `chore(site): drop the old header and project styles`.
