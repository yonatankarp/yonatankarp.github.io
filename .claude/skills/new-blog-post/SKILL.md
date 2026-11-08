---
name: new-blog-post
description: Add a new post to the blog (the city's Library, /blog/) with its front matter, tags and topic chips, its painted cover and pixel cover, Mermaid diagrams and inline pixel art. Use for "new blog post", "write a post", "publish an article", "add a cover", "add a diagram to a post", "new tag", or moving a post to dev.to.
---

# A new blog post

## Preflight
Run this before editing anything. If something is missing, stop and tell Yonatan exactly what is missing and how
to provide it.
- If a **hard blocker** is missing, don't start.
- If a **later-step blocker** is missing, do the steps that don't need it, then list what is left for him.

**From Yonatan.** All of these are hard blockers.
- The post's text, title, slug (the file name and the URL), date (today or earlier), and a one-line `description`.
  He can paste them or point at a file.
- The tags. Propose existing ones (step 2) and ask whether a new tag should be a curated chip.
- An approved cover prompt. Every cover shows the post's idea through nature: a habitat, an hour and an animal or
  plant, like the `COVERS` prompts in `web3d/pixel/paint_covers.py`.
  - Draft one and ask him to approve it or rewrite it.
  - Skip this if he already has a cover `.jpg`. Then ask for its path; it must be 1024x576.
- The content must pass the rules: no Billie vendor names, no Tel Aviv, nothing about his health or leave, no
  project that isn't on the site. If the text breaks one, stop and quote the line.
- Optional (ask once, don't block):
  - `coverAlt` and `coverFocus`;
  - the LinkedIn and X thread URLs for `discuss`;
  - inline art: an idea per image, each with alt text;
  - which diagrams to draw.
- His pick of a seed. Painted candidates are only on his disk. This blocks step 3.4 and later, not earlier steps.

**Tools.** Each one blocks only the steps named; the command comes first.
- Draw Things API up. `000` means it's down, and he turns on Settings > API Server. Blocks painting (3.2, 3.3 and
  5.2).
  ```sh
  curl -s -o /dev/null -w '%{http_code}\n' -m 3 http://127.0.0.1:7860/
  ```
- uv. Blocks painting and baking (3.2 to 4, and 5).
  ```sh
  uv --version
  ```
- The picked candidate is on disk. Blocks `--install` (step 4). Without it, use the `pixelate.py` form from his
  `.jpg`.
  ```sh
  ls web3d/pixel/paintings/candidates/cover-<slug>_<seed>.png
  ```
- node_modules. If it's missing, run `npm ci`. Blocks diagrams (6) and every `npm run` check.
  ```sh
  test -d node_modules && echo ok
  ```
- Playwright's Chromium. If it's missing, run `npx playwright install chromium`. Blocks diagrams (6).
  ```sh
  node -e "process.exit(require('fs').existsSync(require('playwright').chromium.executablePath())?0:1)" && echo ok
  ```
- Hugo and its pinned version. Blocks only the local preview, since CI builds anyway.
  ```sh
  .tools/hugo/hugo version || hugo version; grep HUGO_VERSION .github/hugo.env
  ```

The machine is often busy. Painting, `npm run serve` and builds are his to run or approve.

## Steps
1. **The post file:** `content/blog/<slug>.md`. Copy the front matter of `content/blog/self-compiling-second-brain.md`:
   ```yaml
   ---
   title: "Post Title"
   seoTitle: "Shorter title for search"     # only if the title is over ~65 characters
   date: 2026-11-08T00:00:00+01:00
   draft: false
   type: "blog"
   description: "One sentence, 160 characters at most."
   tags:
     - kotlin
     - spring-boot
   images:
     featured_image: "/images/blog/covers/<slug>.jpg"
   coverFocus: 54                            # 25 to 78; the height on the cover to centre on, in 108ths
   coverAlt: "What the cover shows"          # optional; the share card's alt. Default: data/art.yaml `cover`
   discuss:                                  # optional; default: his LinkedIn and X profiles
     linkedin: "https://www.linkedin.com/..."
     x: "https://x.com/..."
   ---
   ```
   - Hugo doesn't build future posts (`buildFuture` isn't set in `hugo.toml`), so a future `date` drops the post silently.
   - Don't use `design-patterns-`, `kotlin-code-smell` or `advent-of-code` in the slug or the summary (the text
     before `<!--more-->`). Those are the removed posts, and `scripts/check-generated-html.js` fails if those strings
     appear anywhere in the sitemap, `index.json`, the feeds or `llms.txt`. That includes a link to one of their
     dev.to copies, if it lands in the feed summary or in search.
   - Media in the body: GIFs fail `check:blog-assets`. Use `{{< video src="/images/blog/....mp4" alt="…" >}}` with a
     `.webp` poster of the same name. Every file under `static/images/blog/` must be 500 KB or smaller.
2. **Tags:** every tag a listed post carries gets its chip on `/blog/` and a tag page, with no extra step. Reuse
   existing tags: kotlin, spring-boot, java, software-engineering, side-projects, openapi, databases,
   data-structures, claude-code, automation, ai, aws, concurrency, dependency-injection, observability,
   problem-solving, redis, system-design.
   - **A new tag with a display name:** add `content/tags/<tag>/_index.md` with `title:` when Hugo's default casing
     is wrong (like `ai` → "AI" or `openapi` → "OpenAPI"; see `content/tags/ai/_index.md`). `aliases:` there keep a
     merged-away tag's URL.
   - **A curated chip:** append `{tag, label}` to `topics` in `data/library.yaml`. Those chips go first, in that
     order, under the label.
3. **The cover painting** (on Yonatan's machine). Covers are 1024x576 and live in `static/images/blog/covers/`.
   If he supplied a `.jpg`, copy it to `covers/<slug>.jpg`, record a `COVERS` entry if he has the prompt and seed,
   and skip to step 4's `pixelate.py` form.
   1. Add `"<slug>": (11, "what it shows", "the prompt")` to `COVERS` in `web3d/pixel/paint_covers.py`.
      - The key must equal the `featured_image` basename: `layouts/partials/blog-art.html` derives the pixel
        cover's path from that basename.
      - `STYLE` and `NO_TEXT` are added to the prompt for you.
      - The script rejects a slug that isn't in `COVERS`.
   2. Paint: `uv run web3d/pixel/paint_covers.py <slug> [--count 3] [--start 11]`. This needs Draw Things.
      - Seeds are `start + 11k`, so 11, 22, 33 by default.
      - Each seed goes to `web3d/pixel/paintings/candidates/cover-<slug>_<seed>.png`, which is gitignored.
   3. When none of the seeds paints the idea, there are two fallbacks.
      - **An img2img edit of a candidate:** add `EDITS["<slug>"] = (<seed>, "Edit this picture. …")` and run
        `uv run web3d/pixel/paint_covers.py <slug> --edit`. The pick is then named `"<seed>-e<edit seed>"` in `COVERS`.
      - **A touch-up in code:** a function in `TOUCH_UPS` (see `moved_stone`).
   4. Yonatan picks a seed. Put it as the first item of the `COVERS` tuple.
4. **Install the cover:** `uv run web3d/pixel/paint_covers.py --install`. It needs no model.
   - It writes `covers/<slug>.jpg` from the candidate (applying any touch-up) and rebakes every
     `covers/pixel/*.webp` at 960x540.
   - After this, the `.jpg` is the source; the candidate isn't kept.
   - With only a `.jpg` in hand, run the command the build error names instead:
     `uv run web3d/pixel/pixelate.py static/images/blog/covers/<slug>.jpg static/images/blog/covers/pixel/<slug>.webp --size 960x540`.
   - Commit both the `.jpg` and the `.webp`, and only your slug's. `--install` also rewrites the `.jpg` of any other
     cover whose candidate is still on his disk. Revert that churn: `git status static/images/blog/covers`.
5. **Inline art** (optional; same flow as the cover):
   1. Add `"<name>": (seed, "what it shows", "prompt")` to `INLINE` in `paint_covers.py`. Set it in the cover's habitat.
   2. Paint: `uv run web3d/pixel/paint_covers.py <name>`. Candidates are named `inline-<name>_<seed>.png`.
   3. Yonatan picks a seed.
   4. Bake: `uv run web3d/pixel/paint_covers.py --install-inline`, which writes `static/images/blog/pixel/<name>.webp`
      at 576x324. A touch-up for inline art goes in `INLINE_TOUCH_UPS`.
   5. In the post: `![Alt that says what the picture shows](/images/blog/pixel/<name>.webp)`. `render-image.html`
      gives it `px-art` and no resized sizes.
6. **Mermaid diagrams:** each diagram is a fence at the start of a line (not indented in a list):
   ````
   ```mermaid {title="Keys hashed into buckets" desc="Three keys go through the hash function into buckets 1 to 4."}
   flowchart LR
     ...
   ```
   ````
   - `title`: unique on the page. Both `title` and `desc` are one line each, with no semicolon and no `"`
     (`render-diagrams.js` reads them with `="([^"]*)"`).
   - Then run `node scripts/render-diagrams.js`. It draws each fence that has no drawing yet to the gitignored
     `assets/diagrams/<sha256>.svg` with Playwright's Chromium (needed only then), keeps the drawings still named and
     removes the rest; `npm run build:building` runs it too. Rerun it after every edit to a diagram, including during
     `npm run serve`.
7. **Nothing else to edit:** `/blog/`, the tag pages, the RSS feeds (`/blog/index.xml` and `/rss.xml`), `index.json`
   (search), `llms.txt`, the city's post count and the post's accent colour all come from the post itself.
8. **dev.to:** the repo has no cross-posting tooling. dev.to shows up only as the destination of posts moved off the
   site.
   - **To move a post off:** replace its front matter with the redirect stub in `content/blog/design-patterns-builder.md`:
     `layout: "redirect"`, `redirect: "https://dev.to/yonatankarp/…"`, `noindex: true`, `outputs: ["html"]`,
     `aliases`, `build: {list: never}`.
   - `scripts/check-csp.js` `isAllowedRedirect` allows only `https://dev.to/yonatankarp/…` or the site.
   - `check-generated-html.js` keeps a hand-written table of the old redirects. Add a moved post to it so it stays pinned.

## What catches mistakes
- The build fails, naming the fix, when:
  - **`featured_image` is missing, or there's no pixel cover:** the error is from `blog-art.html` and gives the
    `pixelate.py` command.
  - **`coverFocus` is outside 25 to 78:** the error is from `blog/single.html`.
  - **A Mermaid fence has no `title` or `desc`**, has a semicolon or a newline in them, repeats a title, or wasn't
    drawn or changed since it was drawn: the errors are from `render-codeblock-mermaid.html`.
  - **A tag in `data/library.yaml` has no tag page:** the error is from `blog/list.html`.
- `npm run check:blog-assets` fails on these, without building:
  - an `/images/blog/...` reference whose file is missing (covers, inline art, videos and their posters)
  - a GIF
  - a file over 500 KB
- CI's "Rebuild the art and compare it" step:
  - rebakes every cover from its committed `.jpg` into an emptied folder, so a WebP without its `.jpg`, or a WebP
    that doesn't match its bake, fails;
  - rebakes inline art only where a candidate exists (none are committed), so an inline WebP isn't re-checked.
- `check-generated-html.js` checks that `/blog/` lists every post, with a chip for every tag.
- **Nothing checks:**
  - a future `date`;
  - a near-duplicate tag (`springboot` beside `spring-boot` just makes a second chip);
  - what the cover, inline art and alt texts actually say;
  - a `description` over 160 characters (`head.html` cuts it silently, so the 160 check never fires);
  - the `.jpg` being 1024x576;
  - the `COVERS`/`INLINE` record matching the shipped art.

  Check these by hand.

## Verify
- `npm run check:blog-assets` (fast, no build), and `node scripts/render-diagrams.js` if the post has diagrams.
- Look at `/blog/<slug>/` and `/blog/` under `npm run serve`. Check: the cover band at your `coverFocus` on a wide
  screen and on a phone, the chips, and the diagrams' Zoom.
- Leave the full suite (`npm run check`, `npm test`) to CI. The machine is busy, so push and let GitHub run it.

## Done when
- [ ] `content/blog/<slug>.md` has all the front matter, a past `date` and existing tags (or a new tag with an
      `_index.md` if its title needs one).
- [ ] `covers/<slug>.jpg` and `covers/pixel/<slug>.webp` are committed, and the pick's seed is in `COVERS`.
- [ ] Inline art is in `INLINE` and `static/images/blog/pixel/`, with real alt text.
- [ ] Every Mermaid fence has a `title` and `desc` and was drawn.
- [ ] CI is green.
