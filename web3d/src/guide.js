// Floor-to-floor navigation for the building: wheel, swipe, keys and the elevator panel each ride one floor; cards
// follow arrivals. pixel.js passes an api with go(index), index() and moving(), and emits
// building:floor / building:depart / building:arrive on document.
// Short or narrow (zoomed) screens have no room for a room, a card and the lift at once: they get the plain,
// scrolling page of the no-JS layout. Zooming crosses the line both ways, so it is followed live (#24).
// layouts/index.html sets the first mode with the same query in <head>, before the first paint (#39).
export const roomy = matchMedia('(min-height: 500px) and (min-width: 360px)');

export function guide(api, root = document) {
  const stops = [...root.querySelectorAll('section[data-floor]')];
  const keys = stops.map((s) => s.dataset.floor);
  const buttons = [...root.querySelectorAll('.building-floor-btn[data-goto]')];
  const indicator = root.querySelector('[data-elevator-floor]');
  const arrow = root.querySelector('[data-elevator-arrow]');
  const status = root.querySelector('[data-building-status]');
  const windows = root.querySelector('[data-exterior-windows]');
  // pixel.js adds the windows in its art file's order, all at once: re-append them top to bottom for the Tab order.
  if (windows) new MutationObserver((_, mo) => {
    mo.disconnect();
    windows.append(...[...windows.children].sort((a, b) => keys.indexOf(a.dataset.goto) - keys.indexOf(b.dataset.goto)));
  }).observe(windows, { childList: true });

  // Stops are in page order, top to bottom as the building stands, but the ride runs one way: in from the street (E)
  // at the lobby, then up floor by floor to the roof. Scrolling down (+1) rides on, up (-1) back. The garage (P) is
  // off the ride: its button, the lobby's sign or #floor-P go down to it, and either way out is back to the lobby.
  const path = ['E', ...keys.filter((k) => k !== 'E' && k !== 'P').reverse()];
  const neighbour = (key, dir) => keys.indexOf(key === 'P' ? 'L' : path[path.indexOf(key) + dir]);
  // Step inside: a floor's full story opens over its room. While it is open the lift stays put and the wheel and
  // keys scroll the panel; "Back to the lift", Escape or riding away close it.
  let open = null, afterPop = null;
  // Step inside pushes a history entry, so a phone's Back closes the panel instead of leaving the site (#129).
  const closePanel = (refocus = true, popped = false) => {
    if (!open) return;
    const { panel, button, top } = open;
    panel.classList.remove('is-open');
    panel.setAttribute('role', 'region');   // in the plain page's flow it is a region again, not a dialog
    panel.removeAttribute('aria-modal');
    button.setAttribute('aria-expanded', 'false');
    document.documentElement.classList.remove('panel-open');
    // back on Step inside, with the card where the reader left it (focus would scroll it to the end)
    const refocusNow = () => { button.focus({ preventScroll: true }); button.closest('.floor-card').scrollTop = top; };
    if (refocus) refocusNow();
    open = null;
    // Closed here, not by Back: drop the entry, so the next Back leaves the page. A ride already replaced it.
    const back = !popped && history.state?.panel;
    if (refocus && (popped || back)) afterPop = refocusNow;   // Chrome clears focus as Back lands on a #floor-X entry
    if (back) history.back();
  };
  const openPanel = (button) => {
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    if (!panel) return;
    closePanel(false, true);
    if (!history.state?.panel) history.pushState({ panel: true }, '', location.href);
    open = { panel, button, top: button.closest('.floor-card').scrollTop };
    panel.classList.add('is-open');
    // Open, it holds Tab until it is closed, so it says so: a modal dialog, named by its title (#131).
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    button.setAttribute('aria-expanded', 'true');
    document.documentElement.classList.add('panel-open');
    panel.scrollTop = 0;
    panel.focus();
    count(`step-in-${button.closest('[data-floor]').dataset.floor}`);
  };
  // Guided, the other floors are hidden="until-found": Ctrl+F still finds their text, and a match rides there (#131).
  // Hidden on arrival, not on departure, as a skipped subtree would cut the departing card's fade.
  const conceal = (index) => stops.forEach((s, i) => { s.hidden = roomy.matches && i !== index ? 'until-found' : false; });
  // A dissolve runs to its end, so a match found during one waits for its arrival, or its floor would be hidden again.
  let sought = -1;
  root.addEventListener('beforematch', (e) => {
    const to = keys.indexOf(e.target.closest('[data-floor]').dataset.floor);
    if (!api.go(to)) sought = to;
  });
  const setMode = (change) => {
    closePanel(false);
    document.documentElement.classList.toggle('building--guided', roomy.matches);
    conceal(api.index());
    if (!change) return;   // on load the browser already scrolls to any #floor-X
    if (roomy.matches) scrollTo(0, 0);
    else stops[api.index()]?.scrollIntoView();   // keep the reader's floor in view on the plain page
  };
  addEventListener('popstate', () => {
    closePanel(true, true);
    if (afterPop) setTimeout(afterPop);   // after the traversal has dropped focus
    afterPop = null;
  });
  // Back from a typed #floor-X to the bare address: the street, as on load (pixel.js only follows floor hashes).
  addEventListener('hashchange', () => { const e = keys.indexOf('E'); if (!location.hash && e >= 0) api.go(e); });
  roomy.addEventListener('change', setMode);
  setMode();

  // api.index() is where the lift is heading: a step during a ride carries it one floor further, so quick swipes
  // and presses add up into one longer ride instead of being dropped (#41).
  const step = (dir) => {
    if (open) return;
    const to = neighbour(keys[api.index()], dir);
    if (to >= 0) api.go(to);
  };

  // Trackpads send long momentum tails: one gesture (wheel events without a 150 ms pause) is one floor.
  let acc = 0, lastWheel = -Infinity, spent = false;
  addEventListener('wheel', (e) => {
    if (!roomy.matches || e.ctrlKey) return;   // ctrl+wheel is a pinch or the browser's zoom, not a ride
    const now = performance.now();
    if (now - lastWheel > 150) { acc = 0; spent = false; }
    lastWheel = now;
    if (scrollsInside(e.target, Math.sign(e.deltaY))) { spent = true; return; }   // the card's scroll, not a ride
    if (spent) return;
    acc += e.deltaY;
    if (Math.abs(acc) > 24) { step(Math.sign(acc)); spent = true; }
  }, { passive: true });

  let touchY = null;
  addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
  addEventListener('touchend', (e) => {
    if (touchY === null || !roomy.matches) return;
    const dy = touchY - e.changedTouches[0].clientY;
    touchY = null;
    if (Math.abs(dy) > 40 && !scrollsInside(e.target, Math.sign(dy))) step(Math.sign(dy));
  }, { passive: true });

  addEventListener('keydown', (e) => {
    if (!roomy.matches || e.target.closest?.('input, textarea, select, [contenteditable]')) return;
    if (open) {   // the panel scrolls with the keys, and Tab goes round inside it until it is closed (#37)
      if (e.key === 'Escape') closePanel();
      if (e.key === 'Tab') {
        const ring = [...open.panel.querySelectorAll('a[href], button:not([hidden])')], a = document.activeElement;
        const [first, last] = e.shiftKey ? [ring.at(-1), ring[0]] : [ring[0], ring.at(-1)];
        if (a === last || !open.panel.contains(a) || (e.shiftKey && a === open.panel)) { e.preventDefault(); first?.focus(); }
      }
      return;
    }
    // The lift's floors are links, for the plain page, but here they press like the buttons they look like.
    if (e.key === ' ' && e.target.closest?.('.building-floor-btn')) { e.preventDefault(); e.target.click(); return; }
    if (e.key === ' ' && e.target.closest?.('button, a, [role=button], summary')) return;   // Space presses the control
    const next = { ArrowDown: 1, PageDown: 1, ' ': e.shiftKey ? -1 : 1, ArrowUp: -1, PageUp: -1 }[e.key];
    if (next && !scrollsInside(document.activeElement, next)) {   // a long card scrolls first, as with the wheel
      e.preventDefault();
      if (!(e.repeat && api.moving())) step(next);   // a held key rides floor by floor
    }
    if (e.key === 'Home') { e.preventDefault(); api.go(keys.indexOf(path[0])); }
    if (e.key === 'End') { e.preventDefault(); api.go(keys.indexOf(path.at(-1))); }
  });

  root.addEventListener('click', (e) => {   // elevator buttons, the name (back to the street) and the windows
    if (!roomy.matches) return;   // the plain page: links are links
    if (e.target.closest?.('.skip-link')) {   // the current floor, not the page top the link points at without JS
      e.preventDefault();
      (open?.panel ?? document.getElementById(`f${keys[api.index()]}`))?.focus();
      return;
    }
    const inside = e.target.closest?.('.step-in');
    if (inside) {   // only on the floor the lift stands at: the departing card is still clickable as it fades
      if (!api.moving() && inside.closest('.is-here')) openPanel(inside);
      return;
    }
    if (e.target.closest?.('.panel-back')) { closePanel(); return; }
    const b = e.target.closest?.('[data-goto]');
    if (!b) return;
    e.preventDefault();
    api.go(keys.indexOf(b.dataset.goto));
  });

  const show = (index) => stops.forEach((s, i) => s.classList.toggle('is-here', i === index));
  document.addEventListener('building:floor', (e) => {
    if (indicator) indicator.textContent = e.detail.key === 'E' ? '' : e.detail.key;   // outside, the lift shows no floor
  });
  const hint = root.querySelector('.building-hint');
  // After a ride, focus follows the reader to the new floor's heading, unless it is on the lift or the top bar.
  // null until the first ride: the load's own arrival neither moves focus nor speaks.
  let follow = null, hinted = false, leaving = null;
  const reached = new Set();   // floors counted in GoatCounter this visit: once each, rides past them are not visits
  document.addEventListener('building:depart', (e) => {
    const a = document.activeElement;
    follow = !a || a === document.body || !!a.closest('.building-stop, .exterior-windows');
    // A card under an open panel leaves hidden: un-hidden, it would flash at full opacity while it fades out.
    if (open) (leaving = open.button.closest('.floor-card')).style.visibility = 'hidden';
    closePanel(false);
    show(-1);
    stops[e.detail.index].hidden = false;   // before is-here lands, so its card fades in
    document.documentElement.classList.remove('at-street');
    if (hint) hint.style.opacity = '0';
    if (arrow) arrow.dataset.dir = e.detail.dir > 0 ? 'down' : e.detail.dir < 0 ? 'up' : '';   // a dissolve has no direction
    buttons.forEach((b) => b.setAttribute('aria-current', String(b.dataset.goto === e.detail.key)));
  });
  document.addEventListener('building:arrive', (e) => {
    leaving?.style.removeProperty('visibility');
    leaving = null;
    show(e.detail.index);
    conceal(e.detail.index);
    if (open && !stops[e.detail.index]?.contains(open.panel)) closePanel(false);
    document.documentElement.classList.toggle('at-street', e.detail.key === 'E');
    if (arrow) arrow.dataset.dir = '';   // standing still: no arrow, like a real lift display
    if (hint && !hinted && e.detail.key !== 'E') { hinted = true; hint.style.opacity = ''; }   // once, on the first floor inside
    if (follow !== null) {
      if (follow) document.getElementById(`f${e.detail.key}`)?.focus({ preventScroll: true });
      const label = buttons.find((b) => b.dataset.goto === e.detail.key)?.getAttribute('aria-label') ?? 'Street, outside the building';
      if (status) status.textContent = label.replace(', ', ': ');
      if (!reached.has(e.detail.key)) { reached.add(e.detail.key); count(`floor-${e.detail.key}`); }
      follow = null;
    }
    buttons.forEach((b) => b.setAttribute('aria-current', String(b.dataset.goto === e.detail.key)));
    if (sought >= 0) setTimeout(api.go, 0, sought);   // after this frame, which is still drawing the ride that just ended
    sought = -1;
  });
}

// A GoatCounter event (CLAUDE.md, Analytics). count.js loads async, may be blocked, and a page can set
// window.goatcounter before it does, so the call may find nothing to call.
const count = (path) => window.goatcounter?.count?.({ path, event: true });

// A long card on a small screen scrolls first; the lift only moves once it is at its end.
function scrollsInside(target, dir) {
  const box = target.closest?.('.floor-card, .floor-panel');
  // A sliver of overflow (12 to 21px on some cards) is not worth a key press that barely moves anything (#131), except
  // on the hero, where what it hides is the way to get in touch.
  if (!box || box.scrollHeight <= box.clientHeight + (box.matches('.floor-card--hero') ? 0 : 40)) return false;
  return dir > 0 ? box.scrollTop + box.clientHeight < box.scrollHeight - 1 : box.scrollTop > 0;
}
