// The blog's Library (layouts/blog/list.html): a reading room that pans sideways to the shelf picked from a chip or a
// label, whose posts the panel lists, as the city does (pan.js). Without it every shelf's list shows (library.css).
import { panning } from './pan.js';
import './city.css';
import './library.css';

const library = document.querySelector('[data-library]');
if (library) {
  const panel = library.querySelector('.city-panel');
  panning(library, 'all', () => getComputedStyle(panel).position === 'absolute')(false);
}
