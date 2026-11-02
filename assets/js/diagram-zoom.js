// Loaded by baseof.html on pages with a diagram, as a file so the CSP in head.html needs no inline script. The diagrams
// are drawn at build time (scripts/render-diagrams.js, #250); this only adds their Zoom in.
// One dialog for every diagram. Its svg moves in and back rather than being cloned, so the svg's ids stay unique.
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
