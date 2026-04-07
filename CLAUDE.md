# Personal Website - yonatankarp.github.io

## Stack

- **Hugo** static site generator (v0.160.0+)
- **Adritian theme** via Hugo Modules — DO NOT modify theme files
- **Bootstrap 5** (bundled with theme)
- **GitHub Actions** for CI/CD to GitHub Pages
- Custom CSS in `assets/css/custom.css`
- Custom JS in `static/js/scroll-animations.js`
- Layout override: `layouts/partials/head_custom.html` (injects custom JS)

## Build & Run

```bash
hugo server              # dev server
hugo --gc --minify       # production build
```

## Content Structure

- `content/home/home.md` / `home.he.md` — homepage (shortcode-based)
- `content/experience/` — job entries (one .md per role, .he.md for Hebrew)
- `content/education/` — education entries
- `content/projects/` — project cards shown on homepage grid
- `content/contributions/` — NOT used (contributions are in projects/)
- `content/blog/` — blog posts (.md for EN, .he.md for Hebrew)
- `content/testimonial/` — recommendation quotes with photos
- `content/skills/_index.md` / `_index.he.md` — skills page
- `content/footer/` — contact section
- `content/cv.md` — printable CV page
- `i18n/en.yaml` / `he.yaml` — UI string overrides

## Languages

Site is bilingual: English (default) + Hebrew (RTL).

Every content file needs a `.he.md` variant for Hebrew. The theme uses `translationKey` in frontmatter to link translations.

## Hebrew Style Rules

- Use natural everyday Israeli Hebrew, NOT formal/literary
- Mix Hebrew and English tech terms naturally
- Keep job titles in English (Staff Software Engineer, not מהנדס תוכנה בכיר)
- Keep technical terms in English (CI pipelines, compliance, HashMap)
- Skill descriptions stay in English
- Use plural imperative: צרו קשר (not צור קשר)
- אודות (not אודותיי), היום (not הווה), ו-fintech (not ופינטק)
- Never present Hebrew text in terminal for review — RTL renders backwards

## Theme Rules

- **DO NOT** modify any theme files under `node_modules/` or the Hugo module cache
- Customizations go in:
  - `assets/css/custom.css` — CSS overrides
  - `static/js/` — custom JavaScript
  - `layouts/partials/head_custom.html` — script injection
  - `i18n/*.yaml` — UI string overrides
- Hugo's layout override system: create files in `layouts/` to override theme templates

## Adding Content

### New blog post
Create `content/blog/post-slug.md` and `content/blog/post-slug.he.md` with:
```yaml
---
title: "Post Title"
date: YYYY-MM-DDT00:00:00+01:00
draft: false
type: "blog"
tags: [kotlin, spring-boot]
translationKey: "post-slug"
---
```

### New project
Create `content/projects/name.md` and `content/projects/name.he.md`. Projects render in the homepage grid via `client-and-work-section` shortcode. No images in project cards.

### New experience
Create `content/experience/name.md` and `content/experience/name.he.md` with jobTitle, company, location, duration fields.

## Images

- Profile photos: `assets/images/showcase/` and `assets/images/about/`
- Testimonial photos: `assets/images/testimonials/`
- Blog images: `static/images/blog/`
- All blog images are stored locally — no external CDN dependencies

## Deployment

Push to `main` triggers GitHub Actions workflow (`.github/workflows/deploy.yml`) which builds Hugo and deploys to GitHub Pages.
