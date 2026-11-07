// A wide painting that pans sideways to the label or chip picked (button[data-pick]) and shows that pick's
// [data-district] in the panel: the projects' Workshop Row (workshop.js). The homepage's city zooms instead (city.js). `floats`
// says whether the panel lies over the painting, which moves the middle of the free view right of it. Returns the pan.
export function panning(box, first, floats, onPick) {
  const scene = box.querySelector('.city-scene'), panel = box.querySelector('.city-panel');
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  let current = first;
  const pan = (smooth) => {
    const tag = box.querySelector(`.city-tag[data-pick="${current}"]`), p = panel.getBoundingClientRect();
    const focus = floats() ? (p.right + scene.clientWidth) / 2 : scene.clientWidth / 2;
    scene.scrollTo({ left: tag.offsetLeft - focus, behavior: smooth && !still.matches ? 'smooth' : 'instant' });
  };
  box.addEventListener('click', (e) => {
    const picked = e.target.closest('button[data-pick]');
    if (!picked) return;
    current = picked.dataset.pick;
    onPick?.(picked);
    for (const b of box.querySelectorAll('[data-pick]')) {   // a label that is a link (into its district) is marked too
      if (b.matches('.city-tag')) b.classList.toggle('on', b.dataset.pick === current);
      if (b.hasAttribute('aria-pressed')) b.setAttribute('aria-pressed', b.dataset.pick === current);
    }
    for (const d of box.querySelectorAll('[data-district]')) d.hidden = d.dataset.district !== current;
    pan(true);
  });
  // An up or down wheel pans the street too, as on the city; a sideways one already scrolls it, and a pinch is the browser's.
  scene.addEventListener('wheel', (e) => {
    const px = wheelPan(e, floats(), scene.scrollWidth > scene.clientWidth, scene.clientWidth);
    if (px === null) return;
    e.preventDefault();
    scene.scrollBy({ left: px, behavior: 'instant' });   // in step with the wheel, so no motion is added
  }, { passive: false });
  addEventListener('resize', () => pan(false));
  return pan;
}

// How far a wheel turn pans the street, in px, or null where it is left alone: a pinch (ctrlKey), a mostly sideways turn
// (the street's own scroll), or where the panel stacks under the street or the street fits the screen (the page's scroll).
export function wheelPan(e, floats, wide, page) {
  if (e.ctrlKey || !floats || !wide || Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return null;
  return e.deltaY * (e.deltaMode === 1 ? 40 : e.deltaMode === 2 ? page : 1);
}
