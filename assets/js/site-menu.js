// The top bar's Menu is a non-modal popover (layouts/partials/pixel-bar.html): Tab past its last link shuts it, so focus
// never sits on a control under the panel. One file for every page: the homepage bundle imports it (web3d/src/pixel.js),
// the partial loads it elsewhere. hidePopover first, as matches(':popover-open') throws without the Popover API.
const menu = document.querySelector('[popover]');
menu?.addEventListener('focusout', (e) => {
  const to = e.relatedTarget;
  if (menu.hidePopover && menu.matches(':popover-open') && to && !menu.contains(to) && !to.closest('[popovertarget]')) menu.hidePopover();
});
