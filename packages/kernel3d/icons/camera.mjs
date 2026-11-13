import { chevron, chevronOn, GRID_HEAD, px } from '../../icons/scripts/lib/base.mjs';

const rad = (deg) => (deg * Math.PI) / 180;

// ── turn / pitch ─────────────────────────────────────────────────────────
// A ring around an axis, drawn as it lies in space: it passes behind the axis at the back and in front of it
// at the front. Whatever passes behind is cut by what passes in front, `GAP` clear of it measured along the
// stroke being cut, the same at every point across it.
//
// The ring is a four-arc oval rather than an ellipse, because the edges of a stroked circular arc are arcs
// about the same center, and an arc slid along the axis is still an arc: so the cut in the axis is the ring's
// own edge moved by `GAP`, exactly. An ellipse's edges are no conic, and nothing in path data can follow them.
//
// The head rides the ring, hung on its normal so it turns with the bend (`chevronOn`). `flip` mirrors the
// drawing left to right, and `swap` exchanges x and y, which lays the turn's vertical axis on its side.
/** The axis, right of center: the head gets the room, and the axis's ink lands on whole pixels at 16px. */
const AXIS = 10.75;
const MID = 10;
/** The oval's half-width and half-height. The half-height puts its back and front runs on whole pixels at 16px. */
const RX = 6;
const RY = 3.25;
/** The radius at the oval's ends; the radius across its front and back follows from it, so the arcs meet tangent. */
const END_R = 2.5;
const SIDE_R = (RY * RY + (RX - END_R) ** 2 - END_R * END_R) / (2 * (RY - END_R));
const STROKE = 1.5;
/** Clear space between a cut end and the ink in front of it. At 1.25 the band under the ring's front closes
 *  up at 16px, where the ring's lower edge falls mid-pixel. */
const GAP = 1.5;
const HALF = STROKE / 2;
const CUT = HALF + GAP;
const FRONT = MID + RY;
/** Coordinates to four places: the cuts are measured against the ring, and a hundredth is a visible error. */
const q = (v) => Math.round(v * 1e4) / 1e4;

// The oval as four arcs, clockwise on screen from its right end: the right end, the front, the left end, the
// back. Each is { c, r, from, to } in screen degrees, and `ALPHA` is where an end arc hands over to a side arc.
const FRONT_C = [AXIS, FRONT - SIDE_R];
const BACK_C = [AXIS, MID - RY + SIDE_R];
const RIGHT_C = [AXIS + RX - END_R, MID];
const LEFT_C = [AXIS - RX + END_R, MID];
const ALPHA = (Math.atan2(RIGHT_C[1] - FRONT_C[1], RIGHT_C[0] - FRONT_C[0]) * 180) / Math.PI;
const ARCS = [
  { c: RIGHT_C, r: END_R, from: 0, to: ALPHA },
  { c: FRONT_C, r: SIDE_R, from: ALPHA, to: 180 - ALPHA },
  { c: LEFT_C, r: END_R, from: 180 - ALPHA, to: 180 + ALPHA },
  { c: BACK_C, r: SIDE_R, from: 180 + ALPHA, to: 360 - ALPHA },
  { c: RIGHT_C, r: END_R, from: 360 - ALPHA, to: 360 },
].map((a) => ({ ...a, length: (a.r * (a.to - a.from) * Math.PI) / 180 }));
const OVAL = ARCS.reduce((sum, a) => sum + a.length, 0);
const onCircle = ({ c, r }, deg) => [c[0] + r * Math.cos(rad(deg)), c[1] + r * Math.sin(rad(deg))];
/** The arc a distance `s` round the oval falls on, and the screen angle there. */
function locate(s) {
  let left = ((s % OVAL) + OVAL) % OVAL;
  for (const a of ARCS) {
    if (left <= a.length) return { arc: a, deg: a.from + (left / a.length) * (a.to - a.from) };
    left -= a.length;
  }
  return { arc: ARCS[ARCS.length - 1], deg: 360 };
}
const oval = (s) => {
  const { arc, deg } = locate(s);
  return onCircle(arc, deg);
};
const startOf = (i) => ARCS.slice(0, i).reduce((sum, a) => sum + a.length, 0);
/** The head's tip, on the front arc short of the left end, where the bend is wide enough to hang it on; and
 *  where the ring's far-left arc starts, a little way round the left end. The gap between them says the ring is open. */
const TIP = startOf(2) - 0.2;
const TAIL = startOf(3) - 0.6;
const BACK_TOP = startOf(3) + ARCS[3].length / 2;

// The axis's cut ends: the ring's inner edge slid back along the axis by `GAP`, and its outer edge slid on.
const AXIS_L = AXIS - HALF;
const AXIS_R = AXIS + HALF;
// The upper end is bent 2.5 times as far as the ring's edge beneath it, its middle kept `GAP` clear. Bent
// exactly as far, it measures parallel and reads flatter: the eye takes the ring's curvature from the long
// run of its edge past the axis's corners, which the short end has no share of.
const OPTICAL = 2.5;
const UPPER_MID = FRONT - HALF - GAP;
const UPPER_SAG = OPTICAL * (SIDE_R - HALF - Math.sqrt((SIDE_R - HALF) ** 2 - HALF * HALF));
const UPPER_R = (HALF * HALF + UPPER_SAG * UPPER_SAG) / (2 * UPPER_SAG);
const ABOVE = { c: [AXIS, UPPER_MID - UPPER_R], r: UPPER_R };
const BELOW = { c: [AXIS, FRONT_C[1] + GAP], r: SIDE_R + HALF };
const yOn = ({ c, r }, x) => c[1] + Math.sqrt(r * r - (x - c[0]) ** 2);

function turn(flip, swap) {
  const xy = ([x, y]) => {
    const fx = flip ? 20 - x : x;
    return swap ? [q(y), q(fx)] : [q(fx), q(y)];
  };
  const at = (p) => xy(p).join(' ');
  // Clockwise on screen as drawn, and each reflection reverses it.
  const cw = flip === swap ? 1 : 0;
  const ccw = 1 - cw;
  /** Path data along the oval from `s0` round to `s1`, an arc command for each piece of each arc it crosses. */
  const along = (s0, s1) => {
    let d = `M${at(oval(s0))}`;
    let s = s0;
    while (s1 - s > 1e-9) {
      const { arc } = locate(s + 1e-9);
      const start = ARCS.slice(0, ARCS.indexOf(arc)).reduce((sum, a) => sum + a.length, 0);
      const end = Math.min(s1, (Math.floor(s / OVAL) * OVAL) + start + arc.length);
      const r = q(arc.r);
      d += `A${r} ${r} 0 0 ${cw} ${at(oval(end))}`;
      s = end;
    }
    return d;
  };
  // Everything in `body` between `x0` and `x1`: a nested viewport clips to its own box. The axis is straight,
  // so its outline grown by `GAP` is two straight lines, and that is the cut.
  const between = (x0, x1, body) => {
    const [ax, ay] = xy([x0, 0]);
    const [bx, by] = xy([x1, 20]);
    const [x, y, w, h] = [Math.min(ax, bx), Math.min(ay, by), q(Math.abs(bx - ax)), q(Math.abs(by - ay))];
    return `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}">${body}</svg>`;
  };
  const above = [yOn(ABOVE, AXIS_L), yOn(ABOVE, AXIS_R)];
  const below = [yOn(BELOW, AXIS_L), yOn(BELOW, AXIS_R)];
  // The axis is filled rather than stroked, so its cut ends can take the ring's shape; its far ends stay round.
  const axis =
    `M${at([AXIS_L, above[0]])}L${at([AXIS_L, 2.8])}A${HALF} ${HALF} 0 0 ${cw} ${at([AXIS_R, 2.8])}` +
    `L${at([AXIS_R, above[1]])}A${q(ABOVE.r)} ${q(ABOVE.r)} 0 0 ${cw} ${at([AXIS_L, above[0]])}Z` +
    `M${at([AXIS_L, below[0]])}A${q(BELOW.r)} ${q(BELOW.r)} 0 0 ${ccw} ${at([AXIS_R, below[1]])}` +
    `L${at([AXIS_R, 17.2])}A${HALF} ${HALF} 0 0 ${cw} ${at([AXIS_L, 17.2])}Z`;
  return (
    `<path d="${axis}" fill="currentColor" stroke="none"/>` +
    // Each back arc is drawn on past the cut, and the viewport takes off what is behind the axis.
    between(0, AXIS - CUT, `<path d="${along(TAIL, BACK_TOP)}"/>`) +
    between(AXIS + CUT, 20, `<path d="${along(BACK_TOP, OVAL)}"/>`) +
    `<path d="${along(0, TIP)}"/>` +
    `<path d="M${chevronOn(oval, TIP, -0.01).map(at).join(' ')}"/>`
  );
}

// ── dolly ────────────────────────────────────────────────────────────────
// A floor running back to the horizon, and an arrow along it. The arrow runs down pixel 7, and the floor's
// edges sit on pixels 2 and 12 about it.
const floor = `<path d="M6.375 ${px(2)}h6l3.6 12.5H2.775Z"/>`;
const upright = (from, tip) =>
  `<path d="M${px(7)} ${px(from)}V${px(tip)}"/><path d="${chevron([px(7), px(tip)], [0, Math.sign(tip - from)], ...GRID_HEAD)}"/>`;

// ── orbit ────────────────────────────────────────────────────────────────
// A level ring round a body, open on its lower right. It sweeps up the right side, over the back and down the
// left, then leaves the ring at the front's center on a straight run to a head pointing right. Every run and
// the head sit on 16px 1x pixel centers (`px(k)` is the center of pixel k); the earlier tilted ring with its
// head on the bend closed up into a dot there.
const n = (v) => Math.round(v * 1e4) / 1e4;
const RING = { left: px(1), right: px(14), top: px(4), bottom: px(12) };
const ORBIT_START_X = 17.6;
const orbit = (() => {
  const cx = (RING.left + RING.right) / 2;
  const cy = (RING.top + RING.bottom) / 2;
  const rx = (RING.right - RING.left) / 2;
  const ry = (RING.bottom - RING.top) / 2;
  const startY = cy + ry * Math.sqrt(1 - ((ORBIT_START_X - cx) / rx) ** 2);
  const tip = [px(11), RING.bottom];
  return (
    `<path d="M${n(ORBIT_START_X)} ${n(startY)}A${n(rx)} ${n(ry)} 0 1 0 ${n(cx)} ${n(RING.bottom)}H${tip[0]}"/>` +
    `<path d="${chevron(tip, [1, 0], ...GRID_HEAD)}"/>`
  );
})();

// ── rise / sink ──────────────────────────────────────────────────────────
const ground = `<path d="M${px(2)} ${px(12)}H${px(12)}"/>`;

export const CAMERA = {
  dollyIn: floor + upright(10, 5),
  dollyOut: floor + upright(5, 10),
  turnLeft: turn(false, false),
  turnRight: turn(true, false),
  pitchUp: turn(false, true),
  pitchDown: turn(true, true),
  rise: ground + upright(10, 2),
  sink: ground + upright(2, 10),
  orbit: `${orbit}<circle cx="10" cy="10" r="1.75" fill="currentColor" stroke="none"/>`,
  home: `
    <path d="M3.4 9.8 10 3.8l6.6 6"/>
    <path d="M5.4 8.6v6.6a1 1 0 0 0 1 1h7.2a1 1 0 0 0 1-1V8.6"/>
    <path d="M8.6 16.2v-4h2.8v4"/>`,
};
