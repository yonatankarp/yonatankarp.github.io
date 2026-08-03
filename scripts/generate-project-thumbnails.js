const path = require("path");
const { chromium } = require("playwright");

const rootDir = path.resolve(__dirname, "..");
const outDir = path.join(rootDir, "assets", "images", "projects");

const projects = [
  {
    slug: "sse-mcp-server",
    kicker: "SSE MCP SERVER",
    title: "Tool bridge",
    subtitle: "Kotlin server for agent tool execution",
    accent: "#6dd6a0",
    secondary: "#84a7ff",
    code: [
      '{',
      '  "name": "flowise-tools",',
      '  "type": "sse",',
      '  "url": "/mcp/events"',
      '}',
    ],
    chips: ["Kotlin", "MCP", "SSE"],
  },
  {
    slug: "exekutor",
    kicker: "EXEKUTOR",
    title: "Plugin runtime",
    subtitle: "Extensible Kotlin application architecture",
    accent: "#f3a53b",
    secondary: "#d96538",
    code: [
      "interface Plugin {",
      "  fun execute(ctx: Context)",
      "}",
      "",
      "registry.load(command)",
    ],
    chips: ["Kotlin", "Plugins", "Runtime"],
  },
  {
    slug: "beat-the-machine",
    kicker: "BEAT THE MACHINE",
    title: "Prompt guessing game",
    subtitle: "Players reverse-engineer AI image prompts",
    accent: "#77c7ff",
    secondary: "#f2c562",
    code: [
      "fear _ _ dark",
      "fear of _ dark",
      "fear of the dark",
    ],
    chips: ["Kotlin", "Spring Boot", "DDD"],
  },
  {
    slug: "larry-the-last-zombie",
    kicker: "LARRY THE LAST ZOMBIE",
    title: "Tower defense game",
    subtitle: "University team project in Unity",
    accent: "#8be15c",
    secondary: "#c7f06a",
    code: [
      "wave 07",
      "spawn_rate += 1.4",
      "turret.lock(target)",
      "base.health: 18%",
    ],
    chips: ["Unity", "C#", "Game AI"],
  },
  {
    slug: "jacobs-choice",
    kicker: "JACOB'S CHOICE",
    title: "Horror adventure",
    subtitle: "GameIS 2015 award-winning project",
    accent: "#b59cff",
    secondary: "#6ad6c9",
    code: [
      "room: cellar",
      "light = flicker()",
      "choice.branch('hide')",
      "ending: unknown",
    ],
    chips: ["GameMaker", "GML", "Narrative"],
  },
  {
    slug: "openapi-generator",
    kicker: "OPENAPI GENERATOR",
    title: "Kotlin generator",
    subtitle: "Spring Boot 4 and Jackson 3 support",
    accent: "#7dd3fc",
    secondary: "#fb7185",
    code: [
      "generator: kotlin-spring",
      "springBoot = 4",
      "jackson = 3",
      "10 merged PRs",
    ],
    chips: ["Kotlin", "Spring Boot", "OpenAPI"],
  },
  {
    slug: "konsist",
    kicker: "KONSIST",
    title: "Static analyzer",
    subtitle: "CI, snippets, and null handling fixes",
    accent: "#c084fc",
    secondary: "#22d3ee",
    code: [
      "verify(snippets)",
      "ci.pipeline.fix()",
      "nulls.handled = true",
      "3 merged PRs",
    ],
    chips: ["Kotlin", "CI", "Analysis"],
  },
  {
    slug: "java-design-patterns",
    kicker: "JAVA DESIGN PATTERNS",
    title: "Prototype refactor",
    subtitle: "Upstream pattern implementation cleanup",
    accent: "#facc15",
    secondary: "#38bdf8",
    code: [
      "pattern: Prototype",
      "copy(): Shape",
      "tests.green()",
      "PR #1970",
    ],
    chips: ["Java", "Patterns", "Refactor"],
  },
  {
    slug: "ff4j",
    kicker: "FF4J",
    title: "Jakarta migration",
    subtitle: "javax-to-jakarta namespace migration",
    accent: "#fb923c",
    secondary: "#4ade80",
    code: [
      "javax.* -> jakarta.*",
      "imports.migrated()",
      "compat.checked()",
      "PR #752",
    ],
    chips: ["Java", "Jakarta", "Migration"],
  },
];

function renderProject(project) {
  const codeLines = project.code
    .map((line) => `<span>${escapeHtml(line) || "&nbsp;"}</span>`)
    .join("");
  const chips = project.chips.map((chip) => `<span>${chip}</span>`).join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    :root {
      color-scheme: dark;
      font-family: "Inter", "Arial", sans-serif;
    }

    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      width: 1280px;
      height: 800px;
      overflow: hidden;
      background: #07080d;
    }

    .thumb {
      position: relative;
      width: 1280px;
      height: 800px;
      padding: 72px;
      color: #f7f2e9;
      background:
        radial-gradient(circle at 22% 16%, ${project.accent}44, transparent 31%),
        radial-gradient(circle at 82% 14%, ${project.secondary}33, transparent 28%),
        linear-gradient(135deg, #131722 0%, #090b11 56%, #17120d 100%);
      isolation: isolate;
    }

    .thumb::before {
      content: "";
      position: absolute;
      inset: 0;
      opacity: 0.26;
      background-image:
        linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px);
      background-size: 44px 44px;
      mask-image: linear-gradient(130deg, black, transparent 72%);
      z-index: -1;
    }

    .thumb::after {
      content: "";
      position: absolute;
      inset: 28px;
      border: 1px solid rgba(255,255,255,0.12);
      border-radius: 38px;
      pointer-events: none;
    }

    .layout {
      display: grid;
      grid-template-columns: 1fr 0.92fr;
      gap: 56px;
      align-items: center;
      height: 100%;
    }

    .kicker {
      margin: 0 0 28px;
      color: ${project.accent};
      font-size: 31px;
      font-weight: 800;
      letter-spacing: 0.14em;
    }

    h1 {
      margin: 0;
      max-width: 560px;
      font-size: 86px;
      line-height: 0.94;
      letter-spacing: -0.04em;
    }

    .subtitle {
      max-width: 520px;
      margin: 30px 0 0;
      color: rgba(247,242,233,0.75);
      font-size: 30px;
      line-height: 1.3;
      font-weight: 600;
    }

    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      margin-top: 54px;
    }

    .chips span {
      padding: 13px 18px;
      border: 1px solid rgba(255,255,255,0.14);
      border-radius: 999px;
      background: rgba(255,255,255,0.08);
      color: rgba(247,242,233,0.82);
      font-size: 21px;
      font-weight: 700;
    }

    .panel {
      position: relative;
      padding: 34px 34px 78px;
      border: 1px solid rgba(255,255,255,0.16);
      border-radius: 34px;
      background:
        linear-gradient(180deg, rgba(255,255,255,0.13), rgba(255,255,255,0.04)),
        rgba(7, 8, 13, 0.68);
      box-shadow: 0 44px 110px rgba(0,0,0,0.38);
    }

    .panel-header {
      display: flex;
      gap: 12px;
      margin-bottom: 28px;
    }

    .dot {
      width: 19px;
      height: 19px;
      border-radius: 999px;
      background: rgba(255,255,255,0.24);
    }

    .dot:first-child {
      background: ${project.secondary};
    }

    .dot:nth-child(2) {
      background: ${project.accent};
    }

    pre {
      margin: 0;
      display: grid;
      gap: 16px;
      color: rgba(247,242,233,0.88);
      font-family: "SFMono-Regular", "Menlo", "Consolas", monospace;
      font-size: 25px;
      line-height: 1.22;
      font-weight: 650;
      white-space: pre-wrap;
    }

    pre span {
      display: block;
      min-height: 36px;
    }

    .bar {
      position: absolute;
      right: 40px;
      bottom: 38px;
      left: 40px;
      height: 12px;
      overflow: hidden;
      border-radius: 999px;
      background: rgba(255,255,255,0.08);
    }

    .bar::before {
      content: "";
      display: block;
      width: 68%;
      height: 100%;
      border-radius: inherit;
      background: linear-gradient(90deg, ${project.accent}, ${project.secondary});
    }
  </style>
</head>
<body>
  <main class="thumb">
    <div class="layout">
      <section>
        <p class="kicker">${escapeHtml(project.kicker)}</p>
        <h1>${escapeHtml(project.title)}</h1>
        <p class="subtitle">${escapeHtml(project.subtitle)}</p>
        <div class="chips">${chips}</div>
      </section>
      <section class="panel" aria-label="Project code preview">
        <div class="panel-header"><span class="dot"></span><span class="dot"></span><span class="dot"></span></div>
        <pre>${codeLines}</pre>
        <div class="bar"></div>
      </section>
    </div>
  </main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

(async () => {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    for (const project of projects) {
      await page.setContent(renderProject(project), { waitUntil: "networkidle" });
      await page.screenshot({
        path: path.join(outDir, `${project.slug}.png`),
        fullPage: false,
        type: "png",
      });
      console.log(`Generated assets/images/projects/${project.slug}.png`);
    }
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
