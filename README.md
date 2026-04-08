# yonatankarp.github.io

Personal website and blog built with [Hugo](https://gohugo.io/) and the [Adritian](https://github.com/zetxek/adritian-free-hugo-theme) theme. Bilingual: English + Hebrew.

## Quick Start

```bash
make serve   # dev server at http://localhost:1313
make build   # production build
make clean   # remove build artifacts
```

Requires Hugo v0.160.0+.

## Analytics

The site uses [GoatCounter](https://www.goatcounter.com/) for privacy-friendly analytics.

- Dashboard: https://yonatankarp.goatcounter.com
- Localhost and private IPs are automatically excluded
- To exclude your own visits from a browser, visit your site with `#toggle-goatcounter` appended to the URL (e.g. `https://yonatankarp.com#toggle-goatcounter`). This sets a localStorage flag — built into GoatCounter's `count.js`

## Deployment

Push to `main` triggers the GitHub Actions workflow which builds and deploys to GitHub Pages.
