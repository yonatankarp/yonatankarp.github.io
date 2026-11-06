// A wide painting that pans sideways to the label or chip picked (button[data-pick]) and shows that pick's
// [data-district] in the panel: the homepage's city (city.js). `floats` says whether the panel lies over the painting,
// which moves the middle of the free view right of it. Returns the pan.
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
    for (const b of box.querySelectorAll('button[data-pick]')) {
      if (b.matches('.city-tag')) b.classList.toggle('on', b.dataset.pick === current);
      else b.setAttribute('aria-pressed', b.dataset.pick === current);
    }
    for (const d of box.querySelectorAll('[data-district]')) d.hidden = d.dataset.district !== current;
    pan(true);
  });
  addEventListener('resize', () => pan(false));
  return pan;
}
