# Pixel skin for the rest of the site

Date: 2026-10-31. Status: approved by Yonatan on 2026-10-31. The blog is the next project after this one.

## Intent

The homepage is a pixel-art building and the CV wears the same pixel skin, but every other page still uses the old design. Moving from the building to /projects or /blog feels like landing on a different site, and each page has a different menu. Yonatan's words: "the style of the display should be same otherwise the site doesnt make sense" and, on the menus, "its super confusing".

The goal is one visual language and one menu across the whole site. No animation is needed outside the homepage.

## Goals

- Every page uses the CV's pixel skin: the tokens, stepped 4px corners, hard inset outlines and flat fills in `assets/css/custom.css` (the `.cv-page` block, line 3751 on main). Jersey 15 is for display text only, and Outfit is for reading.
- One top bar on every page, laid out like the homepage's.
- The projects page lists all projects as pixel cards, each with a pixel-art painting made with Draw Things.

## Non-goals

- No animation, lift or canvas outside the homepage.
- No per-section banners or floor art at the top of pages. Yonatan rejected a "Parking" banner for projects and a "Newsroom" banner for the blog.
- No change to the homepage beyond the shared top bar details and the pause button label below.
- No bilingual work (the site is English-only).
- Reskinning the blog list and blog posts. Yonatan will convert the blog as the next project. The blog does get the shared top bar in this one.

## Anti-goals

- Images that do not show the project. The first mockup used crops of vans and an arcade cabinet from the Parking floor art, and Yonatan called the images wrong. A painting has to show something about its project.
- Decorative art in page headers. Yonatan called the crane art in the top-right of the CV header "useless in all pages".
- Bay numbers (P1, P2...) on the cards. Tried and rejected.
- Menus that differ per page.

## Decided

### Shared top bar

One partial, `layouts/partials/pixel-bar.html`, used by every page including the homepage, so the two can never drift (Yonatan's decision, 2026-10-31). It follows the homepage bar that main shipped in 133cfdb.

- Top-left: the name plate "Yonatan Karp-Rudin", linking to the homepage. On the homepage it rides the lift to the street instead (`data-goto="E"`).
- Under the name: tabs **Projects · Blog · CV · Search**. The current section's tab is amber with `aria-current="page"`; Search is current on `/search/`. There is no "Building" or "Home" tab; the name is the way home.
- Top-right: the amber **Download CV** button (the PDF). On phones (760px and below) the text gives way to its icon with a short "PDF" label under it, as on the homepage.
- Under the Download button: the social row, pixel icon tabs for LinkedIn, GitHub, X and The Reading Club podcast (`data/home/en.yaml` `contact.social`). Below 580px it gets a row of its own under the tabs.
- On the homepage the partial wears the building's classes (`building-top`, `building-name`, `building-links`, `building-download`, `building-social`), which `web3d/src/pixel.css` places over the canvas, and adds the pause button beside the tabs. The lift and the pause button stay homepage-only, because only that page animates.

The CV page drops its own bar (which had "Building", "Blog" and "Download PDF") for the shared one.

### Search

Search is the fourth tab on every page, as main's homepage has it since 133cfdb. The search index (`layouts/index.json.json`) covers every page on the site, not just the blog. The existing search box in the blog list sidebar stays where it is until the blog project. The old `menus.header` entries in `hugo.toml` (Home, About, Projects, Blog, CV, Search) are removed if nothing reads them any more.

### Pause button (homepage)

The button pauses the building's looping animation (WCAG 2.2.2). It already has a `title` tooltip (`web3d/src/pixel.js:83`), but that needs a long hover and never shows on phones. Add a visible text label, "Pause" or "Play" to match its state, beside the icon on desktop. Phones keep the icon alone.

### Projects list (`/projects/`)

A standalone page like `layouts/_default/cv.html` (no baseof), on the same dark sheet.

- Header: kicker "Parking · Projects", the page title, and the `_index.md` text. No art.
- Two sections with CV-style headings: "My projects" (group not `contribution`) and "Open-source contributions", each sorted by weight.
- Cards in a grid: 3 columns on desktop, 2 below 1000px, 1 below 640px. Each card, top to bottom:
  - the project's pixel painting (16:9 slot)
  - kind (amber) and years on one line
  - title in Jersey 15 (the " (contributor)" suffix is stripped)
  - description (front matter `description`, falling back to the summary)
  - tech tags as small pixel chips
  - a button. If `caseStudy: true`: amber "Case study →" to the case-study page. Otherwise: a dark button with `params.button.btnText` and "↗", opening `link` in a new tab. Today 6 projects have case studies and 9 link out (GitHub, Docs, Gameplay, Intro, Live Site, PR #1970, Trailer, Website).
- The whole card is the link.

A working version of this page and the shared bar exists as a spike in the worktree `../yonatankarp.github.io-projects-spike` (branch `spike/pixel-projects`): `layouts/projects/list.html`, `layouts/partials/pixel-bar.html` and the `SPIKE` block at the end of `assets/css/custom.css`. Yonatan reviewed it and said it "looks good" after the bay numbers and header art were removed. It is a throwaway reference: rebuild it properly on a fresh branch and do not merge the spike branch.

### CV page

- Uses the shared top bar.
- The crane art in the header (`.cv-head__art`) is removed, so the header is text only.
- The print/PDF styling stays as it is, and `npm run check:cv-print` must still pass.

### Project paintings

Painted with Draw Things, not drawn in code. Yonatan: "draw things makes better pixel art". This matches how the building's floors were made (`web3d/pixel/paint_rooms.py`, then `pixelate.py` to map them onto the building's palette).

- One painting per project, 15 in all, each showing something about that project rather than a generic object.
- Draw Things runs on Yonatan's machine (API server on port 7860, one job at a time). The builder generates candidates. **Yonatan picks each painting**; the builder never picks on Yonatan's behalf.
- Yonatan will paint them later, after the pages ship. Until a project has a painting, its card and case-study page show **no image slot at all**: no placeholder and no old thumbnail. Each painting appears as soon as it is added. (Hiding the slot is Claude's call; a visible "painting goes here" box would look unfinished on the live site.)
- The paintings replace the current glossy thumbnails in `assets/images/projects/` on both the list cards and the case-study page covers. The old thumbnails and `scripts/generate-project-thumbnails.js` (and its npm script) are then deleted.

### Other pages

The case-study pages, search, skills and the 404 page all move to the pixel skin with the shared top bar. Headings use Jersey 15, and body text stays in Outfit for reading comfort.

## Constraints

- Hugo templates in `layouts/`, styles centralized in `assets/css/custom.css`, small client behaviour in `assets/js/site.js` (the project CLAUDE.md says `static/js/site.js`, which is stale).
- `npm run check` must pass (blog assets, build, site metadata, generated HTML, CV print, links).
- The layout works at phone width with no horizontal scroll (checked at 390px in the spike).
- Accessibility the CV already has must hold: visible focus rings drawn inside the stepped clip-path, a skip link, and contrast on amber and dark buttons.
- The blog shares `baseof.html`, `site-header.html`, `site-footer.html` and old CSS with the pages in scope. Changes to those shared pieces must leave the blog list and posts looking as they do today, apart from the shared top bar, which replaces the old site header there too.
- Write commit messages and docs without em dashes.

## Shipping and review

- All pages in this scope ship together in one release. The blog is the exception: it gets the shared top bar now and keeps its old style otherwise until its own project. The paintings follow later, one at a time.
- Yonatan reviews the finished set at the end, not page by page. Only /projects has been reviewed so far, so expect feedback at the end on the case-study pages in particular.

## Left to the builder

These are Claude's calls, made without Yonatan's input. Yonatan can overrule any of them.

- **One skin, not page-by-page copies.** Pull the CV skin's tokens and components out of the `.cv-page` block into shared classes, so the CV, projects and all baseof pages use one set. Whether baseof pages become standalone like the CV or baseof itself is reskinned is up to the builder.
- **Footer.** Neither the homepage nor the CV has a footer. Case-study, search, skills and 404 pages keep a reskinned footer with the existing contact and social links, because readers need a way to get in touch.
- **Case-study internals.** Code blocks, tables and prose on case-study pages get pixel framing in the CV palette. Build these pieces so the blog project can reuse them.
- **Old styles.** Delete CSS for the old design once nothing uses it, rather than leaving it dead.
- **Painting concepts and size.** Draft one concept per project (what the painting shows) and the pixel art size and palette budget for `pixelate.py`. Show the concepts to Yonatan together before painting, so Yonatan can veto any.
- **Sequencing.** On one branch: the shared skin and bar first, then the projects list (already validated), the CV tweaks, and the remaining pages. Paintings are a separate, later piece of work.
- **Game screenshots.** `assets/images/projects/` also holds three real game screenshots (`emmas-inferno.jpg`, `jacobs-choice.jpg`, `larry-the-last-zombie.jpg`, from YouTube thumbnails). Use them as reference input when painting those three games, then delete them with the other old thumbnails. Git history keeps them.
- **Draw Things sittings.** The builder cannot start Draw Things. Yonatan starts it (API server, port 7860), so painting happens in a few batched sittings: generate candidates for several projects per sitting, and Yonatan picks from a contact sheet of them.
- **Resizing pixel art.** Hugo's default Lanczos filter blurs pixel art. Resize the paintings with nearest-neighbour at integer scales, or serve them at native size with `image-rendering: pixelated`.
