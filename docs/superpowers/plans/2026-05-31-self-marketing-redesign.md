# Self-Marketing Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the site into an Architect + Proof self-marketing website for Staff+ backend hiring while preserving Markdown blog rendering and unchanged blog content/context.

**Architecture:** Keep Hugo and refine the existing custom templates. Homepage marketing data stays in `data/home/en.yaml`; blog posts stay in `content/blog/*.md`; templates and CSS handle presentation, curation, search, and QA without changing blog Markdown.

**Tech Stack:** Hugo, Go templates, Goldmark Markdown, centralized CSS in `assets/css/custom.css`, vanilla JS in `static/js/site.js`, Node scripts for quality checks, optional Playwright for browser smoke tests.

---

## File Structure

- Modify `data/home/en.yaml`: Add structured hero proof signals, case-study proof blocks, curated writing list, contact hierarchy, and selected-work order.
- Modify `layouts/index.html`: Render the Architect + Proof homepage, including architecture-map visual, credibility strip, case-study proof, testimonial excerpt, curated writing, and clearer contact path.
- Modify `layouts/partials/site-header.html`: Add persistent Staff Software Engineer positioning and a CV navigation affordance.
- Modify `hugo.toml`: Add CV menu entry if missing and keep Hugo/blog configuration intact.
- Modify `layouts/blog/list.html`: Improve blog curation presentation without editing post content or metadata.
- Modify `layouts/blog/single.html`: Preserve `.Content` rendering while improving article shell compatibility if needed.
- Modify `layouts/_default/search.html`: Keep search markup compatible with query handoff.
- Modify `static/js/site.js`: Add URL query search initialization and keep menu/theme/reveal behavior.
- Modify `layouts/partials/head.html`: Use explicit HTTPS for GoatCounter and avoid new inline scripts.
- Modify `assets/css/custom.css`: Implement the Architect + Proof visual system and responsive polish.
- Modify `package.json`: Add quality-check scripts.
- Create `scripts/check-blog-assets.js`: Fail when local blog image references are missing.
- Optional create `tests/smoke/site-smoke.spec.js` and `playwright.config.js`: Browser smoke test major pages if Playwright is available or added.

## Task 1: Preserve Blog Assets And Add Asset Gate

**Files:**
- Create: `scripts/check-blog-assets.js`
- Modify: `package.json`
- Preserve: `static/images/blog/**`

- [ ] **Step 1: Confirm current blog image references**

Run:

```bash
rg -n "/images/blog/|images:\\s*$|featured_image" content/blog
```

Expected: output includes local `/images/blog/...` references from Markdown bodies and front matter.

- [ ] **Step 2: Restore path compatibility for deleted blog images**

If `git status --short static/images/blog` shows deleted files, restore those files so existing `/images/blog/**` URLs remain valid:

```bash
git restore -- static/images/blog
```

Expected:

```bash
git status --short static/images/blog
```

prints no deleted `static/images/blog/**` entries.

If `git restore` cannot be used because images were intentionally moved, copy or generate the same files at the same `static/images/blog/**` paths before proceeding. Do not edit blog Markdown to point elsewhere.

- [ ] **Step 3: Write the asset checker**

Create `scripts/check-blog-assets.js`:

```javascript
#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const blogDir = path.join(root, 'content', 'blog');
const missing = new Set();

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function checkReference(file, ref) {
  if (!ref.startsWith('/images/blog/')) return;
  const local = path.join(root, 'static', ref);
  if (!fs.existsSync(local)) {
    missing.add(`${path.relative(root, file)} -> ${ref}`);
  }
}

const files = walk(blogDir).filter((file) => file.endsWith('.md'));
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(/!\[[^\]]*\]\((\/images\/blog\/[^)\s]+)(?:\s+\"[^\"]*\")?\)/g)) {
    checkReference(file, match[1]);
  }
  for (const match of text.matchAll(/featured_image:\s*[\"']?(\/images\/blog\/[^\"'\s]+)[\"']?/g)) {
    checkReference(file, match[1]);
  }
}

if (missing.size) {
  console.error('Missing local blog assets:');
  for (const item of [...missing].sort()) console.error(`- ${item}`);
  process.exit(1);
}

console.log(`Checked ${files.length} blog markdown files; all local blog assets exist.`);
```

- [ ] **Step 4: Add quality scripts**

Update `package.json` scripts to include:

```json
{
  "scripts": {
    "build": "hugo --gc --minify",
    "build:local": ".tools/hugo/hugo --gc --minify",
    "serve": "hugo server",
    "serve:local": ".tools/hugo/hugo server",
    "check:blog-assets": "node scripts/check-blog-assets.js",
    "check": "npm run check:blog-assets && npm run build"
  }
}
```

Keep existing workspace configuration unchanged.

- [ ] **Step 5: Run the new gate**

Run:

```bash
npm run check:blog-assets
```

Expected: the command prints that all local blog assets exist.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-blog-assets.js package.json package-lock.json static/images/blog
git commit -m "test: guard blog asset references"
```

## Task 2: Model Architect + Proof Homepage Data

**Files:**
- Modify: `data/home/en.yaml`

- [ ] **Step 1: Replace hero data with Staff+ proof structure**

Update the `hero` block so it includes these keys:

```yaml
hero:
  eyebrow: "Staff Software Engineer · Berlin"
  title: "I turn ambiguous backend domains into systems teams can operate."
  lede: "Staff-level backend work across fintech, payments, risk, compliance, and platform systems: contracts, migrations, failure modes, runbooks, and production ownership."
  primaryAction:
    label: "Talk about Staff+ roles"
    url: "#contact"
  secondaryAction:
    label: "View CV"
    url: "/cv/"
  proofSignals:
    - label: "Current"
      text: "Staff Software Engineer at Billie"
    - label: "Domains"
      text: "Payments, risk, compliance, platform systems"
    - label: "Public proof"
      text: "OpenAPI Generator, ff4k, Kotlin/backend writing"
    - label: "Based in"
      text: "Berlin, Germany"
  links:
    - label: "GitHub"
      url: "https://github.com/yonatankarp"
    - label: "LinkedIn"
      url: "https://www.linkedin.com/in/yonatankarp/"
    - label: "kotlinbackend.com"
      url: "https://kotlinbackend.com"
```

Keep any existing keys needed by templates until `layouts/index.html` is updated in Task 3.

- [ ] **Step 2: Replace proof items with case-study blocks**

Update `proof.items` to this shape:

```yaml
proof:
  kicker: "Proof"
  title: "Staff-level judgment across systems that need to keep working."
  items:
    - label: "Compliance service foundation"
      title: "Giving transaction monitoring, screening, and sanction checks explicit boundaries."
      context: "Compliance workflows needed clearer ownership and interfaces before implementation could scale safely."
      decision: "Authored the technical spec, service boundaries, interface definitions, and integration plan around operational handoff."
      result: "Created a foundation teams could build on without burying audit-sensitive logic inside incidental service behavior."
    - label: "Risk orchestration"
      title: "Integrating fraud providers without turning the domain into a vendor adapter."
      context: "Risk assessment needed external provider integration while preserving Billie-owned domain language and release control."
      decision: "Co-designed service shape, OpenAPI-first contracts, retries, and migration path around the risk workflow."
      result: "Kept the integration explicit, testable, and operable instead of coupling core risk behavior to a third-party API."
    - label: "Platform leverage"
      title: "Reducing repeated setup and operational ambiguity through internal tooling."
      context: "Teams repeatedly solved the same setup, monitoring, and runbook problems around backend services."
      decision: "Built Backstage tooling, Kafka DLT runbooks, repository templates, shared libraries, and service feedback loops."
      result: "Turned individual operational lessons into reusable team leverage."
```

- [ ] **Step 3: Reorder selected work**

Set `selectedWork` order to:

```yaml
selectedWork:
  - name: "OpenAPI Generator"
    kind: "Upstream contribution"
    text: "Spring Boot 4 and Jackson 3 support for the Kotlin Spring generator, plus Retrofit and model-generation fixes."
    link: "https://github.com/OpenAPITools/openapi-generator"
    linkLabel: "GitHub"
  - name: "ff4k"
    kind: "Open source library"
    text: "Kotlin Multiplatform feature flags library with DSL configuration, storage backends, and coroutine-safe context propagation."
    link: "https://yonatankarp.github.io/ff4k/"
    linkLabel: "Docs"
  - name: "kotlin-design-patterns"
    kind: "Technical writing / docs"
    text: "Idiomatic Kotlin implementations of software design patterns with a maintained documentation site."
    link: "https://yonatankarp.github.io/kotlin-design-patterns/"
    linkLabel: "Website"
  - name: "TaleKeeper"
    kind: "Self-hosted tool"
    text: "AI-powered TTRPG session recorder with live transcription, speaker diarization, and structured session summaries."
    link: "https://yonatankarp.github.io/TaleKeeper/"
    linkLabel: "Docs"
```

- [ ] **Step 4: Add contact hierarchy**

Update `contact` to include:

```yaml
contact:
  kicker: "Contact"
  title: "Useful conversations start with the shape of the work."
  text: "Best fit: permanent Staff+ backend roles in systems where product ambiguity, correctness, compliance, or operational ownership matter."
  priorities:
    - "Permanent Staff+ backend roles"
    - "Architecture consulting or focused advisory"
    - "OSS, writing, and collaboration"
```

Keep existing `facts`, `email`, and `links` entries.

- [ ] **Step 5: Build after data changes**

Run:

```bash
npm run build
```

Expected: Hugo build succeeds. If templates still reference old keys, complete Task 3 before treating this as a failure.

- [ ] **Step 6: Commit**

```bash
git add data/home/en.yaml
git commit -m "content: shape homepage around architect proof"
```

## Task 3: Render Architect + Proof Homepage

**Files:**
- Modify: `layouts/index.html`

- [ ] **Step 1: Update hero proof rendering**

Replace old `hero__notes` rendering with:

```go-html-template
<div class="hero__proof-strip" aria-label="Credibility signals">
  {{ range $home.hero.proofSignals }}
  <div class="hero__proof-item">
    <span>{{ .label }}</span>
    <strong>{{ .text }}</strong>
  </div>
  {{ end }}
</div>
```

- [ ] **Step 2: Replace product card with architecture map**

In `.hero__visual`, replace the current `product-card` body with:

```go-html-template
<div class="architecture-panel">
  <div class="architecture-panel__header">
    {{ with $showcaseImage }}<img src="{{ .RelPermalink }}" alt="Portrait of Yonatan Karp-Rudin">{{ end }}
    <div>
      <p>Yonatan Karp-Rudin</p>
      <strong>Staff Software Engineer</strong>
      <span>Architecture · Systems · Delivery</span>
    </div>
  </div>
  <div class="architecture-map" aria-hidden="true">
    <span class="architecture-map__node architecture-map__node--core">domain</span>
    <span class="architecture-map__node">contracts</span>
    <span class="architecture-map__node">events</span>
    <span class="architecture-map__node">risk</span>
    <span class="architecture-map__node">payments</span>
    <span class="architecture-map__node">runbooks</span>
  </div>
  <div class="architecture-panel__flow" aria-label="Working model">
    <div><span>01</span><strong>Clarify</strong></div>
    <div><span>02</span><strong>Design</strong></div>
    <div><span>03</span><strong>Operate</strong></div>
  </div>
</div>
```

Keep the lead-post signal only if it is selected by explicit Staff-relevant logic in Step 4.

- [ ] **Step 3: Render proof as Context / Decision / Result**

Update proof card body to:

```go-html-template
<article class="case-card reveal">
  <p class="case-card__label">{{ .label }}</p>
  <h3>{{ .title }}</h3>
  <dl class="case-card__details">
    <div>
      <dt>Context</dt>
      <dd>{{ .context }}</dd>
    </div>
    <div>
      <dt>Decision</dt>
      <dd>{{ .decision }}</dd>
    </div>
    <div>
      <dt>Result</dt>
      <dd>{{ .result }}</dd>
    </div>
  </dl>
</article>
```

- [ ] **Step 4: Use Staff-relevant writing selection without editing posts**

Replace:

```go-html-template
{{ $posts := first 3 (sort (where .Site.RegularPages "Type" "blog") "Date" "desc") }}
```

with:

```go-html-template
{{ $allPosts := sort (where .Site.RegularPages "Type" "blog") "Date" "desc" }}
{{ $prioritySlugs := slice "observability-in-action-opentelemetry" "build-domain-gateway-openapi" "fix-misconfigurations-redistemplate" "openapi-robust-restful-api" }}
{{ $priorityPosts := slice }}
{{ range $slug := $prioritySlugs }}
  {{ with index (where $allPosts "File.BaseFileName" $slug) 0 }}
    {{ $priorityPosts = $priorityPosts | append . }}
  {{ end }}
{{ end }}
{{ $posts := first 3 (default $allPosts $priorityPosts) }}
```

This changes homepage curation only. It does not edit blog content or metadata.

- [ ] **Step 5: Move one testimonial excerpt near proof**

After the proof grid, render the first testimonial:

```go-html-template
{{ with index $testimonials 0 }}
<aside class="proof-quote reveal">
  <blockquote>{{ .Content | plainify }}</blockquote>
  <p>{{ .Params.name }} · {{ .Params.position }}</p>
</aside>
{{ end }}
```

- [ ] **Step 6: Build**

Run:

```bash
npm run build
```

Expected: build succeeds and homepage renders without missing data errors.

- [ ] **Step 7: Commit**

```bash
git add layouts/index.html
git commit -m "feat: render architect proof homepage"
```

## Task 4: Strengthen Header, CV Path, And Contact

**Files:**
- Modify: `layouts/partials/site-header.html`
- Modify: `hugo.toml`
- Modify: `layouts/_default/cv.html`
- Modify: `layouts/index.html`

- [ ] **Step 1: Add role descriptor to header brand**

Update the brand block:

```go-html-template
<a class="brand" href="{{ .Site.Home.RelPermalink }}">
  <span class="brand__eyebrow">Yonatan Karp-Rudin</span>
  <span class="brand__name">Staff Software Engineer</span>
</a>
```

- [ ] **Step 2: Add CV to header menu**

In `hugo.toml`, add:

```toml
[[menus.header]]
name = "CV"
URL = "/cv/"
weight = 7
```

Shift Contact and Search weights after CV so order is Home, About, Experience, Skills, Projects, Blog, CV, Contact, Search.

- [ ] **Step 3: Add CV proof summary**

In `layouts/_default/cv.html`, after the summary section, add:

```go-html-template
<section class="cv-section cv-section--proof reveal">
  <h2>{{ if eq $lang "he" }}מיקוד{{ else }}Staff+ Focus{{ end }}</h2>
  <ul class="cv-proof-list">
    <li>Backend architecture for payments, risk, compliance, and platform systems.</li>
    <li>API-first service design with Kotlin, Java, Spring Boot, Kafka, Flink, OpenAPI, and Backstage.</li>
    <li>Operational ownership through runbooks, failure-mode thinking, observability, and migration plans.</li>
  </ul>
</section>
```

Do not alter blog content.

- [ ] **Step 4: Render contact priorities**

In the homepage contact block, render:

```go-html-template
{{ with $home.contact.priorities }}
<ol class="contact-priority">
  {{ range . }}<li>{{ . }}</li>{{ end }}
</ol>
{{ end }}
```

- [ ] **Step 5: Build**

Run:

```bash
npm run build
```

Expected: build succeeds and `/cv/` is reachable from the header.

- [ ] **Step 6: Commit**

```bash
git add layouts/partials/site-header.html hugo.toml layouts/_default/cv.html layouts/index.html
git commit -m "feat: clarify staff hiring path"
```

## Task 5: Improve Blog Presentation Without Content Changes

**Files:**
- Modify: `layouts/blog/list.html`
- Modify: `layouts/blog/single.html`

- [ ] **Step 1: Make blog index curation explicit**

Add a non-content sidebar section in `layouts/blog/list.html`:

```go-html-template
<section>
  <h3>{{ if eq $lang "he" }}מסלולי קריאה{{ else }}Reading tracks{{ end }}</h3>
  <div class="reading-tracks">
    <a href="/tags/openapi/">API design</a>
    <a href="/tags/observability/">Observability</a>
    <a href="/tags/kotlin/">Kotlin/JVM</a>
    <a href="/tags/spring-boot/">Spring Boot</a>
  </div>
</section>
```

These labels are UI curation only. Do not edit post tags.

- [ ] **Step 2: Escape summaries on listing cards**

Where summaries render in list cards, use:

```go-html-template
{{ .Description | default (.Summary | plainify) }}
```

Do not use `safeHTML` for summaries.

- [ ] **Step 3: Preserve article body rendering**

Verify `layouts/blog/single.html` still contains:

```go-html-template
<div class="article__content prose">
  {{ .Content }}
</div>
```

Do not replace `.Content` with `.Plain`, `.RawContent`, or data-driven rendering.

- [ ] **Step 4: Build and inspect generated article**

Run:

```bash
npm run build
test -f public/blog/observability-in-action-opentelemetry/index.html
rg -n "article__content|Table of contents|OpenTelemetry|code" public/blog/observability-in-action-opentelemetry/index.html
```

Expected: generated article exists and includes rendered Markdown content.

- [ ] **Step 5: Commit**

```bash
git add layouts/blog/list.html layouts/blog/single.html
git commit -m "feat: curate blog presentation"
```

## Task 6: Fix Search Query Handoff

**Files:**
- Modify: `static/js/site.js`
- Modify: `layouts/_default/search.html`

- [ ] **Step 1: Keep search input ID stable**

Verify `layouts/_default/search.html` contains:

```go-html-template
<input id="site-search" class="search-input search-input--large" type="search" name="q" placeholder="{{ .Params.placeholder | default `Search...` }}">
```

If `name="q"` is missing, add it.

- [ ] **Step 2: Refactor search rendering into a function**

In `static/js/site.js`, inside the `if (searchInput && searchResults)` block, add:

```javascript
const runSearch = (pages, query) => {
  const q = query.trim().toLowerCase();
  if (!q) {
    clearResults();
    return;
  }
  const filtered = pages.filter((page) => {
    return [page.title, page.summary, page.content].join(' ').toLowerCase().includes(q);
  }).slice(0, 10);
  render(filtered);
};
```

Use it from the `input` listener.

- [ ] **Step 3: Initialize from URLSearchParams**

After registering the input listener, add:

```javascript
const initialQuery = new URLSearchParams(window.location.search).get('q') || '';
if (initialQuery) {
  searchInput.value = initialQuery;
  runSearch(pages, initialQuery);
}
```

- [ ] **Step 4: Build and smoke search JSON**

Run:

```bash
npm run build
node -e "const fs=require('fs'); JSON.parse(fs.readFileSync('public/index.json','utf8')); console.log('index ok')"
```

Expected: prints `index ok`.

- [ ] **Step 5: Commit**

```bash
git add static/js/site.js layouts/_default/search.html
git commit -m "fix: initialize search from query string"
```

## Task 7: Apply Visual System And Responsive Polish

**Files:**
- Modify: `assets/css/custom.css`

- [ ] **Step 1: Add Architect + Proof component styles**

Add styles for:

```css
.hero__proof-strip {}
.hero__proof-item {}
.architecture-panel {}
.architecture-panel__header {}
.architecture-map {}
.architecture-map__node {}
.architecture-map__node--core {}
.architecture-panel__flow {}
.case-card {}
.case-card__label {}
.case-card__details {}
.proof-quote {}
.contact-priority {}
.reading-tracks {}
.cv-proof-list {}
```

Use existing palette variables and typography. Do not introduce a new one-note palette or decorative gradient blobs.

- [ ] **Step 2: Add responsive constraints**

Add mobile rules so hero, proof, selected work, blog cards, contact, and CV sections fit at 390px:

```css
@media (max-width: 720px) {
  .hero__proof-strip,
  .architecture-panel__flow,
  .case-card__details {
    grid-template-columns: 1fr;
  }

  .architecture-map {
    min-height: 260px;
  }
}
```

Extend existing responsive rules rather than creating a parallel stylesheet.

- [ ] **Step 3: Add focus and reduced-motion checks**

Verify CSS contains visible focus states for links/buttons and that reveal transitions respect:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto;
  }
}
```

- [ ] **Step 4: Build**

Run:

```bash
npm run build
```

Expected: build succeeds with CSS compiled.

- [ ] **Step 5: Commit**

```bash
git add assets/css/custom.css
git commit -m "style: polish architect proof design"
```

## Task 8: Security And Head Cleanup

**Files:**
- Modify: `layouts/partials/head.html`
- Inspect: `layouts/blog/summary.html`
- Inspect: `layouts/partials/head_custom.html`

- [ ] **Step 1: Use explicit HTTPS for GoatCounter**

Change:

```go-html-template
<script data-goatcounter="https://yonatankarp.goatcounter.com/count" async src="//gc.zgo.at/count.js"></script>
```

to:

```go-html-template
<script data-goatcounter="https://yonatankarp.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>
```

- [ ] **Step 2: Remove unsafe summaries if present**

Run:

```bash
rg -n "safeHTML|safeJS|safeURL" layouts
```

Expected: `safeJS` remains for JSON-LD only; no blog card summary uses `safeHTML`.

If `layouts/blog/summary.html` contains `.Summary | safeHTML`, replace it with:

```go-html-template
{{ .Description | default (.Summary | plainify) }}
```

- [ ] **Step 3: Check duplicate analytics partial**

Run:

```bash
rg -n "goatcounter|count.js|head_custom" layouts
```

Expected: GoatCounter is included only from `layouts/partials/head.html` in the active base template.

- [ ] **Step 4: Build**

Run:

```bash
npm run build
```

Expected: build succeeds.

- [ ] **Step 5: Commit**

```bash
git add layouts/partials/head.html layouts/blog/summary.html
git commit -m "chore: harden head and summaries"
```

## Task 9: Final Verification

**Files:**
- Modify: `docs/screenshots/fullsite-qa/**` if screenshots are regenerated
- Optional create: `playwright.config.js`
- Optional create: `tests/smoke/site-smoke.spec.js`

- [ ] **Step 1: Run full check**

Run:

```bash
npm run check
```

Expected: blog asset check passes and Hugo production build succeeds.

- [ ] **Step 2: Run security/content scan**

Run:

```bash
rg -n "unsafe = true|safeHTML|<script|<iframe|on[a-zA-Z]+\\s*=|javascript:|\\]\\(http://|src=\"//" hugo.toml layouts content static
```

Expected: known findings are understood. Do not edit blog Markdown to resolve imported legacy content during this redesign.

- [ ] **Step 3: Start local Hugo server**

Run:

```bash
npm run serve -- --bind 127.0.0.1 --port 1313 --disableFastRender
```

Expected: server starts at `http://127.0.0.1:1313/`.

- [ ] **Step 4: Browser smoke routes**

Inspect these routes on desktop and mobile widths:

```text
/
/blog/
/blog/observability-in-action-opentelemetry/
/cv/
/skills/
/search/?q=openapi
/404.html
```

Expected:

- No console errors.
- No overlapping hero/contact/header text at 390px.
- Mobile menu opens and closes.
- Theme toggle changes theme.
- `/search/?q=openapi` displays results without typing.
- Article page renders Markdown content and table of contents when headings exist.

- [ ] **Step 5: Stop local server**

Stop the Hugo server with `Ctrl-C`.

- [ ] **Step 6: Commit verification artifacts only if intentional**

If screenshots were regenerated and are intended to be tracked:

```bash
git add docs/screenshots/fullsite-qa
git commit -m "test: refresh redesign smoke screenshots"
```

If screenshots are not intentionally tracked for this run, leave them out of the commit.

## Self-Review

- Spec coverage: Tasks cover blog preservation, blog asset compatibility, homepage Architect + Proof structure, header/CV/contact conversion path, blog UI curation, search query behavior, visual polish, security cleanup, and final verification.
- Placeholder scan: No `TBD`, `TODO`, or unspecified implementation steps remain. Optional Playwright work is explicitly optional and not required for acceptance.
- Type consistency: Data keys introduced in Task 2 are consumed in Tasks 3 and 4 with matching names: `proofSignals`, `context`, `decision`, `result`, and `priorities`.
