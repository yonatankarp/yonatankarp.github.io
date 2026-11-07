# yonatankarp.github.io

Yonatan Karp-Rudin's site and blog, https://yonatankarp.com: a [Hugo](https://gohugo.io/) site with custom layouts, English
only. The homepage is a pixel-art building, one storey per chapter of the CV, ridden by lift. `CLAUDE.md` has the details
on the layouts, the pixel skin and the content rules. To change the site's words, see `CONTENT.md`: the pages' text
lives in `content/` and `data/`, not in the templates.

## Quick start

```bash
npm ci                            # the build and check tools
npx playwright install chromium   # the browser that prints the CV PDF and runs the browser checks
npm run serve                     # dev server at http://localhost:1313
npm run build                     # production build into public/, then the CV PDF
```

Node 22 or later (`.nvmrc`) and Hugo 0.169.0, the release pinned in `.github/hugo.env`. The npm scripts use
`.tools/hugo/hugo` when it exists (gitignored: put that release there) and otherwise `hugo` on the `PATH`, and warn when
it is another version. `npm run lint` and the art pipeline also need [uv](https://docs.astral.sh/uv/).

`npm run serve` and `npm run build` first run `npm run build:building`, which bundles the homepage's script and styles
(`web3d/src/`) with Vite into `assets/building/` and draws the blog's Mermaid diagrams to SVG in `assets/diagrams/`
(`scripts/render-diagrams.js`, in Playwright's Chromium). So both need Playwright's browser
(`npx playwright install chromium`). A plain `hugo` fails until it has run, and again after a diagram changes.

## Checks

```bash
npm run check   # the production build, then every check of the built site
npm test        # node:test unit tests of the scripts' pure functions (scripts/test/)
npm run lint    # ESLint over the JavaScript, Ruff over the art pipeline
```

`npm run check` runs `check:blog-assets` and `check:phases` on the sources, builds, then checks the site metadata, the
generated HTML, the CV PDF (one A4 page, no local links), the internal links and local files each page loads (src, srcset, poster, a fetching `<link>`), and finally `check:csp`: every built page
in Chromium with its Content-Security-Policy enforced, axe-core on each, and the paths that load late (the diagram zoom, video,
search, the lift). It needs the network for GoatCounter's `count.js`; redirect pages are held where they are, so it never
follows a link out to the live site.

`npm run check:links:external` probes every off-site link. It stays out of `npm run check` because third-party sites fail
for reasons of their own; the weekly `External links` workflow runs it and keeps one `external-links` issue open while a
link is broken.

## The pixel art

The building's art is made by the Python scripts in `web3d/pixel/`, each a [PEP 723](https://peps.python.org/pep-0723/)
script that `uv run` gives its own environment (Python 3.11 or later). The paintings come from a local model in
[Draw Things](https://drawthings.ai/) through its HTTP API on port 7860 (Settings, API Server). Only the painting steps
need it; everything after them is code and rebuilds from the committed files.

```bash
uv run web3d/pixel/paint_rooms.py ROOM                     # paint candidates (Draw Things)
uv run web3d/pixel/install_picks.py                        # bake the picked candidates into paintings/picks/
uv run web3d/pixel/gen_floors.py static/building/pixel     # the tower's strips and floors.json, data/floor_accents.yaml
uv run web3d/pixel/gen_city.py build static/building/pixel # the city, its hours and the other pages' backdrop
uv run web3d/pixel/compare_art.py OUT                      # a fresh build in OUT against the committed art
```

The phases are listed in `data/phases.json`; `gen_floors.py` checks its baked rooms and roof skies against the art, and
`check:phases` checks the time pick and the CSS against it. The numbers the tower's script draws by (doors, lamps, each
strip's moving box) are written into `floors.json`, so change them in the Python and rerun it. Blog covers are painted
by `paint_covers.py` and pixelated by `pixelate.py`; `gen_icons.py` draws the favicon. The city's other scenes have
their own `gen_*.py` (CLAUDE.md).

CI rebuilds all the art on each pull request and fails unless it matches the committed files pixel for pixel and the
data files come out unchanged.

## Visual QA

```bash
npm run visual:capture                # starts Hugo on the first free port from 1313 and captures it
npm run visual:capture -- --public    # captures the built public/ instead, as CI does
npm run visual:capture:live           # captures https://yonatankarp.com
npm run visual:compare -- --baseline artifacts/<a>/manifest.json --candidate artifacts/<b>/manifest.json
```

Captures go to `artifacts/visual-smoke/<YYYY-MM-DD>/` (gitignored), at 1440x1100 and 390x1200, for the homepage at
dusk, dawn, day and night (`/?time=`), `/projects/`, the ff4k case study, `/blog/`, `/cv/`, a blog post, `/search/` and
`/skills/`. Each capture also checks the page's landmarks, the top bar, mobile overflow and broken images, and on the
homepage rides the lift and works the pause button. `visual:compare` matches captures by route and viewport and reports
changed pixels; add `--fail-on-drift` with budgets such as `--max-changed-percent 0.5` to make drift fail. CI uploads a
pull request's captures and compares them with the last deploy's in the job summary, without failing, as the homepage
animates.

## Deployment and pins

A push to `main` runs `.github/workflows/deploy.yml`, which builds and checks the site and deploys it to GitHub Pages.

Hugo is installed from its GitHub release by `.github/actions/build-site`, so its pin is `HUGO_VERSION` and
`HUGO_SHA256` in `.github/hugo.env`, which Dependabot cannot bump. Change both together: the checksum is the
`hugo_extended_<version>_linux-amd64.deb` line of the release's `hugo_<version>_checksums.txt`, and the install step
fails when it does not match. The weekly `Pin staleness` workflow keeps one `toolchain-pin` issue open while the pin is
behind or its checksum is wrong; `npm run check:hugo-pin` runs the same check locally.

## Analytics

[GoatCounter](https://www.goatcounter.com/), dashboard at https://yonatankarp.goatcounter.com. Localhost and private IPs
are not counted. To leave your own visits out, open https://yonatankarp.com#toggle-goatcounter once in that browser.
