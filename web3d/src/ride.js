// The tower's lift (pixel.js): where the cab is, in stops (the page's floors, top to bottom), u of the way through a ride,
// and the ride a new stop asks for. Kept apart from the drawing, so a test can run it. A ride is
// { from, to, start, dur, v, land, settle, sink, fh, last }: fh is a storey's height in art pixels, last the bottom stop's index.
// v: the speed carried over from a ride retargeted mid-way (floors per unit of u), so the cab never stops dead.
// land, settle: it reaches its stop still moving, by that much, and spends the ride's last settle ms sinking past it and back.
export const OVER = 4, SETTLE = 260;   // the cab sinks on past its stop, in art pixels, and comes back, in ms

export const rideU = (ride, now) => (ride.dur ? Math.min(1, Math.max(0, (now - ride.start) / ride.dur)) : 1);
// A cubic Hermite (smoothstep plus any carried speed's term), which lands without overshooting and, without a cubic ease's
// peak of 3x the mean, without strobing: past about 50 CSS px a frame the eye sees separate pictures, not motion. The
// land term is its other end's tangent, the speed the settle starts at.
export const pos = (ride, u) => {
  const m = ride.settle ? Math.min(1, u * ride.dur / (ride.dur - ride.settle)) : u;
  return ride.from + (ride.to - ride.from) * m * m * (3 - 2 * m) + ride.v * m * (1 - m) ** 2 + ride.land * m * m * (m - 1);
};
// How far past its stop the cab has sunk, in art pixels.
export const sunk = (ride, u) => { const t = ride.settle ? 1 - (1 - u) * ride.dur / ride.settle : 0; return t > 0 ? ride.sink * Math.sin(Math.PI * t) : 0; };
// Where the camera is, settle included, for a ride to start from.
// shortcut: past the roof or the lobby there is no next storey to measure that against, so a ride asked for in that settle starts from the stop, up to OVER art pixels away; carry the offset separately if that ever shows.
export const cab = (ride, u) => { const past = pos(ride, u) - sunk(ride, u) / ride.fh; return past >= 0 && past <= ride.last ? past : pos(ride, u); };
// Where the cab is at `now`, and how fast it is going there, in floors per ms.
export const motion = (ride, now) => {
  const u = rideU(ride, now), here = cab(ride, u);
  return [here, u < 1 ? (here - cab(ride, rideU(ride, now - 16))) / 16 : 0];
};

// The ride to stop `to` from wherever the cab is at `now`, carrying its speed on, once the doors have shut (closeMs).
// still: no motion (it just goes there); paused: no settle. rise: +1 when the stop is higher up the tower than the cab, -1
// lower, which way it sinks on past it.
export function plan(ride, now, to, { closeMs, still, paused, rise }) {
  const [here, vel] = motion(ride, now);
  const dist = Math.abs(to - here), dur = Math.min(1600, 650 + 230 * Math.max(0, dist - 1));
  // The eased start moves the camera less than half an art pixel at first: that stretch runs as the doors finish.
  const hidden = vel ? 0 : dur * Math.sqrt(1 / (2160 * Math.max(dist, 1e-3)));
  const settle = still || paused ? 0 : SETTLE;
  return {
    from: here, to, start: now + Math.max(0, closeMs - hidden), dur: still ? 1 : dur + settle, v: still ? 0 : vel * dur, settle,
    land: settle ? Math.sign(to - here) * (OVER / ride.fh) * (Math.PI / settle) * dur : 0, sink: OVER * rise,
  };
}
