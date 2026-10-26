// Stroke markers: a line arriving from the left and the marker on its end, drawn from the shapes in
// `packages/stroke/src/strokeMarkerShapes.ts` at the icon's own stroke width. A marker is authored in units of
// the line's width, so one unit here is 1.5, and a crow's foot's outline (one unit) is exactly the icon stroke.
// The line stops at the marker's `inset`, as the ribbon does, so nothing shows through a hollow head. The heads
// are drawn at `HEAD` units instead: at 1.5 an arrow, a diamond, a circle and a square were each a three-pixel
// blot at 16px, and told apart only at 2x. The crow's feet are long enough to keep the true scale.

const n = (v) => Math.round(v * 1e4) / 1e4;
const U = 1.5;
const HEAD = 2;
const ANCHOR = 17.5;
/** Where the line starts: butt-capped so it can stop square on a head's back edge, and reaching as far as a
 *  round cap from 2.5 would. */
const START = 1.75;
/** A pixel center at 16px 1x, so the line is one crisp row there. */
const Y = 10.625;

/** Drawing helpers with one marker unit at `u` glyph units: points given in marker units, +X toward the anchor. */
const units = (u) => {
  const pt = (x, y) => `${n(ANCHOR + x * u)} ${n(Y + y * u)}`;
  const poly = (pts, close = true) => {
    let d = '';
    for (let i = 0; i < pts.length; i += 2) d += `${i === 0 ? 'M' : 'L'}${pt(pts[i], pts[i + 1])}`;
    return close ? `${d}Z` : d;
  };
  const r = (k) => n(k * u);
  const circle = (cx, k) => `M${pt(cx - k, 0)}A${r(k)} ${r(k)} 0 1 0 ${pt(cx + k, 0)}A${r(k)} ${r(k)} 0 1 0 ${pt(cx - k, 0)}Z`;
  const line = (inset) => `<path d="M${START} ${Y}H${n(ANCHOR - inset * u)}" stroke-linecap="butt"/>`;
  return { poly, circle, line };
};
const { poly, circle, line } = units(U);
const H = units(HEAD);

const solid = (d) => `<path d="${d}" fill="currentColor" stroke="none"/>`;
/** A hollow head's outline is half a unit on the canvas, which is 0.6px at 16px; drawn at 1 it still reads hollow. */
const hollow = (d) => `<path d="${d}" stroke-width="1" stroke-linejoin="miter"/>`;
const open = (d) => `<path d="${d}"/>`;

const crowBar = (x) => poly([x, -2, x, 2], false);
const CROW_FOOT = poly([-4, 0, 0, -2.5], false) + poly([-4, 0, 0, 2.5], false);
const crowZero = (cx) => circle(cx, 2);

export const MARKER = {
  'marker-none': line(0),
  'marker-arrow': H.line(3) + solid(H.poly([0, 0, -3, -1.5, -3, 1.5])),
  'marker-arrow-open': H.line(0) + open(H.poly([-2.867, -2.007, 0, 0, -2.867, 2.007], false)),
  // Its line runs on to the notch, where the ribbon stops at the barbs and leaves the notch empty.
  'marker-arrow-concave': H.line(2) + solid(H.poly([0, 0, -3, -1.5, -2, 0, -3, 1.5])),
  'marker-triangle-hollow': H.line(4) + hollow(H.poly([0, 0, -4, -2, -4, 2])),
  'marker-diamond': H.line(4) + solid(H.poly([0, 0, -2, -1.2, -4, 0, -2, 1.2])),
  'marker-diamond-hollow': H.line(4) + hollow(H.poly([0, 0, -2, -1.2, -4, 0, -2, 1.2])),
  'marker-circle': H.line(2) + solid(H.circle(-1, 1)),
  'marker-square': H.line(2) + solid(H.poly([0, -1, 0, 1, -2, 1, -2, -1])),
  'marker-bar': H.line(0) + open(H.poly([0, -1.5, 0, 1.5], false)),
  // `dot` is centered on its anchor, for a line's interior vertices, so it sits mid-line.
  'marker-dot': line(0) +
    `<circle cx="10" cy="${Y}" r="${n(1.2 * HEAD)}" fill="currentColor" stroke="none"/>`,
  'marker-crow-one': line(0) + open(crowBar(-2) + crowBar(-4)),
  'marker-crow-many': line(0) + open(CROW_FOOT),
  'marker-crow-zero-one': line(7.5) + open(crowBar(-2) + crowZero(-5.5) + poly([-3.5, 0, 0, 0], false)),
  'marker-crow-one-many': line(0) + open(CROW_FOOT + crowBar(-5.5)),
  'marker-crow-zero-many': line(9.5) + open(CROW_FOOT + crowZero(-7.5) + poly([-5.5, 0, 0, 0], false)),
};
