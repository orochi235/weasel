// Register A, geometry computed. Every arrowhead vertex sits exactly on the
// terminus of the stroke it caps.
//
// Arc terminus rule: `M x y A rx ry rot laf sf dx dy` ends at (x+dx, y+dy).
// Chevron rule: barbs = tip + L * rot(±spread, -travelDirection).
//
// Hairline (stroke-width 1) marks STRUCTURE only — a slide's label rules, a
// tray's fill line. Never decoration: a tick added to `reset` for flavor
// turned the glyph into the IEC power symbol.

export const R = (deg) => (deg * Math.PI) / 180;

/** The center of pixel `k` of a glyph drawn at 16px 1x: an odd multiple of 0.625. A stroke centered on one
 *  fills its column, where one on a whole unit smears across two half-gray ones. */
export const px = (k) => 0.625 + 1.25 * k;

/** `chevron`'s length and spread for a straight arrow drawn on `px` centers: its barbs end two whole pixels
 *  back from the tip and two either side, at 45 degrees. At 36 to 42 they sit off the grid and close up into a
 *  dot at 1x. */
export const GRID_HEAD = [2.5 * Math.SQRT2, 45];
export const n = (v) => Math.round(v * 100) / 100;

/** Open-V arrowhead whose vertex is exactly `tip`, trailing back along `dir`.
 *  Barb endpoints are 2*L*sin(spread) apart; if that is not comfortably wider
 *  than the stroke, the round joins merge and the V renders as a solid
 *  triangle — which reads wrong in an outlined register and is invisible at
 *  chrome size. Guard rather than eyeball it. */
export const STROKE = 1.5;
const MIN_NOTCH = 1.6;

export function chevron(tip, dir, L = 2.8, spread = 32) {
  const sep = 2 * L * Math.sin(R(spread));
  if (sep - STROKE < MIN_NOTCH) {
    throw new Error(
      `chevron: barbs ${n(sep)} apart leaves a ${n(sep - STROKE)} notch (need ${MIN_NOTCH}). ` +
        `Raise L (${L}) or spread (${spread}°).`,
    );
  }
  const m = Math.hypot(dir[0], dir[1]);
  const b = [-dir[0] / m, -dir[1] / m];
  const rot = (a) => [
    b[0] * Math.cos(R(a)) - b[1] * Math.sin(R(a)),
    b[0] * Math.sin(R(a)) + b[1] * Math.cos(R(a)),
  ];
  const p = (v) => [n(tip[0] + L * v[0]), n(tip[1] + L * v[1])];
  const [x1, y1] = p(rot(spread));
  const [x2, y2] = p(rot(-spread));
  return `M${x1} ${y1} ${n(tip[0])} ${n(tip[1])} ${x2} ${y2}`;
}

/** An open-V head on a shaft that stays curved to its tip, as path data. `curve(t)` is a point on the shaft,
 *  the tip is at `t1`, and stepping `t` by `dt` walks back along the shaft from it. The barb ends stand on the
 *  shaft's own normal, one trail of arc behind the tip and `L·sin(spread)` either side; aimed along the tangent
 *  instead, a head points off the bend and reads as a mark of its own. Holds down to a bend radius of about
 *  1.2·L, past which the inner barb fills the bend. */
export function chevronOn(curve, t1, dt, L = 2.9, spread = 42) {
  const trail = L * Math.cos(R(spread));
  const half = L * Math.sin(R(spread));
  let t = t1;
  let len = 0;
  let p = curve(t1);
  while (len < trail) {
    const q = curve(t + dt);
    len += Math.hypot(q[0] - p[0], q[1] - p[1]);
    p = q;
    t += dt;
  }
  const a = curve(t - dt);
  const b = curve(t + dt);
  const m = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const nx = -(b[1] - a[1]) / m;
  const ny = (b[0] - a[0]) / m;
  const tip = curve(t1);
  return [[p[0] + nx * half, p[1] + ny * half], tip, [p[0] - nx * half, p[1] - ny * half]];
}

/** Point on a circle at math-angle `deg` (SVG y-down). */
export const onCircle = (cx, cy, r, deg) => [
  n(cx + r * Math.cos(R(deg))),
  n(cy - r * Math.sin(R(deg))),
];

/** The tray `export` drops into and `import` lifts out of, with its fill line. */
export const TRAY = `<path d="M3.125 12.6v2.775a1.5 1.5 0 0 0 1.5 1.5h9.5a1.5 1.5 0 0 0 1.5-1.5V12.6"/><path d="M5.625 14.375h7.5" stroke-width="1"/>`;
