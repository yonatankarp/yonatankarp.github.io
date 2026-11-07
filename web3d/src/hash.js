// The floor an address names, for pixel.js. No DOM and no bundled JSON, so scripts/test can import it as it is.
// The old one-page site's anchors, still linked from elsewhere, land on the floor that took their place (#29); the
// closed newsroom's (floor 8) and the street's (E), which the city replaced as the way in, on the lobby. The garage's
// (#floor-P, #client-and-work-section) go to /projects/ before this runs (layouts/index.html).
export const LEGACY = { about: 'L', testimonial: 'L', contact: 'R', experience: '7', proof: '7', 'floor-8': 'L', 'floor-e': 'L' };

// '#floor-5', '#FLOOR-l' (Hugo lowercases menu URLs, so the site menu's About arrives as #floor-l) or a legacy anchor:
// the floor's key. Any other hash: undefined.
// floors: the building's own (art.js ORDER), of which one that exists again (a new floor 8) wins over its old anchor.
export function floorKey(hash, floors = []) {
  const h = hash.replace(/^#/, '').toLowerCase(), own = h.match(/^floor-(\w+)$/)?.[1].toUpperCase();
  return floors.includes(own) ? own : LEGACY[h] ?? own;
}

// A hash in the floors' form, known or not, or a legacy anchor: the tower's, which the pre-paint test in layouts/index.html
// ($floorHash, kept in step by scripts/test/building-hash.test.js) enters too. One the lift cannot place is never dropped
// (pixel.js, #63): on load it opens the lobby, later it keeps the lift where it is, and the address then names that floor.
// Others, such as #toggle-goatcounter or the plain page's skip link, are left alone.
export const floorShaped = (hash) => /^#floor-/i.test(hash) || Object.hasOwn(LEGACY, hash.slice(1).toLowerCase());
