// The top bar's Menu is a non-modal popover (layouts/partials/pixel-bar.html). One file for every page: the homepage
// bundle imports it (web3d/src/pixel.js), the partial loads it elsewhere.
const menu = document.querySelector('[popover]');
// hidePopover first, as matches(':popover-open') throws without the Popover API.
const isOpen = () => menu?.hidePopover && menu.matches(':popover-open');

// Tab past its last link shuts it, so focus never sits on a control under the panel.
menu?.addEventListener('focusout', (e) => {
  const to = e.relatedTarget;
  if (isOpen() && to && !menu.contains(to) && !to.closest('[popovertarget]')) menu.hidePopover();
});

// A tap outside only shuts it. iOS aims the click after the popover has gone, so the CSS scrim cannot catch it: decide
// when the finger lands, while it is still open, and spend that on the click. A swipe sends no click, only a cancel.
let swallow = false;
addEventListener('pointerdown', (e) => { swallow = isOpen() && !menu.contains(e.target) && !e.target.closest('[popovertarget]'); }, true);
addEventListener('pointercancel', () => { swallow = false; }, true);
addEventListener('click', (e) => {
  if (!swallow) return;
  swallow = false;
  e.preventDefault();
  e.stopPropagation();
}, true);

// Back from the bfcache must not bring the page back with the menu open.
addEventListener('pagehide', () => { if (isOpen()) menu.hidePopover(); });
