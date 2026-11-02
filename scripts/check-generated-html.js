#!/usr/bin/env node

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const { rootDir, publicDir, fail, walk, collectAttribute } = require("./lib");

const failures = [];
const placeholderPattern = /\b(?:TODO|FIXME|Lorem ipsum|Coming soon)\b/i;

function stripTags(value) {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function isRedirectPage(html) {
  return /http-equiv=["']?refresh/i.test(html) && /rel=["']?canonical/i.test(html);
}

function countMatches(html, pattern) {
  return Array.from(html.matchAll(pattern)).length;
}

const projectsDir = path.join(rootDir, "content", "projects");

function frontMatter(file) {
  const block = fs.readFileSync(path.join(projectsDir, file), "utf8").match(/^---\n([\s\S]*?)\n---/)[1];
  const scalar = (key) => block.match(new RegExp(`^\\s*${key}:\\s*"?([^"\\n]*)"?\\s*$`, "m"))?.[1];

  return { slug: file.replace(/\.md$/, ""), caseStudy: scalar("caseStudy") === "true", btnText: scalar("btnText") || "View" };
}

function decodeEntities(value) {
  return value.replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, "&").replace(/&quot;/g, '"');
}

function checkProjectsPage(route, html) {
  const headings = Array.from(html.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/g)).map((match) => stripTags(match[1]));

  if (headings.join("|") !== "Apps|Libraries and tools|Games|Open-source contributions") {
    failures.push(`${route}: h2s are [${headings.join(", ")}], expected [Apps, Libraries and tools, Games, Open-source contributions]`);
  }

  const projects = fs.readdirSync(projectsDir).filter((file) => file.endsWith(".md") && file !== "_index.md").map(frontMatter);
  const cards = html.split(/<li\b[^>]*class=["']?px-card["']?[\s>]/).slice(1);

  if (cards.length !== projects.length) {
    failures.push(`${route}: expected ${projects.length} px-card items, got ${cards.length}`);
    return;
  }

  for (const project of projects) {
    const source = fs.readFileSync(path.join(projectsDir, `${project.slug}.md`), "utf8");
    const title = source.match(/^title:\s*"?([^"\n]*)"?/m)[1].replace(/\s*\(contributor\)$/, "");
    const card = cards.find((candidate) => decodeEntities(stripTags(candidate.match(/<h3\b[^>]*>([\s\S]*?)<\/h3>/)?.[1] ?? "")) === title);

    if (!card) {
      failures.push(`${route}: no px-card titled "${title}"`);
      continue;
    }

    const link = card.match(/<h3\b[^>]*>\s*(<a\b[^>]*>)/)[1];
    const cta = card.match(/<span\b[^>]*class=["']?px-cta[\s"'>][^>]*>([\s\S]*?)<\/span>/);
    const ctaText = cta ? stripTags(cta[1]).replace(/\s*(?:&#8594;|&#8599;|[\u2192\u2197])$/, "") : null;
    const href = collectAttribute(link, "href");

    if (project.caseStudy) {
      if (ctaText !== "Case study" || !href?.startsWith("/")) {
        failures.push(`${route}: ${title} should link internally with a "Case study" px-cta, got "${ctaText}" ${href}`);
      }
    } else {
      if (collectAttribute(link, "target") !== "_blank" || !/\bnoopener\b/.test(collectAttribute(link, "rel") ?? "")) {
        failures.push(`${route}: ${title} should open in a new tab with rel=noopener`);
      }

      if (ctaText !== project.btnText) {
        failures.push(`${route}: ${title} px-cta reads "${ctaText}", expected "${project.btnText}"`);
      }
    }

    if (/<img\b/.test(card)) {
      failures.push(`${route}: ${title} has an image; project cards have none`);
    }
  }

  if (/px-pic|cv-head__art|px-page/.test(html) || /\bsrc=(?:""|''|(?=[\s>]))/.test(html)) {
    failures.push(`${route}: has px-pic, cv-head__art, a px-page footer or an empty src`);
  }
}

function projectField(slug, key) {
  const block = fs.readFileSync(path.join(projectsDir, `${slug}.md`), "utf8").match(/^---\n([\s\S]*?)\n---/)[1];
  return block.match(new RegExp(`^${key}:\\s*"?([^"\\n]*)"?\\s*$`, "m"))?.[1] ?? "";
}

function checkCaseStudyPage(route, html, slug) {
  const body = html.match(/<body\b[^>]*>/)?.[0] ?? "";
  const title = projectField(slug, "title").replace(/\s*\(contributor\)$/, "");
  const fail = (message) => failures.push(`${route}: ${message}`);

  if (!/class=["']?[^"'>]*\bpx-skin\b[^"'>]*\bpx-page\b/.test(body)) {
    fail("body should have px-skin px-page");
  }

  const h1s = Array.from(html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/g)).map((match) => decodeEntities(stripTags(match[1])));

  if (h1s.length !== 1 || h1s[0] !== title) {
    fail(`h1s are [${h1s.join(", ")}], expected [${title}]`);
  }

  const kicker = html.match(/<p\b[^>]*class=["']?px-kicker["']?[^>]*>([\s\S]*?)<\/p>/);

  if (!kicker || decodeEntities(stripTags(kicker[1])) !== projectField(slug, "projectKind")) {
    fail(`px-kicker should read "${projectField(slug, "projectKind")}"`);
  }

  const chips = Array.from(html.matchAll(/<(?:li|span)\b[^>]*class=["']?px-chip["']?[^>]*>([\s\S]*?)<\/(?:li|span)>/g)).map((match) => decodeEntities(stripTags(match[1])));
  const years = projectField(slug, "years");
  const tech = Array.from(fs.readFileSync(path.join(projectsDir, `${slug}.md`), "utf8").match(/^tech:\s*\[(.*)\]/m)?.[1].matchAll(/"([^"]*)"/g) ?? []).map((match) => match[1]);

  if (chips.join("|") !== [years, ...tech].join("|")) {
    fail(`px-chips are [${chips.join(", ")}], expected [${[years, ...tech].join(", ")}]`);
  }

  const open = Array.from(html.matchAll(/<a\b[^>]*>(?:(?!<\/a>)[\s\S])*Open project[\s\S]*?<\/a>/g)).map((match) => match[0]);

  if (open.length !== 1 || collectAttribute(open[0], "href") !== projectField(slug, "link") || !/\bnoopener\b/.test(collectAttribute(open[0], "rel") ?? "")) {
    fail('expected one "Open project" link to the project link with rel=noopener');
  }

  if (!/<div\b[^>]*class=["']?[^"'>]*\bpx-prose\b/.test(html) || !/\barticle__content\b/.test(html)) {
    fail("content should sit in .article__content.px-prose");
  }

  if (/article__cover/.test(html) || /\bsrc=(?:""|''|(?=[\s>]))/.test(html)) {
    fail("has article__cover or an empty src");
  }

  const footer = html.match(/<footer\b[^>]*class=["']?site-footer["']?[\s\S]*?<\/footer>/)?.[0] ?? "";

  for (const needle of ["github.com/yonatankarp", "linkedin.com/in/yonatankarp", "mailto:"]) {
    if (!footer.includes(needle)) {
      fail(`footer is missing the ${needle} link`);
    }
  }
}

function checkPlainPixelPage(route, html) {
  const body = html.match(/<body\b[^>]*>/)?.[0] ?? "";
  const fail = (message) => failures.push(`${route}: ${message}`);

  if (!/class=["']?[^"'>]*\bpx-skin\b[^"'>]*\bpx-page\b/.test(body)) {
    fail("body should have px-skin px-page");
  }

  const sheets = countMatches(html, /class=["']?[^"'>]*\bpx-sheet\b/g);

  if (sheets !== 1) {
    fail(`expected one px-sheet, got ${sheets}`);
  }

  if (/class=["']?[^"'>]*\breveal\b/.test(html)) {
    fail("still has reveal classes");
  }

  if (route === "/search/") {
    for (const id of ["site-search", "search-results"]) {
      if (!new RegExp(`\\bid=["']?${id}[\\s"'>]`).test(html)) {
        fail(`missing #${id}`);
      }
    }
  }

  if (route === "/404.html") {
    const hrefs = Array.from(html.matchAll(/<main\b[\s\S]*?<\/main>/g)).flatMap((main) => Array.from(main[0].matchAll(/<a\b[^>]*>/g)).map((tag) => collectAttribute(tag[0], "href")));

    for (const href of ["/", "/blog/"]) {
      if (!hrefs.includes(href)) {
        fail(`should link to ${href}`);
      }
    }

    if (!/<form\b[^>]*action=["']?\/search\/[^>]*method=["']?get[^>]*>[\s\S]*?<input\b[^>]*name=["']?q\b/.test(html)) {
      fail("needs a GET form to /search/ with an input named q");
    }

    if (hrefs.filter((href) => /^\/blog\/[^/]+\/$/.test(href)).length < 3) {
      fail("should link to three recent posts");
    }
  }
}

const barTabs = [["/projects/", "Projects"], ["/blog/", "Blog"], ["/cv/", "CV"], ["/search/", "Search"]];
const socialHrefs = Array.from(
  fs.readFileSync(path.join(rootDir, "data", "home", "en.yaml"), "utf8").match(/^ {2}social:[^\n]*\n((?: {4}.*\n)+)/m)[1].matchAll(/url:\s*"([^"]+)"/g),
).map((match) => match[1]);

function currentTab(route) {
  if (route.startsWith("/projects/")) return "/projects/";
  if (route.startsWith("/blog/") || route.startsWith("/tags/")) return "/blog/";
  if (route === "/cv/") return "/cv/";
  if (route === "/search/") return "/search/";
  return null;
}

// One bar per page from layouts/partials/pixel-bar.html: .px-bar, or on the homepage the building's .building-top.
function checkTopBar(route, html) {
  const home = route === "/";
  const barClass = home ? "building-top" : "px-bar";
  const bars = Array.from(html.matchAll(new RegExp(`<header\\b[^>]*class=["']?${barClass}["']?[\\s>][\\s\\S]*?<\\/header>`, "g"))).map((match) => match[0]);

  if (bars.length !== 1 || countMatches(html, /class=["']?(?:px-bar|building-top)["']?[\s>]/g) !== 1) {
    failures.push(`${route}: expected one ${barClass} top bar`);
    return;
  }

  const bar = bars[0];
  const tabs = bar.match(/<nav\b[^>]*aria-label=["']?Site["']?[^>]*>([\s\S]*?)<\/nav>/);
  const links = tabs ? Array.from(tabs[1].matchAll(/<a\b[^>]*>/g)).map((match) => match[0]) : [];
  const hrefs = links.map((tag) => collectAttribute(tag, "href"));

  if (hrefs.join(" ") !== barTabs.map(([href]) => href).join(" ")) {
    failures.push(`${route}: top bar tabs are [${hrefs.join(", ")}], expected [${barTabs.map(([href]) => href).join(", ")}]`);
  } else {
    const expected = currentTab(route);
    const current = links.map((tag, index) => (collectAttribute(tag, "aria-current") === "page" ? hrefs[index] : null)).filter(Boolean);

    if (current.join(" ") !== (expected ?? "")) {
      failures.push(`${route}: aria-current is on [${current.join(", ")}], expected ${expected ?? "no tab"}`);
    }
  }

  const downloadClass = home ? "building-download" : "px-download";
  const downloads = Array.from(bar.matchAll(new RegExp(`<a\\b[^>]*class=["']?${downloadClass}["']?(?=[\\s>])[^>]*>`, "g"))).map((match) => match[0]);

  if (downloads.length !== 1 || collectAttribute(downloads[0], "href") !== "/yonatan-karp-rudin-cv.pdf") {
    failures.push(`${route}: expected one ${downloadClass} linking to /yonatan-karp-rudin-cv.pdf`);
  }

  const social = bar.match(/<nav\b[^>]*aria-label=["']?Find me elsewhere["']?[^>]*>([\s\S]*?)<\/nav>/);
  const socialLinks = social ? Array.from(social[1].matchAll(/<a\b[^>]*>/g)).map((match) => collectAttribute(match[0], "href")) : [];

  if (socialHrefs.length === 0 || socialLinks.join(" ") !== socialHrefs.join(" ")) {
    failures.push(`${route}: top bar social row is [${socialLinks.join(", ")}], expected [${socialHrefs.join(", ")}]`);
  }

  // The homepage's building scripts and styles read these (web3d/src/guide.js, pixel.js, pixel.css).
  const homeHooks = [
    /<a\b[^>]*class=["']?building-name["']?[^>]*data-goto=["']?E["']?[\s>]/,
    /class=["']?building-links["']?[\s>]/,
    /<button\b[^>]*class=["']?building-pause["']?[^>]*data-building-pause[\s>]/,
    /data-building-pause-label[\s>]/,
    /<nav\b[^>]*class=["']?building-social["']?[\s>]/,
  ];

  for (const hook of homeHooks) {
    if (hook.test(bar) !== home) {
      failures.push(`${route}: top bar ${home ? "is missing" : "should not have"} the homepage hook ${hook}`);
    }
  }

  if (/site-header|menu-toggle/.test(html)) {
    failures.push(`${route}: still has the old site-header or menu-toggle`);
  }

  // Self-hosted fonts (#142): no Google Fonts, one Jersey 15 preload. A CSP meta on every page (#149), and no inline
  // executable script it does not allow by the sha256 of its built bytes (minifyOutput must not have changed them).
  if (/fonts\.(?:googleapis|gstatic)\.com/.test(html)) failures.push(`${route}: still asks Google Fonts`);
  const jersey = countMatches(html, /<link\b[^>]*rel=["']?preload\b[^>]*\/fonts\/jersey-15-latin\.woff2[^>]*\bcrossorigin\b/g);
  if (jersey !== 1) failures.push(`${route}: expected one crossorigin preload of /fonts/jersey-15-latin.woff2, got ${jersey}`);
  const csp = countMatches(html, /<meta\b[^>]*http-equiv=["']?Content-Security-Policy\b/gi);
  if (csp !== 1) failures.push(`${route}: expected one Content-Security-Policy meta, got ${csp}`);
  const policy = decodeEntities(collectAttribute(html.match(/<meta\b[^>]*http-equiv=["']?Content-Security-Policy\b[^>]*>/i)?.[0] ?? "", "content") ?? "").replace(/&#43;/g, "+");
  const scriptSrc = policy.match(/(?:^|;)\s*script-src\s+([^;]*)/)?.[1].trim().split(/\s+/) ?? [];
  const inline = Array.from(html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)).filter(([, attrs, body]) => body.trim() && !/\bsrc=/.test(attrs) && !/type=["']?application\/(?:ld\+)?json/.test(attrs));
  const unhashed = inline.filter(([, , body]) => !scriptSrc.includes(`'sha256-${crypto.createHash("sha256").update(body).digest("base64")}'`));
  if (unhashed.length || /<[a-z][^>]*\son[a-z]+=/i.test(html)) failures.push(`${route}: has an inline script the CSP does not allow by hash, or an on* handler`);

  if (route === "/cv/" && /cv-head__art/.test(html)) {
    failures.push(`${route}: still has cv-head__art`);
  }
}

if (!fs.existsSync(publicDir)) {
  fail("Generated HTML check requires a built public/ directory. Run npm run build first.");
}

const htmlFiles = walk(publicDir, ".html");

for (const filePath of htmlFiles) {
  const html = fs.readFileSync(filePath, "utf8");
  const relativePath = path.relative(publicDir, filePath);
  const route = `/${relativePath.replace(/index\.html$/, "").replace(/404\.html$/, "404.html")}`;
  const redirectPage = isRedirectPage(html);

  if (!redirectPage && !/<h1\b/i.test(html)) {
    failures.push(`${route}: missing h1`);
  }

  for (const imageMatch of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = imageMatch[0];
    const alt = collectAttribute(tag, "alt");
    // A blog cover sits beside its post's title, so it is decorative: alt="", which the minifier writes as a bare alt (#123).
    const decorativeCover = /(?:^|\s)px-cover(?:\s|$)/.test(collectAttribute(tag, "class") ?? "") && (alt === "" || /\salt(?=[\s/>])/i.test(tag));

    if (!decorativeCover && (alt === null || stripTags(alt) === "")) {
      failures.push(`${route}: image missing useful alt text: ${tag.slice(0, 160)}`);
    }
  }

  if (/\bhref=["']#["']/i.test(html)) {
    failures.push(`${route}: contains empty hash link`);
  }

  if (placeholderPattern.test(html)) {
    failures.push(`${route}: contains placeholder text`);
  }

  if (!redirectPage) {
    checkTopBar(route, html);
  }

  if (route === "/projects/") {
    checkProjectsPage(route, html);
  }

  if (["/search/", "/skills/", "/404.html"].includes(route)) {
    checkPlainPixelPage(route, html);
  }

  const caseStudy = route.match(/^\/projects\/([^/]+)\/$/);

  if (caseStudy) {
    checkCaseStudyPage(route, html, caseStudy[1]);
  }

  if (route === "/blog/") {
    const postRows = countMatches(html, /class=["'][^"']*\bpost-row\b/g);
    const rowThumbs = countMatches(html, /class=["'][^"']*\bpost-row__thumb\b/g);

    if (postRows > 0 && postRows !== rowThumbs) {
      failures.push(`${route}: expected one post-row__thumb per post-row, got ${rowThumbs} thumbs for ${postRows} rows`);
    }
  }
}

// One current location, contact.location in data/home/en.yaml: the roof's "Based in", the CV's role line and the
// homepage description (hugo.toml, by hand) must all say it (#115).
{
  const home = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
  const cv = fs.readFileSync(path.join(publicDir, "cv", "index.html"), "utf8");
  const basedIn = home.match(/<dt>Based in<\/dt>\s*<dd>([\s\S]*?)<\/dd>/)?.[1];
  const role = cv.match(/<p\b[^>]*class=["']?cv-role(?=["'\s>])[^>]*>([\s\S]*?)<\/p>/)?.[1];
  const cvLocation = role && decodeEntities(stripTags(role)).match(/·\s*(.+?)\s*$/)?.[1];
  const description = collectAttribute(home.match(/<meta\b[^>]*name=["']?description["'\s>][^>]*>/)?.[0] ?? "", "content");

  if (!basedIn || !cvLocation || decodeEntities(stripTags(basedIn)) !== cvLocation) {
    failures.push(`location: the homepage roof says "${basedIn}" and the CV says "${cvLocation}"; both should read contact.location`);
  } else if (!description?.includes(cvLocation)) {
    failures.push(`location: the homepage description "${description}" does not say "${cvLocation}"; update description in hugo.toml`);
  }
}

// Search and share metadata from layouts/partials/head.html, the sitemap and the feeds (#141).
{
  const origin = "https://yonatankarp.com";
  const read = (file) => fs.readFileSync(path.join(publicDir, file), "utf8");
  const tags = (html, name) => Array.from(html.matchAll(new RegExp(`<${name}\\b[^>]*>`, "g"))).map((match) => match[0]);
  const meta = (html, key) => tags(html, "meta").filter((tag) => (collectAttribute(tag, "property") ?? collectAttribute(tag, "name")) === key).map((tag) => decodeEntities(collectAttribute(tag, "content") ?? ""));
  const link = (html, rel) => tags(html, "link").filter((tag) => collectAttribute(tag, "rel") === rel).map((tag) => collectAttribute(tag, "href"));
  const jsonLd = (route, html) => Array.from(html.matchAll(/<script\b[^>]*type=["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/g)).flatMap((match) => {
    try {
      return [JSON.parse(match[1])];
    } catch (error) {
      failures.push(`${route}: JSON-LD does not parse: ${error.message}`);
      return [];
    }
  });
  const fail = (route, message) => failures.push(`${route}: ${message}`);

  for (const filePath of htmlFiles) {
    const route = `/${path.relative(publicDir, filePath).replace(/index\.html$/, "")}`;
    const html = fs.readFileSync(filePath, "utf8");

    if (isRedirectPage(html)) continue;

    const title = decodeEntities(stripTags(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""));
    const [description = ""] = meta(html, "description");

    jsonLd(route, html);

    if ([...description].length > 160) fail(route, `description is ${[...description].length} characters, over 160`);
    // A long title drops the site name; only a post title that is long on its own may stay over 65 (seoTitle shortens it).
    if ([...title].length > 65 && title.endsWith("| Yonatan Karp-Rudin")) fail(route, `title "${title}" is over 65 characters with the site name`);
    if (meta(html, "og:type").join() !== (/^\/blog\/[^/]+\/$/.test(route) ? "article" : "website")) fail(route, `og:type is ${meta(html, "og:type")}`);
    if (!/^\/tags\//.test(route) && link(html, "alternate").filter((href) => href?.endsWith(".xml")).join() !== `${origin}/blog/index.xml`) fail(route, "should advertise the blog's RSS feed");
  }

  const blog = read("blog/index.html");
  if (!tags(blog, "a").some((tag) => collectAttribute(tag, "href") === "/blog/index.xml" && /\bchip\b/.test(collectAttribute(tag, "class") ?? ""))) fail("/blog/", "missing the RSS chip linking to /blog/index.xml");

  // One list, with the tags before it so phones get them near the top (#185); the old /blog/page/N/ URLs redirect, below.
  const postCount = JSON.parse(read("index.json")).filter((page) => page.type === "Post").length;
  if (countMatches(blog, /<article\b[^>]*\bpost-row\b/g) !== postCount || /\bpagination\b|rel=["']?next\b/.test(blog)) fail("/blog/", `should list all ${postCount} posts on one page, with no pager`);
  if (!(blog.indexOf("blog-sidebar") < blog.indexOf("post-list"))) fail("/blog/", "the sidebar should come before the list");

  const home = read("index.html");
  const homeLd = jsonLd("/", home);
  const person = homeLd.find((item) => item["@type"] === "Person");
  if (!person?.image || !person.sameAs?.includes("https://x.com/yonvata") || !person.address?.addressLocality) fail("/", "Person JSON-LD needs image, address and the X profile in sameAs");
  if (!person?.alternateName || !person.description || !person.alumniOf?.name || !person.knowsAbout?.length) fail("/", "Person JSON-LD needs alternateName, description, alumniOf and knowsAbout");
  const profile = homeLd.find((item) => item["@type"] === "ProfilePage");
  if (!profile || profile.mainEntity?.["@id"] !== person?.["@id"]) fail("/", "needs a ProfilePage whose mainEntity is the Person");
  if (!homeLd.some((item) => item["@type"] === "WebSite")) fail("/", "needs a WebSite JSON-LD");

  const post = read("blog/build-twitter-bot-kotlin/index.html");
  const types = jsonLd("post", post);
  const posting = types.find((item) => item["@type"] === "BlogPosting");
  for (const key of ["headline", "image", "description", "datePublished", "dateModified"]) {
    if (!posting?.[key]) fail("post", `BlogPosting is missing ${key}`);
  }
  if (!posting?.author?.url) fail("post", "BlogPosting author needs a url");
  if (posting?.description?.endsWith("…")) fail("post", "BlogPosting description should not be truncated");
  if (types.find((item) => item["@type"] === "BreadcrumbList")?.itemListElement?.length !== 3) fail("post", "needs a three-step BreadcrumbList");
  const authorLinks = tags(post.match(/<aside\b[^>]*\barticle-author\b[\s\S]*?<\/aside>/)?.[0] ?? "", "a").map((tag) => collectAttribute(tag, "href"));
  if (authorLinks.join() !== "/cv/,/#floor-R") fail("post", `author card should link the CV and the roof, links are [${authorLinks}]`);
  for (const key of ["og:site_name", "og:locale", "og:image:width", "og:image:height", "og:image:alt", "article:published_time", "twitter:site"]) {
    if (meta(post, key).length !== 1) fail("post", `needs one ${key}`);
  }

  for (const [route, file] of [["/tags/kotlin/", "tags/kotlin/index.html"], ["/tags/", "tags/index.html"], ["/search/", "search/index.html"], ["/404.html", "404.html"]]) {
    if (meta(read(file), "robots").join() !== "noindex") fail(route, "should be noindex");
  }
  if (!/^Posts tagged /.test(read("tags/kotlin/index.html").match(/<title>([^<]*)/)?.[1] ?? "")) fail("/tags/kotlin/", 'title should start "Posts tagged"');
  for (const route of ["/", "/blog/", "/cv/"]) {
    if (meta(read(`${route.slice(1)}index.html`), "robots").length) fail(route, "should not be noindex");
  }

  const notFound = read("404.html");
  if (link(notFound, "canonical").length || meta(notFound, "og:url").length || !/<script\b[^>]*src=["']?\/js\/goatcounter-404\.[^>]*>[\s\S]*?<script\b[^>]*gc\.zgo\.at\/count\.v\d+\.js[^>]*\bintegrity=/.test(notFound)) fail("/404.html", "needs no canonical or og:url, and GoatCounter should count it under 404/<path>");

  if (!/<title>[^<]*\bCV\b/.test(read("cv/index.html"))) fail("/cv/", 'title should say "CV"');

  const sitemap = read("sitemap.xml");
  for (const excluded of ["/tags/", "/search/"]) {
    if (sitemap.includes(`<loc>${origin}${excluded}`)) fail("sitemap.xml", `lists ${excluded}`);
  }

  const feedLinks = (file) => Array.from(read(file).matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)).map((match) => match[1]);
  const homeFeed = feedLinks("index.xml");
  if (homeFeed.length === 0 || homeFeed.some((url) => !url.startsWith(`${origin}/blog/`)) || homeFeed.join() !== feedLinks("blog/index.xml").join()) fail("index.xml", "should list the blog posts only, as /blog/index.xml does");
}

// Post media (#137, #138, #139) and the search page and index (#134).
for (const filePath of htmlFiles) {
  const html = fs.readFileSync(filePath, "utf8");
  const route = `/${path.relative(publicDir, filePath).replace(/index\.html$/, "")}`;
  if (!route.startsWith("/blog/")) continue;

  for (const [tag] of html.matchAll(/<img\b[^>]*>/gi)) {
    const src = collectAttribute(tag, "src") ?? "";
    if (/\.gif(?:[?#]|$)/i.test(src)) failures.push(`${route}: animated GIF ${src}; use the video shortcode`);
    if (/class=["']?article__content/.test(html) && src.startsWith("/images/blog/") && !src.endsWith(".svg") && (collectAttribute(tag, "width") === null || collectAttribute(tag, "height") === null)) {
      failures.push(`${route}: ${src} needs width and height`);
    }
    // Responsive post images (#185): every size is published, none is wider than the file, and the file itself comes last.
    const srcset = collectAttribute(tag, "srcset");
    if (srcset !== null) {
      const sizes = srcset.split(", ").map((candidate) => candidate.split(" "));
      if (!collectAttribute(tag, "sizes") || /\.svg$/i.test(src)) failures.push(`${route}: ${src} has a bad srcset: needs sizes, and no SVG gets one`);
      if (sizes.some(([url]) => !fs.existsSync(path.join(publicDir, url)))) failures.push(`${route}: ${src} has a srcset URL that is not published`);
      if (sizes.at(-1)[0] !== src || sizes.at(-1)[1] !== `${collectAttribute(tag, "width")}w` || sizes.slice(0, -1).some(([, width]) => parseInt(width) >= parseInt(collectAttribute(tag, "width")))) failures.push(`${route}: ${src} srcset should end with the file at its own width, every other size below it`);
    }
  }
  for (const [tag] of html.matchAll(/<video\b[^>]*>/gi)) {
    if (!/\bcontrols\b/.test(tag) || !collectAttribute(tag, "aria-label") || /\bautoplay\b/.test(tag)) failures.push(`${route}: videos need controls and aria-label, and no autoplay`);
  }
  const diagrams = Array.from(html.matchAll(/<pre\b[^>]*class=["']?mermaid\b[^>]*>/g)).map((match) => match[0]);
  if (diagrams.some((tag) => collectAttribute(tag, "tabindex") !== "0" || collectAttribute(tag, "role") !== "region" || !collectAttribute(tag, "aria-label"))) {
    failures.push(`${route}: a Mermaid diagram needs tabindex=0, role=region and an aria-label`);
  }
  if (diagrams.length && !/<script\b[^>]*type=["']?module\b[^>]*src=["']?\/js\/mermaid-loader\./.test(html)) failures.push(`${route}: Mermaid should load lazily through js/mermaid-loader.js`);
  const loader = html.match(/src=["']?(\/js\/mermaid-loader\.[^"'\s>]+)/)?.[1];
  const loaderSource = loader ? fs.readFileSync(path.join(publicDir, loader), "utf8") : "";
  if (loader && !/useMaxWidth:\s*!?(?:false|1)/.test(loaderSource)) failures.push(`${route}: Mermaid should draw with useMaxWidth false`);
  // Self-hosted (#182): the loader imports Mermaid from the site, from the copy scripts/vendor-mermaid.js makes
  const mermaidEntry = loaderSource.match(/import\(\s*["'`]([^"'`]+)["'`]\s*\)/)?.[1];
  if (loader && (!mermaidEntry?.startsWith("/vendor/") || !fs.existsSync(path.join(publicDir, mermaidEntry)))) {
    failures.push(`${route}: the loader imports Mermaid from ${mermaidEntry}, which is not a file in public/vendor/; is its version the one in package.json?`);
  }
  if (!diagrams.length && /mermaid-loader|mermaid\.esm/.test(html)) failures.push(`${route}: loads Mermaid without a diagram`);
}

{
  const photo = fs.readFileSync(path.join(publicDir, "blog", "how-hashmap-works-java", "index.html"), "utf8").match(/<img\b[^>]*\bsrc=["']?\/images\/blog\/desk-macbook-code\.jpeg[^>]*>/)?.[0] ?? "";
  if (!/\.webp 480w/.test(collectAttribute(photo, "srcset") ?? "")) failures.push("/blog/how-hashmap-works-java/: the photo should have webp sizes in a srcset");
}

{
  const search = fs.readFileSync(path.join(publicDir, "search", "index.html"), "utf8");
  if (!/<form\b[^>]*action=["']?\/search\/[^>]*>[\s\S]*?<input\b[^>]*name=["']?q\b/.test(search)) failures.push("/search/: needs a GET form with an input named q");
  if (!/id=["']?search-status["']?[^>]*role=["']?status/.test(search)) failures.push("/search/: needs the #search-status live region");

  const index = JSON.parse(fs.readFileSync(path.join(publicDir, "index.json"), "utf8"));
  const home = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
  const projects = fs.readdirSync(projectsDir).filter((file) => file.endsWith(".md") && file !== "_index.md").length;
  if (index.filter((page) => ["Project", "Contribution"].includes(page.type)).length !== projects) failures.push(`index.json: should list all ${projects} projects`);
  if (!index.some((page) => page.type === "Post" && /\bkafka\b/i.test(page.content))) failures.push("index.json: posts should carry their full text, so \"kafka\" finds a post");
  // Tags are searchable too (#186): posts carry their tags, projects their tech.
  const tagsOf = (permalink) => index.find((page) => page.permalink === permalink)?.tags || [];
  if (!tagsOf("/blog/fix-misconfigurations-redistemplate/").includes("redistemplate")) failures.push("index.json: posts should carry their tags, so \"redistemplate\" is on the RedisTemplate post");
  if (!tagsOf("/projects/ff4k/").includes("Coroutines")) failures.push("index.json: projects should carry their tech as tags, so \"Coroutines\" is on ff4k");
  for (const page of index) {
    if (!page.type) failures.push(`index.json: ${page.permalink} has no type`);
    if (!Array.isArray(page.tags)) failures.push(`index.json: ${page.permalink} has no tags array`);
    else if (page.type === "Post" && !page.tags.length) failures.push(`index.json: ${page.permalink} has no tags`);
    if (/\/(?:search|experience|education|testimonial)\//.test(page.permalink)) failures.push(`index.json: should not link to ${page.permalink}`);
    if (/\(contributor\)/i.test(page.title)) failures.push(`index.json: "${page.title}" keeps "(contributor)"`);
    const floor = page.permalink.match(/#(floor-[^/]+)$/)?.[1];
    if (floor && !new RegExp(`id=["']?${floor}["'\\s>]`).test(home)) failures.push(`index.json: ${page.permalink} has no matching floor on the homepage`);
  }
}

// --- Old Hashnode URLs (#117): aliases redirect to the blog, /rss.xml serves the blog feed. ---
{
  const read = (file) => (fs.existsSync(path.join(publicDir, file)) ? fs.readFileSync(path.join(publicDir, file), "utf8") : "");
  const redirects = { "how-does-hashmap-work-in-java": "/blog/how-hashmap-works-java/", "design-patterns-builder": "/blog/design-patterns-builder/", "design-patterns-singleton": "/blog/", "blog/page/1": "/blog/", "blog/page/2": "/blog/", "blog/page/3": "/blog/", "blog/page/4": "/blog/" };
  for (const [from, to] of Object.entries(redirects)) {
    const html = read(`${from}/index.html`);
    const target = `https://yonatankarp.com${to}`;
    if (!isRedirectPage(html) || !html.includes(`url=${target}"`) || !new RegExp(`rel=["']?canonical["']? href=["']?${target}["'\\s>]`).test(html)) failures.push(`/${from}/: should redirect to ${to}`);
  }
  if (/how-does-hashmap-work-in-java/.test(read("sitemap.xml") + read("index.json"))) failures.push("sitemap.xml/index.json: should not list the Hashnode aliases");
  const items = (file) => Array.from(read(file).matchAll(/<item>[\s\S]*?<link>([^<]+)<\/link>/g)).map((match) => match[1]).join();
  if (!items("rss.xml") || items("rss.xml") !== items("blog/index.xml")) failures.push("rss.xml: should list the same posts as /blog/index.xml");
}
// --- end #117 ---
// The old experience, education and testimonial pages are noindex redirects to their homepage floor (#133).
{
  const home = fs.readFileSync(path.join(publicDir, "index.html"), "utf8");
  const sitemap = fs.readFileSync(path.join(publicDir, "sitemap.xml"), "utf8");
  for (const filePath of htmlFiles) {
    const route = `/${path.relative(publicDir, filePath).replace(/index\.html$/, "")}`;
    if (!/^\/(?:experience|education|testimonial)\//.test(route)) continue;
    const html = fs.readFileSync(filePath, "utf8");
    const target = html.match(/http-equiv=["']?refresh["']?\s+content=["']?0; url=([^"'\s>]+)/)?.[1];
    const floor = target?.match(/#(floor-[^/]+)$/)?.[1];
    if (!isRedirectPage(html) || !/<meta\b[^>]*name=["']?robots["']?[^>]*content=["']?noindex/.test(html)) failures.push(`${route}: should be a noindex redirect`);
    else if (/^\/[^/]+\/$/.test(route) ? target !== "https://yonatankarp.com/" : !floor || !new RegExp(`id=["']?${floor}["'\\s>]`).test(home)) failures.push(`${route}: redirects to ${target}, not to its floor on the homepage`);
    if (sitemap.includes(`<loc>https://yonatankarp.com${route}<`)) failures.push(`sitemap.xml: lists ${route}`);
  }
  // /about is a noindex redirect to the lobby, not an alias of the blog (#187).
  const about = fs.existsSync(path.join(publicDir, "about", "index.html")) ? fs.readFileSync(path.join(publicDir, "about", "index.html"), "utf8") : "";
  if (!isRedirectPage(about) || !/content=["']?noindex/.test(about) || !about.includes('url=https://yonatankarp.com/#floor-L"') || !/id=["']?floor-L["'\s>]/.test(home)) failures.push("/about/: should be a noindex redirect to /#floor-L");
  if (sitemap.includes("<loc>https://yonatankarp.com/about/<")) failures.push("sitemap.xml: lists /about/");
}

if (failures.length > 0) {
  console.error("Generated HTML check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Generated HTML passed accessibility/placeholder checks across ${htmlFiles.length} files.`);
