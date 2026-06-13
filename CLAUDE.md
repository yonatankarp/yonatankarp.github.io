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

- `content/experience/` — job entries (one .md per role)
- `content/education/` — education entries
- `content/projects/` — project cards shown on homepage grid
- `content/contributions/` — NOT used (contributions are in projects/)
- `content/blog/` — blog posts
- `content/testimonial/` — recommendation quotes with photos
- `content/skills/_index.md` — skills page
- `content/footer/` — contact section
- `content/cv.md` — printable CV page

## Languages

The site is English-only. Do not create `.he.md` variants, translation keys, language switchers, or i18n files unless Yonatan explicitly restarts bilingual support.

## Layout Rules

- Prefer editing the custom templates in `layouts/` directly instead of introducing third-party theme assumptions
- Keep the design system centralized in `assets/css/custom.css`
- Use `static/js/site.js` for the small amount of client-side behavior

## Adding Content

### New blog post
Create `content/blog/post-slug.md` with:
```yaml
---
title: "Post Title"
date: YYYY-MM-DDT00:00:00+01:00
draft: false
type: "blog"
tags: [kotlin, spring-boot]
---
```

### New project
Create `content/projects/name.md`. Projects render via the custom homepage project list and can expose their CTA through `params.button`.

### New experience
Create `content/experience/name.md` with jobTitle, company, location, duration fields.

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
