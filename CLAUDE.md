# Personal Website - yonatankarp.github.io

## Stack

- **Hugo** static site generator (v0.160.0+)
- **Custom Hugo layouts** in `layouts/`
- **GitHub Actions** for CI/CD to GitHub Pages
- Site styles in `assets/css/custom.css`
- Custom JS in `static/js/site.js`
- Static images and icons in `static/images/`

## Build & Run

```bash
hugo server              # dev server
hugo --gc --minify       # production build
```

## Content Structure

- `content/home/home.md` / `home.he.md` — legacy homepage content, currently not the primary implementation
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

Every content file should have a `.he.md` variant for Hebrew when the page is user-facing in both languages. Hugo uses `translationKey` where needed to link translations.

## Hebrew Style Rules

- Use natural everyday Israeli Hebrew, NOT formal/literary
- Mix Hebrew and English tech terms naturally
- Keep job titles in English (Staff Software Engineer, not מהנדס תוכנה בכיר)
- Keep technical terms in English (CI pipelines, compliance, HashMap)
- Skill descriptions stay in English
- Use plural imperative: צרו קשר (not צור קשר)
- אודות (not אודותיי), היום (not הווה), ו-fintech (not ופינטק)
- Never present Hebrew text in terminal for review — RTL renders backwards

## Layout Rules

- Prefer editing the custom templates in `layouts/` directly instead of introducing third-party theme assumptions
- Keep the design system centralized in `assets/css/custom.css`
- Use `static/js/site.js` for the small amount of client-side behavior
- Keep bilingual and RTL support first-class in every template change

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
Create `content/projects/name.md` and `content/projects/name.he.md`. Projects render via the custom homepage project list and can expose their CTA through `params.button`.

### New experience
Create `content/experience/name.md` and `content/experience/name.he.md` with jobTitle, company, location, duration fields.

## Images

- Profile photos: `assets/images/showcase/` and `assets/images/about/`
- Testimonial photos: `assets/images/testimonials/`
- Blog images: `static/images/blog/`
- All blog images are stored locally — no external CDN dependencies

## Analytics

- **GoatCounter** for privacy-friendly analytics (script in `layouts/partials/head.html`)
- Dashboard: `https://yonatankarp.goatcounter.com`
- Localhost and private IPs are automatically excluded
- To exclude your own visits from a browser, visit `https://yonatankarp.com#toggle-goatcounter` (sets a localStorage flag, built into `count.js`)

## Deployment

Push to `main` triggers GitHub Actions workflow (`.github/workflows/deploy.yml`) which builds Hugo and deploys to GitHub Pages.
