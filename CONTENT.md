# Changing the site's words

The words the pages show live in `content/` and `data/`, not in the templates (`layouts/`), so you can change the
text without touching the design. This page says where each piece is, and which few words the scripts still write.

You can edit any of these files in GitHub's web editor (open the file, press the pencil, commit to `main`). The deploy
builds and publishes the change a few minutes later. A YAML file needs its indentation and quotes kept as they are;
the build fails, and nothing is published, when one is broken.

## How the data files work

- Keys stay as they are; change only the text in quotes.
- `%s` and `%d` are filled in by the site: a name, a title, a count. Keep them, as many as there were, in the same
  order. A literal percent sign in such a line is `%%`.
- Where a comment says Markdown, a link is `[words](https://address)`. Elsewhere the text is plain: write `&`, not
  `&amp;`.

## I want to change …

### The homepage and the city

| What | File and key |
| --- | --- |
| The site's name, the homepage's title and description in search results | `hugo.toml`: `title`, `params.title`, `params.description` |
| The city's panel: kicker, hint, the "Ride the career tower" link, the map's alt text | `data/home/en.yaml`: `city` |
| A district's name, title, text and link | `data/home/en.yaml`: `city.districts` (the Radio Mast and the Post Office take their text from `contact`) |
| "← Whole city", "Download the CV (PDF)", the map's and chips' labels | `data/home/en.yaml`: `city.out`, `city.pdf`, `city.label`, `city.chips` |
| The role line in the panel, the hero title and availability | `data/home/en.yaml`: `hero` |

### The Career Tower

| What | File and key |
| --- | --- |
| A job's floor: title, company, dates, summary, highlights (the first three are on the card) | `content/experience/<job>.md` |
| A floor's case study | `data/home/en.yaml`: `proof.items` (`floor` picks the floor) |
| The roof: what's next, priorities, facts, where I fit, outcomes | `data/home/en.yaml`: `contact`, `fit`, `outcomes` |
| Floor 1: the degree and courses | `content/education/`, and `data/home/en.yaml`: `education.title` |
| The lobby: how I work, facts, the quotes' heading | `data/home/en.yaml`: `about`, `testimonials.title` |
| The lift's buttons and hints, every Step inside, the panels' headings ("What I did", "Context", …), "Back to the lift" | `data/home/en.yaml`: `tower` |

### A job, a project, a testimonial, a blog post

| What | File |
| --- | --- |
| A job | `content/experience/<job>.md` (it shows on its floor, on the CV and in `llms.txt`) |
| A project | `content/projects/<name>.md`: its name, `description`, `tech`, `years`, and the case study below the front matter |
| A testimonial | `content/testimonial/<name>.md`: the full quote below the front matter, `pullQuote` (an exact excerpt, for the lobby), `name`, `position`, `source` |
| A blog post | `content/blog/<slug>.md` (CLAUDE.md, New blog post) |
| The skills | `content/skills/_index.md` (the lobby, the CV and `/skills/`) |

### The CV and its PDF

| What | File and key |
| --- | --- |
| The summary, the Staff+ focus, the headings, the open-source bullets | `data/cv.yaml` |
| The role under the name | `data/ui.yaml`: `role` (also the footer's) |
| The contact chips | `data/home/en.yaml`: `contact.email`, `contact.links` |
| The roles, the education and the skills | `content/experience/`, `content/education/` (entries with `cv: true`), `content/skills/_index.md` |

The PDF is printed from the CV page by the build, so it follows these files. It has room for one page, so the print
shows only the first five open-source bullets (`assets/css/custom.css`, the `section:has(> #cv-open-source)` rule),
and the skills instead of the focus boxes. Put the bullets that matter most first.

### The Library, Workshop Row, the Radio Mast and the Post Office

| What | File and key |
| --- | --- |
| The Library's title, search box, chips and count | `data/rooms.yaml`: `library`; its lead line is the body of `content/blog/_index.md` |
| The Library's topic chips and their order | `data/library.yaml` |
| Workshop Row's title, the workshops' names, "Case study", "View" | `data/rooms.yaml`: `workshop`; its lead line is the body of `content/projects/_index.md` |
| The Radio Mast's labels and the "Rather read?" line | `data/rooms.yaml`: `radio` |
| The show's name, text, platform and link | `data/home/en.yaml`: `contact.podcast` |
| The Post Office's labels and stamps | `data/rooms.yaml`: `post` |
| The letter: title, text, priorities, "Best for" | `data/home/en.yaml`: `contact` (keep the label "Best for": the letter picks that fact by it) |
| A page's title and description in search results | the front matter of `content/podcast.md`, `content/contact.md`, `content/blog/_index.md`, `content/projects/_index.md` |

### Buttons, labels, alt texts, the footer, social links, `llms.txt`

| What | File and key |
| --- | --- |
| The top bar: tabs, Menu, Pause, Download CV | `data/ui.yaml`: `bar` |
| The footer | `data/ui.yaml`: `role`, `footer`; the name is `hugo.toml`'s `title` |
| "← Back to the city", skip links, the Copy chip | `data/ui.yaml`: `back_to_city`, `skip`, `copy` |
| A post's page: Share, "On this page", Discuss, the author box, Keep reading | `data/ui.yaml`: `article` |
| Search, the 404, the skills page, the tag pages, a project's case study | `data/ui.yaml`: `search`, `not_found`, `skills`, `tags`, `project` |
| The tag pages' titles and descriptions in search results, the feeds' description | `data/ui.yaml`: `meta`, `feed` |
| The paintings' and photos' alt texts, the share image's | `data/art.yaml` (the city's is `city.alt` in `data/home/en.yaml`) |
| Social links: the top bar, the footer, the Post Office's stamps | `data/home/en.yaml`: `contact.social` |
| The X handle (a post's Discuss link, the share cards) and the profiles search engines link | `hugo.toml`: `params.social.twitter`, `params.seo.person.sameAs` |
| `llms.txt`'s headings, its use and attribution section, its key pages | `data/llms.yaml` (the rest comes from the content above) |

## What still lives in code, and why

- **Text the browser's scripts write as you use the page.** The Play and Pause labels (`web3d/src/scene-fx.js`), the
  Copy chip's "Copied" and "Failed" and their announcements (`assets/js/copy-email.js`), the code blocks' and share
  link's copy messages and the search results' messages (`assets/js/site.js`), the Library's count once a chip or a
  search narrows it (`assets/js/library.js`), and the diagrams' "Zoom in" (`assets/js/diagram-zoom.js`). The scripts
  write them at the moment they show, and passing them in from the data files would add markup to every page, so
  they stay beside the code that shows them: change them in those files. The lift's announcements are the floor buttons' labels, so they follow `tower` in
  `data/home/en.yaml`.
- **The art.** Every size, position and colour of the pictures and what moves in them (the Python pipeline in
  `web3d/pixel/`, `floors.json`, `city.json`).
- **The build's error messages**, which only the person editing the site sees.
- **The structured data search engines read** (the JSON-LD in `layouts/partials/head.html`): the employer and the
  author's name there are written in the template.

## Keeping it this way

`npm run check:template-copy` (part of `npm run check`, and run by CI) fails when a template in `layouts/` has words
outside `{{ }}`. It cannot see words inside `{{ }}`, such as a `printf` format, so put those in `data/` too.
