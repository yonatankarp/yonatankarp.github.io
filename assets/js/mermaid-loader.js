// Loaded by baseof.html on pages with a diagram, as a file so the CSP in head.html needs no inline script.
// The version is also allowed by script-src there: bump both together.
// Mermaid is ~200 KB of JS: fetch it only when a diagram comes within a few hundred px of the viewport
const io = new IntersectionObserver(async (entries) => {
  if (!entries.some((e) => e.isIntersecting)) return;
  io.disconnect();
  const { default: mermaid } = await import('https://cdn.jsdelivr.net/npm/mermaid@11.17.2/dist/mermaid.esm.min.mjs');
  mermaid.initialize({
    startOnLoad: false,
    // Draw at natural size; the <pre> scrolls sideways on phones instead of shrinking the text
    flowchart: { useMaxWidth: false },
    sequence: { useMaxWidth: false },
    theme: 'base',
    themeVariables: {
      fontFamily: 'Outfit, system-ui, sans-serif',
      fontSize: '15px',
      background: 'transparent',
      primaryColor: '#2b3344',
      primaryTextColor: '#f2ece0',
      primaryBorderColor: '#0a0b10',
      secondaryColor: '#151923',
      tertiaryColor: '#151923',
      lineColor: '#ffb547',
      signalColor: '#ffb547',
      textColor: '#f2ece0',
      edgeLabelBackground: '#151923',
      clusterBkg: 'transparent',
      clusterBorder: '#2b3344',
    },
  });
  await mermaid.run({ querySelector: '.mermaid' });
}, { rootMargin: '400px 0px' });
document.querySelectorAll('.mermaid').forEach((el) => io.observe(el));
