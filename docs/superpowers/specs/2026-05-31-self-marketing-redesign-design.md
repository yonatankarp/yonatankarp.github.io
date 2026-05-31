# Self-Marketing Website Redesign Design

## Goal

Make the site a stronger self-marketing website for Yonatan Karp-Rudin, optimized primarily for Staff+ backend engineering hiring while still supporting a broad personal brand across fintech systems, open source, technical writing, and architecture collaboration.

## Non-Negotiable Constraints

- Blog posts must continue to render from Markdown in `content/blog/*.md`.
- Blog content and context must not be changed. This means no edits to blog post bodies, titles, descriptions, tags, dates, categories, summaries, or front matter during this redesign.
- Existing local blog image paths under `/images/blog/**` must remain valid, because blog Markdown and front matter reference them.

## Direction

Use the **Architect + Proof** direction.

The visual language should feel editorial, architectural, and distinctive: a clear point of view, system-map visual motifs, strong typography, and a calmer page rhythm than a generic portfolio. The content strategy should stay proof-oriented: the first viewport must quickly establish Staff-level credibility through role, domain, OSS, writing, location, CV, and contact signals.

The first impression should be: "This is a strong technical operator with proof across fintech, OSS, and writing."

## Audience And Conversion

Primary audience:

- Hiring managers, engineering leaders, and recruiters evaluating Staff or Principal backend engineering candidates.

Secondary audiences:

- People evaluating architecture consulting or fractional backend leadership.
- Open-source users and collaborators.
- Readers arriving through blog posts.

Primary conversion path:

- Permanent Staff+ backend roles should be the clearest path through the site, especially through header, hero CTA, CV, and contact sections.

Secondary conversion paths:

- Consulting, collaboration, OSS, speaking, and writing should remain visible, but not compete with Staff+ hiring as the main path.

## Architecture

Keep Hugo.

Hugo is already the right fit because the site is static, content-heavy, Markdown-first, deployed to GitHub Pages, and has existing custom templates for homepage, blog, CV, skills, search, RSS, and taxonomies. A framework migration would increase risk without improving the marketing outcome.

The implementation should refine the current structure:

- `data/home/en.yaml` remains the homepage marketing data source.
- `layouts/index.html` renders the homepage sections.
- `content/blog/*.md` remains the blog source of truth.
- `layouts/blog/list.html` and `layouts/blog/single.html` continue to render blog index and article pages.
- `assets/css/custom.css` remains the centralized design system.
- `static/js/site.js` remains the small client-side behavior layer.

## Homepage Design

### Hero

The hero should combine point of view and proof in the same viewport.

Required elements:

- Name: Yonatan Karp-Rudin.
- Role: Staff Software Engineer.
- Point-of-view headline about turning ambiguous backend domains into operable systems.
- Short supporting copy focused on fintech, payments, risk, compliance, platform systems, and backend ownership.
- Primary CTA to contact.
- Secondary CTA to CV or proof.
- Compact credibility signals: Staff SWE, Billie, Berlin, fintech systems, OSS, technical writing.
- An architecture/system-map visual, not a generic profile card.

The visual should feel closer to the approved "Architect Narrative" option than a conventional portfolio card, but it must not hide credibility below the fold.

### Proof

Replace generic proof cards with case-study-lite blocks.

Each proof item should support:

- Context: the ambiguous or high-stakes problem.
- Decision: the architectural or technical judgment applied.
- Result: the operational, product, or team benefit.

Initial proof topics:

- Compliance service foundations.
- Risk orchestration and fraud-provider integration.
- Platform leverage through tooling, templates, and operational runbooks.
- OSS and API-first contributions where relevant.

### Experience

Keep the timeline model, but improve scan value.

Each role should make it easy to see:

- Company and domain.
- Role level.
- Time period.
- High-impact responsibilities.
- Staff-level scope, where available.

Do not rewrite experience Markdown unless the implementation plan explicitly scopes a non-blog content update.

### Selected Work

Selected work should support the Staff+ backend narrative.

Prioritize:

1. OpenAPI Generator contributions.
2. `ff4k`.
3. Other technical tools or documentation sites.
4. More playful or experimental projects after the strongest engineering proof.

The section should avoid feeling like a broad archive. It should explain why each item proves technical judgment, delivery, or community credibility.

### Writing

The blog content stays untouched.

The UI should curate writing better by giving Staff-relevant backend articles stronger visual priority. The current "Start here" behavior should not accidentally make the XKCD article the main Staff-level proof.

Allowed changes:

- Change homepage writing selection logic.
- Change blog index layout.
- Add non-content UI grouping labels such as architecture, production debugging, Kotlin/JVM, or reliability if derived from existing tags or template logic.
- Improve summaries through template rendering only.

Disallowed changes:

- Editing blog article text.
- Editing blog titles, descriptions, tags, dates, categories, or front matter.
- Rewriting summaries inside Markdown.

### Testimonials And Contact

Testimonials should appear earlier or be sampled near proof so third-party credibility is visible before the bottom of the page.

The contact section should make this hierarchy clear:

1. Permanent Staff+ backend roles.
2. Architecture consulting or focused advisory.
3. OSS, writing, and collaboration.

## Blog Preservation

The implementation must preserve these blog behaviors:

- `content/blog/*.md` remains the source of truth.
- `type: "blog"` continues routing posts to blog templates.
- `content/blog/_index.md` continues feeding blog index title and body.
- `.Content` renders inside article body.
- Goldmark Markdown, headings, code fences, tables, blockquotes, images, raw imported HTML, and shortcodes continue to render.
- Existing front matter fields remain supported: `title`, `date`, `draft`, `type`, `description`, `tags`, `categories`, `translationKey`, `featured`, and `images.featured_image`.
- `.Summary`, `.Description`, `.WordCount`, `.Date`, `.GetTerms "tags"`, `.PrevInSection`, `.NextInSection`, `.Fragments.Headings`, and `.TableOfContents` continue to work.
- Existing image paths under `/images/blog/**` remain valid.

## Quality And Security Requirements

Before completion, the implementation should verify:

- Hugo production build passes.
- Blog index and at least one article render from Markdown.
- No local `/images/blog/**` references are broken.
- Search page supports query handoff from `/search/?q=...`.
- Home, blog, article, CV, search, skills, and 404 pages have desktop and mobile smoke coverage.
- No obvious responsive text overlap or clipped controls.
- Mobile navigation and theme toggle work.
- No duplicate analytics script is introduced.

Security hardening should be practical and content-preserving:

- Prefer escaped/plain summaries over `safeHTML` in list cards where possible.
- Avoid adding new inline scripts.
- Prefer explicit `https://` for third-party scripts.
- Do not disable Goldmark unsafe rendering unless raw imported blog HTML has first been converted without changing blog context.

## Files Likely To Change

- `data/home/en.yaml`
- `layouts/index.html`
- `layouts/partials/site-header.html`
- `layouts/blog/list.html`
- `layouts/blog/single.html`
- `layouts/_default/search.html`
- `layouts/_default/cv.html`
- `layouts/partials/head.html`
- `assets/css/custom.css`
- `static/js/site.js`
- `package.json`
- `Makefile`
- `.gitignore`

## Out Of Scope

- Migrating away from Hugo.
- Editing blog Markdown content or metadata.
- Rewriting Hebrew content or re-enabling Hebrew.
- Creating a CMS.
- Adding heavy client-side app behavior.
- Changing the deployment platform unless needed later for security headers.

## Acceptance Criteria

- The homepage communicates Staff+ backend credibility in the first viewport.
- The visual direction feels architectural/editorial rather than generic portfolio.
- The proof sections show judgment and outcomes, not only responsibilities.
- The CV/contact path is clear for Staff+ hiring.
- The site still works as a broader personal brand through OSS, writing, testimonials, and selected work.
- Blog posts render from Markdown and blog content/context remains unchanged.
- Existing blog image references continue to resolve.
- Build and smoke checks pass.
