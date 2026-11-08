// Right after the lobby's storey (layouts/index.html, which writes LOBBY_HASH, its $lobbyHash, in): the lobby is where
// the lift starts, so its card is there at the first paint, unless the address names another floor; and the pause,
// wherever the tower moves.
LOBBY_HASH.test(location.hash) || document.currentScript.previousElementSibling.classList.remove('is-here');   // eslint-disable-line no-undef
document.documentElement.classList.contains('building--guided') && !matchMedia('(prefers-reduced-motion: reduce)').matches && (document.querySelector('[data-building-pause]').hidden = false);
