---
name: new-project
description: Add, change or archive a project on Workshop Row (/projects/), as a case study or an external link, or add a new project group (a fifth workshop). Use for "add a project", "new project", "list my repo", "archive a project", "case study", "new workshop", "new project group".
---

# A project on Workshop Row

## Preflight
Run this before editing anything. If something is missing, stop and tell Yonatan exactly what is missing and how to
provide it.
- If a **hard blocker** is missing, don't start.
- If a **later-step blocker** is missing, do the steps that don't need it, then list what is left for him.

**From Yonatan.** All of these are hard blockers.
- **Confirmation that the project may be listed.** Some projects are private, so never infer one from GitHub, and
  never name a project that isn't on the site.
- **The name.** Use its own casing. A project where he is a contributor ends in ` (contributor)`.
- **The `link`**, where the reader goes: the repository, or the project's docs.
- **The `group`**: `app`, `library`, `game` or `contribution`.
- **Its place in that workshop**, given as which project it goes before or after (see the weights below).
- **A `description`** of one or two sentences, a `projectKind` (such as "Open source library" or "Mac app"), the
  `tech` list, and `years` or the repository's creation `date`.
- **Case study or not.** A case study needs its body text from him (the problem, the design, the outcome). Without
  one, the button text, such as "GitHub" or "Docs" (the default is "View").
- **For an archive:** the repository really is archived.
- **For a new group:** its key, its workshop's name, its place in the row, and his go-ahead for repainting the whole
  street (eight paintings).

**Tools.** Each one blocks only the steps named; the command comes first.
- Hugo and its pinned version. Blocks only the local preview, since CI builds anyway.
  ```sh
  .tools/hugo/hugo version || hugo version; grep HUGO_VERSION .github/hugo.env
  ```
- node_modules. If it's missing, run `npm ci`. Blocks `npm run serve` (the Workshop Row bundle).
  ```sh
  test -d node_modules && echo ok
  ```
- uv. Blocks a new group's art (B3 to B7).
  ```sh
  uv --version
  ```
- Draw Things API up. `000` means it's down. Blocks a new group's repaint (B4).
  ```sh
  curl -s -o /dev/null -w '%{http_code}\n' -m 3 http://127.0.0.1:7860/
  ```
- torch, for the depth map (B5). There is no cheap check: `depth_map.py` pulls in torch and transformers, several
  GB, before it parses its arguments. Ask Yonatan before the first run.

A plain project needs no tools beyond a text editor.

## A. A project in an existing workshop
1. **The file:** `content/projects/<slug>.md`.
   - **A case study**, which gets its own page at `/projects/<slug>/` (copy `content/projects/ff4k.md`):
     ```yaml
     ---
     date: 2026-01-07T00:00:00+01:00   # the repository's creation
     title: "ff4k"
     weight: 10
     description: "One or two sentences: the card, the case study's lede, llms.txt and search."
     projectKind: "Open source library"
     group: "library"
     draft: false
     link: "https://…"                  # the case study's Open button
     caseStudy: true
     tech: ["Kotlin", "Multiplatform"]
     years: "2026–present"              # optional; default: the date's year
     params:
         button:
             btnText: "Docs"
     ---
     First paragraph (the summary).

     <!--more-->

     ## The problem
     …
     ```
   - **An external link**, which gets no page of its own (copy `content/projects/exekutor.md`). Leave out
     `caseStudy` and add:
     ```yaml
     build:
       render: never
       list: local
     ```
     The body is one line.
     - Without the `build` block, Hugo renders an orphan page at `/projects/<slug>/` that lands in the sitemap, and
       nothing catches it.
2. **`weight`:** lowest comes first within a workshop. These are the weights now:
   - app: mimic 12, lorekeeper 14, talekeeper 60.
   - library: ff4k 10, sse-mcp-server 40, kotlin-design-patterns 50, kotlin-spring-boot-template 52,
     ktor-template 54, one-topic-to-rule-em-all 56, xkcd-click-and-drag 70, exekutor 80.
   - game: 95–120.
   - contribution: openapi-generator 20, konsist 30, ff4j 40, java-design-patterns 50.

   Pick a free number between the two neighbours.
3. **Archiving:** add `archived: true`. The project stays listed, with "Archived" on its card and its case study,
   and "(archived)" after its name in `llms.txt` (`data/llms.yaml` `archived`).
4. **Nothing else to edit:** the workshop's list and count, the city's project count (`layouts/index.html`),
   `llms.txt` (`layouts/index.llms.txt`, by weight), and search (`layouts/index.json.json`; a `contribution` is typed
   "Contribution") all come from the front matter.
   - `layouts/partials/project-title.html` strips ` (contributor)` everywhere the title is shown.

## B. A new group (a fifth workshop)
This happens rarely and takes a lot of work. The groups are spelled out in about 9 places (until #340 lands).
1. **Hugo and data:**
   - Add the key to the group list in **both** validations: `layouts/projects/list.html:7` and
     `layouts/index.html:109`.
   - Add a `(slice "<key>" $t.groups.<key>)` pair, in the row's order, to the slice in `layouts/projects/list.html:11`.
     - It reads `$art.labels "bay-N"` by position, so `workshop.json` needs a `bay-5` (step B7). Without it, the
       label most likely renders with no position rather than failing. Look at it.
   - Add the workshop's name under `groups` in `data/rooms.yaml` `workshop`.
   - Update the copy that lists the groups:
     - `data/home/en.yaml`, the `workshop` district's `text`;
     - `content/projects/_index.md`'s `description` and body;
     - `data/art.yaml` `workshop`, the alt text, which says "four" workshops.
   - Search (`index.json.json:26`) types every group but `contribution` as "Project". Add a type to `data/ui.yaml`
     `search.types` only if the new group needs its own.
2. **Checks, written for four groups:** `scripts/check-generated-html.js`.
   - `:41` lists the h2 names in order.
   - `:49` and `:58` expect exactly four labels, chips and lists.
3. **JS, only if Apps stops being first:**
   - `web3d/src/workshop.js:30`: the `'app'` opening pick.
   - `layouts/projects/list.html`: the `"app"` `on`/`aria-pressed`/unhidden defaults.
   - `web3d/src/city.js:138`: the push-in's `bay-1`.
   - `DOOR`/`SHUTTER` in `gen_workshop.py`: the Apps door's position.
4. **The painting (Draw Things):** `web3d/pixel/gen_workshop.py`.
   1. Add a centre to `BAYS`. The street is `PW` = 3456 wide (from `gen_city.py`), and four bays at `HALF` 260
      already span 640–2900 with the van at 2960–3350. So the bays, the van and the alleys all have to move or
      shrink in `blockout()`.
   2. Change "four" in the `DUSK` prompt and in the docstring.
   3. Look at the blockout: `uv run web3d/pixel/gen_workshop.py blockout /tmp`. Give it an out dir: it defaults
      to `static/building/pixel`, so a bare run leaves a stray `workshop-blockout.png` there.
   4. Paint dusk: `uv run web3d/pixel/gen_workshop.py paint`. Yonatan copies his pick to
      `web3d/pixel/paintings/picks/workshop.png` and notes its seed in `PICKS`.
   5. Paint each other hour: `paint --time dawn|day|night`.
   6. Paint each hour's winter: `paint --winter [--time PHASE]`, which goes into `WINTER_PICKS`.

   That's 8 picks in all.
5. **The depth map:** `uv run web3d/pixel/depth_map.py workshop` (needs torch, not in CI).
   - Commit `picks/workshop-depth.png`.
6. **Re-measure everything placed by hand** on the new art. Nothing checks these, so check them by eye:
   - `FX`: pavement, edge, lanes, wall, street, weld, screens, lamps;
   - `DOOR`/`SHUTTER`;
   - `relight`'s lamp at x 245;
   - `PATCHES`: the winter tree at (1515, 0), and the van at (2869, 500). Repaint these with `patch_picks.py` and
     copy the printed offsets by hand (until #339 lands).
7. **Build the row's art:** `uv run web3d/pixel/gen_workshop.py build static/building/pixel`. It writes
   `workshop[-winter][-PHASE].webp`, `workshop.json` (labels `bay-1`…`bay-5`), `workshop-fx.json` and
   `workshop-depth.png`. Commit them.
8. **Docs:**
   - In CLAUDE.md:
     - the "New project" group list;
     - the Workshop Row paragraph ("a street of four brick workshops… in that order");
     - the Analytics `workshop-<group>` events list.
   - The "four" in the comment at `layouts/projects/list.html:1`.
   - The "four" in the failure message at `check-generated-html.js:59`.

## What catches mistakes
- The build fails, naming the file, when `link` is missing or `group` is not a known key. Both `projects/list.html`
  and `index.html` check this.
- `check-generated-html.js` (`checkProjectsPage`) fails when:
  - a card's title doesn't match the front matter `title`, minus ` (contributor)`;
  - a case study's CTA isn't "Case study" or its link isn't internal. This catches `caseStudy: true` with
    `render: never`, which leaves an empty link.
  - an external card doesn't open in a new tab with `noopener`, or its CTA isn't `btnText`;
  - the Archived label doesn't match `archived`;
  - the counts of projects and workshops are wrong, or the h2s aren't the four names.
- `check:csp` clicks the `game` workshop and expects it to show.
- CI's art rebuild fails when the committed workshop WebPs or JSON don't match `gen_workshop.py build`.
- `check:phases` fails until every phase has its workshop art, winter too.
- **Nothing checks:**
  - a missing `build: {render: never}` (the orphan page);
  - the order of the weights;
  - the description's wording or length;
  - whether a project may be public;
  - the `FX`, `DOOR`, `SHUTTER` and patch positions on new art;
  - the "four" in prompts and alt text;
  - a label with no `bay-N` anchor.

## Verify
- Run `npm run serve` (if Yonatan approves) and look at `/projects/`. Check: the card in the right workshop and
  place, its CTA and link, and the Archived label. For a case study, also check `/projects/<slug>/`.
- For a new group, also check `/projects/?time=dawn`, `?time=night` and `?season=winter`. The labels should sit
  on the roofs, the walkers on the pavement, the moths on the lamps and the sparks on the second bench. Then come in
  from the city's Workshop Row go link: it should land on the Apps door.
- Leave the full suite to CI. The machine is busy, so push and let GitHub run `check:static`, `check:csp` and the
  art compare.

## Done when
- [ ] `content/projects/<slug>.md` has `link`, `group`, `weight`, `description`, `projectKind`, `tech` and a `date`.
      It has either `caseStudy: true` with a body, or the `build` block.
- [ ] The card sits where Yonatan asked, and `llms.txt` lists it (by weight, with "(archived)" if it applies).
- [ ] For a new group: every place in B is updated, the 8 picks and the depth map are committed, the art is rebuilt,
      and CLAUDE.md is updated.
- [ ] CI is green.
