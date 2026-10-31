#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");
const htmlFiles = [];
const failures = [];
const placeholderPattern = /\b(?:TODO|FIXME|Lorem ipsum|Coming soon)\b/i;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      walk(fullPath);
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".html")) {
      htmlFiles.push(fullPath);
    }
  }
}

function stripTags(value) {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function collectAttribute(tag, attributeName) {
  const pattern = new RegExp(`\\b${attributeName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i");
  const match = tag.match(pattern);

  return match ? match[1] ?? match[2] ?? match[3] ?? "" : null;
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

  if (headings.join("|") !== "My projects|Open-source contributions") {
    failures.push(`${route}: h2s are [${headings.join(", ")}], expected [My projects, Open-source contributions]`);
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

    const images = Array.from(card.matchAll(/<img\b[^>]*>/g)).map((match) => match[0]);
    const hasPainting = fs.existsSync(path.join(rootDir, "assets", "images", "projects", "pixel", `${project.slug}.png`));

    if (!hasPainting && images.length > 0) {
      failures.push(`${route}: ${title} has an image but no assets/images/projects/pixel/${project.slug}.png`);
    }

    if (hasPainting && (images.length !== 1 || !/class=["']?px-painting[\s"'>]/.test(images[0]) || !stripTags(collectAttribute(images[0], "alt") ?? ""))) {
      failures.push(`${route}: ${title} should have exactly one img.px-painting with alt text`);
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

  const paintings = Array.from(html.matchAll(/<img\b[^>]*>/g)).map((match) => match[0]).filter((tag) => /class=["']?px-painting[\s"'>]/.test(tag));
  const hasPainting = fs.existsSync(path.join(rootDir, "assets", "images", "projects", "pixel", `${slug}.png`));

  if (paintings.length !== (hasPainting ? 1 : 0)) {
    fail(`expected ${hasPainting ? "one" : "no"} img.px-painting, got ${paintings.length}`);
  }

  const footer = html.match(/<footer\b[^>]*class=["']?site-footer["']?[\s\S]*?<\/footer>/)?.[0] ?? "";

  for (const needle of ["github.com/yonatankarp", "linkedin.com/in/yonatankarp", "mailto:"]) {
    if (!footer.includes(needle)) {
      fail(`footer is missing the ${needle} link`);
    }
  }
}

const barTabs = [["/projects/", "Projects"], ["/blog/", "Blog"], ["/cv/", "CV"]];

function currentTab(route) {
  if (route.startsWith("/projects/")) return "/projects/";
  if (route.startsWith("/blog/") || route.startsWith("/tags/")) return "/blog/";
  if (route === "/cv/") return "/cv/";
  return null;
}

function checkTopBar(route, html) {
  const bars = countMatches(html, /class=["']?px-bar["']?[\s>]/g);

  if (bars !== 1) {
    failures.push(`${route}: ${bars === 0 ? "missing px-bar" : `expected one px-bar, got ${bars}`}`);
    return;
  }

  const tabs = html.match(/<nav\b[^>]*class=["']?px-bar__tabs["']?[^>]*>([\s\S]*?)<\/nav>/);
  const links = tabs ? Array.from(tabs[1].matchAll(/<a\b[^>]*>/g)).map((match) => match[0]) : [];
  const hrefs = links.map((tag) => collectAttribute(tag, "href"));

  if (hrefs.join(" ") !== barTabs.map(([href]) => href).join(" ")) {
    failures.push(`${route}: px-bar tabs are [${hrefs.join(", ")}], expected [${barTabs.map(([href]) => href).join(", ")}]`);
  } else {
    const expected = currentTab(route);
    const current = links.map((tag, index) => (collectAttribute(tag, "aria-current") === "page" ? hrefs[index] : null)).filter(Boolean);

    if (current.join(" ") !== (expected ?? "")) {
      failures.push(`${route}: aria-current is on [${current.join(", ")}], expected ${expected ?? "no tab"}`);
    }
  }

  const downloads = Array.from(html.matchAll(/<a\b[^>]*class=["']?px-download["']?(?=[\s>])[^>]*>/g)).map((match) => match[0]);

  if (downloads.length !== 1 || collectAttribute(downloads[0], "href") !== "/yonatan-karp-rudin-cv.pdf") {
    failures.push(`${route}: expected one px-download linking to /yonatan-karp-rudin-cv.pdf`);
  }

  if (/site-header|menu-toggle/.test(html)) {
    failures.push(`${route}: still has the old site-header or menu-toggle`);
  }

  const jersey = countMatches(html, /<link\b[^>]*fonts\.googleapis\.com[^>]*Jersey\+15/g);

  if (jersey !== 1) {
    failures.push(`${route}: expected one Google Fonts link with Jersey+15, got ${jersey}`);
  }

  if (route === "/cv/" && /cv-head__art/.test(html)) {
    failures.push(`${route}: still has cv-head__art`);
  }
}

if (!fs.existsSync(publicDir)) {
  console.error("Generated HTML check requires a built public/ directory. Run npm run build first.");
  process.exit(1);
}

walk(publicDir);

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

    if (alt === null || stripTags(alt) === "") {
      failures.push(`${route}: image missing useful alt text: ${tag.slice(0, 160)}`);
    }
  }

  if (/\bhref=["']#["']/i.test(html)) {
    failures.push(`${route}: contains empty hash link`);
  }

  if (placeholderPattern.test(html)) {
    failures.push(`${route}: contains placeholder text`);
  }

  if (!redirectPage && route !== "/" && !route.startsWith("/madeira-2026/")) {
    checkTopBar(route, html);
  }

  if (route === "/projects/") {
    checkProjectsPage(route, html);
  }

  const caseStudy = route.match(/^\/projects\/([^/]+)\/$/);

  if (caseStudy) {
    checkCaseStudyPage(route, html, caseStudy[1]);
  }

  if (/^\/blog(?:\/page\/\d+)?\/$/.test(route)) {
    const postRows = countMatches(html, /class=["'][^"']*\bpost-row\b/g);
    const rowThumbs = countMatches(html, /class=["'][^"']*\bpost-row__thumb\b/g);

    if (postRows > 0 && postRows !== rowThumbs) {
      failures.push(`${route}: expected one post-row__thumb per post-row, got ${rowThumbs} thumbs for ${postRows} rows`);
    }
  }
}

if (failures.length > 0) {
  console.error("Generated HTML check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Generated HTML passed accessibility/placeholder checks across ${htmlFiles.length} files.`);
