// Loaded by baseof.html on pages with a diagram, as a file so the CSP in head.html needs no inline script.
// Mermaid is self-hosted (#182): scripts/vendor-mermaid.js copies the npm package's ESM build to /vendor/, and
// baseof.html runs this file as a template with the version package.json pins.
// One dialog for every diagram. Its svg moves in and back rather than being cloned, so Mermaid's ids stay unique.
const addZoom = () => {
  const dialog = document.createElement('dialog');
  dialog.className = 'diagram-zoom';
  dialog.setAttribute('aria-labelledby', 'diagram-zoom-title');
  dialog.innerHTML = '<div class="diagram-zoom__head"><p id="diagram-zoom-title"></p><button type="button" class="code-copy">Close</button></div><div class="diagram-zoom__body" tabindex="0" autofocus></div>';
  const body = dialog.querySelector('.diagram-zoom__body');
  let trigger;
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.closest('button')) dialog.close();
  });
  dialog.addEventListener('close', () => {
    trigger.before(body.firstElementChild);
    trigger.parentElement.style.minHeight = '';
    trigger.focus();
  });
  document.querySelector('.mermaid').parentElement.append(dialog);
  document.querySelectorAll('.mermaid').forEach((block) => {
    const svg = block.querySelector(':scope > svg');
    const title = svg.querySelector('title').textContent;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'code-copy';
    button.textContent = 'Zoom in';
    button.setAttribute('aria-label', `Zoom in: ${title}`);
    block.append(button);
    block.tabIndex = -1;   // a click on the diagram then counts as mouse focus, so the dialog opens without a focus ring
    block.addEventListener('click', () => {
      trigger = button;
      block.style.minHeight = `${block.offsetHeight}px`;   // the page behind stays where it is without the svg
      dialog.querySelector('p').textContent = title;
      body.append(svg);
      dialog.showModal();
    });
  });
};
// Mermaid is ~200 KB of JS: fetch it only when a diagram comes within a few hundred px of the viewport
const io = new IntersectionObserver(async (entries) => {
  if (!entries.some((e) => e.isIntersecting)) return;
  io.disconnect();
  const { default: mermaid } = await import('/vendor/mermaid-{{ .version }}/mermaid.esm.min.mjs');
  mermaid.initialize({
    startOnLoad: false,
    // Draw at natural size: custom.css shrinks the svg to the column, and in the zoom dialog it is that size again
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
  addZoom();
}, { rootMargin: '400px 0px' });
document.querySelectorAll('.mermaid').forEach((el) => io.observe(el));
