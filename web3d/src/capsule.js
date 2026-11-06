// Floor 7's payment (gen_floors.CAPSULE in floors.json): where its capsule is, t ms into the room's loop, as [x, y, angle] in
// strip pixels, or null when it is not riding. Kept apart from its drawing (pixel.js), so a test can run it.
export const ease = (u) => (u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2);   // in and out

export function capsuleAt({ path, bend, ride, hold }, t) {
  if (!(t >= 0 && t < ride + hold)) return null;
  const legs = path.slice(1).map((b, i) => {
    const a = path[i];
    return { a, b, len: Math.hypot(b[0] - a[0], b[1] - a[1]), ang: Math.atan2(b[1] - a[1], b[0] - a[0]) };
  });
  let d = legs.reduce((sum, l) => sum + l.len, 0) * ease(Math.min(1, t / ride));
  for (let k = 0; k < legs.length; k++) {
    const l = legs[k];
    if (d <= l.len || k === legs.length - 1) {
      const f = Math.min(1, d / l.len);
      // turned over each bend, not snapped: at the corner it is halfway between the two legs' angles
      let ang = l.ang;
      if (k + 1 < legs.length && l.len - d < bend) ang += (legs[k + 1].ang - ang) * (1 - (l.len - d) / bend) / 2;
      if (k > 0 && d < bend) ang += (legs[k - 1].ang - ang) * (1 - d / bend) / 2;
      return [l.a[0] + (l.b[0] - l.a[0]) * f, l.a[1] + (l.b[1] - l.a[1]) * f, ang];
    }
    d -= l.len;
  }
  return null;
}
