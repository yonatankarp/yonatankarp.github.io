// The homepage's first script, before its stylesheet (layouts/index.html, which writes PROJECTS, the projects' page, and
// FLOOR_HASH, its $floorHash, in for them): the city (at-city) wherever the address names no floor and a module can
// run; a floor's address guided from the first paint (#39), the query guide.js's roomy; without a module, the plain
// page. The old garage's addresses go first, to the projects' own page, at the same query: the tower has no garage now.
// The error listener replaces the module tag's onerror attribute, which the CSP would block: capture phase, as a
// script's error event does not bubble, and registered before the tag, so no failure comes too early for it.
if (/^#(floor-p|client-and-work-section)$/i.test(location.hash)) location.replace(PROJECTS + location.search);   // eslint-disable-line no-undef
addEventListener('error', function (e) { if (e.target.type === 'module') { document.documentElement.classList.remove('building--guided', 'at-city'); document.querySelector('[data-building-pause]').hidden = true; } }, true);
addEventListener('pagereveal', function (e) { if (e.viewTransition) { document.documentElement.classList.add('px-arrive'); document.dispatchEvent(new Event('building:reveal')); } });
var modular = 'noModule' in HTMLScriptElement.prototype, floor = FLOOR_HASH.test(location.hash);   // eslint-disable-line no-undef
if (modular && !floor) document.documentElement.classList.add('at-city');
if (modular && floor && matchMedia('(min-height: 500px) and (min-width: 360px)').matches) document.documentElement.classList.add('building--guided');
