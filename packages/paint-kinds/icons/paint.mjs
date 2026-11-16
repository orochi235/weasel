// The paint kinds as swatches, and the two paint states beside them: none, and inherited.

import { filledPath } from '../../icons/scripts/lib/emit.mjs';

const n = (v) => Math.round(v * 100) / 100;

// ── paint kind ───────────────────────────────────────────────────────────
// The five members of the paint union, as swatches. A monochrome glyph
// cannot show a real ramp, so the three gradients state theirs as graduated
// ink — the same four steps in three geometries, which is what makes them
// read as a set rather than as three unrelated pictures.
const BOX = 3.4;
const BOX_END = 16.6;
const RAMP = [1, 0.68, 0.42, 0.2];

const step = (d, op) => `<path d="${d}" fill="currentColor" stroke="none" fill-opacity="${op}"/>`;

// Four vertical bands, edge to edge with no seam between them.
const linearBands = RAMP.map((op, i) => {
  const w = (BOX_END - BOX) / RAMP.length;
  const x = n(BOX + i * w);
  return step(`M${x} ${BOX}H${n(x + w)}V${BOX_END}H${x}Z`, op);
}).join('');

// Concentric squares, not discs: every other kind in the bar is a square
// swatch, and a lone circle reads as a different sort of thing rather than
// as this set's radial member.
//
// Drawn as even-odd RINGS rather than nested filled boxes. Nesting only
// works while the ramp darkens inward — an outward-darkening one puts an
// opaque box under the translucent ones and every inner step composites
// against it instead of against the page.
const box = (h) => `M${n(10 - h)} ${n(10 - h)}H${n(10 + h)}V${n(10 + h)}H${n(10 - h)}Z`;
const RADII = [6.6, 5.05, 3.5, 1.95];
// Its own ramp, not the shared one. Four nested rings put four edges in a
// box the others fill with one or two, so at the shared ramp's levels it
// reads brighter than its neighbours at the same nominal opacity — the whole
// scale is stepped down to sit with them.
const RADIAL_RAMP = [0.7, 0.53, 0.37, 0.2];
const ring = (d, op) => filledPath(d, { rule: 'evenodd', opacity: op });
const radialRings = RADII.map((h, i) =>
  ring(i === RADII.length - 1 ? box(h) : box(h) + box(RADII[i + 1]), RADIAL_RAMP[i]),
).join('');

// Four quadrant wedges swept from the center. Each corner point is the box
// corner, so the wedges tile the square exactly.
const CORNERS = [
  [BOX_END, BOX], [BOX_END, BOX_END], [BOX, BOX_END], [BOX, BOX],
];
const conicWedges = RAMP.map((op, i) => {
  const [ax, ay] = CORNERS[i];
  const [bx, by] = CORNERS[(i + 1) % 4];
  return step(`M10 10L${ax} ${ay}L${bx} ${by}Z`, op);
}).join('');

// 45-degree stripes as filled polygons, so the pattern swatch is solid ink
// in the same register as the other four rather than an outlined box. Each
// stripe is the square clipped to the band c1 <= x + y <= c2, solved by
// Sutherland-Hodgman against the two half-planes — the corner stripes are
// triangles and eyeballing their vertices does not land on the edge.
/** One pixel of a glyph drawn at 14px, in viewBox units. */
const P14 = 20 / 14;
const n4 = (v) => Math.round(v * 1e4) / 1e4;
const SQUARE = [[BOX, BOX], [BOX_END, BOX], [BOX_END, BOX_END], [BOX, BOX_END]];

// `axis` picks the diagonal family: 'sum' is x + y (down-right rules),
// 'diff' is y - x (up-right rules). One crosshatch needs both.
const clipHalf = (poly, keepBelow, c, axis) => {
  const f = axis === 'sum' ? (p) => p[0] + p[1] : (p) => p[1] - p[0];
  const inside = (p) => (keepBelow ? f(p) <= c : f(p) >= c);
  const cross = (a, b) => {
    const t = (c - f(a)) / (f(b) - f(a));
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  };
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (inside(a)) out.push(a);
    if (inside(a) !== inside(b)) out.push(cross(a, b));
  }
  return out;
};

const stripe = (c1, c2, axis) => {
  const poly = clipHalf(clipHalf(SQUARE, false, c1, axis), true, c2, axis);
  if (poly.length < 3) return '';
  const d = poly.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${n(x)} ${n(y)}`).join('') + 'Z';
  return `<path d="${d}" fill="currentColor" stroke="none"/>`;
};

// Both diagonal families, band centers stepping by 6.6 out to +/-13.2 — the
// extremes sit ON the corners, so those bands are half-clipped and the ink
// reaches all four. Centering them inside the box instead leaves the corners
// bare and the silhouette reads as a lozenge rather than a swatch.
const HATCH_W = 2.6;
const HATCH_OFFSETS = [-13.2, -6.6, 0, 6.6, 13.2];
const crosshatch = (mid, axis) =>
  HATCH_OFFSETS
    .map((o) => stripe(mid + o - HATCH_W / 2, mid + o + HATCH_W / 2, axis))
    .join('');

// Four cells of a 2x2 patch grid, divided by two CURVED seams rather than
// straight ones — a mesh's whole claim over the other gradients is that its
// color field bends, and a straight cross would draw a four-square swatch that
// says nothing the linear glyph does not.
//
// Both seams pass through one crossing point, and each is built as two cubics
// that START or END there rather than as one curve cut in half by eye: four
// cells sharing a vertex leave a visible notch if the vertex is four slightly
// different points. Tangents at the crossing are axis-aligned so the two
// halves of a seam continue into each other instead of kinking.
const MESH_CROSS = [11.6, 8.6];
const bias = 0.55;
const cubic = (p0, c1, c2, p3) => ({ p0, c1, c2, p3 });
const seg = ({ c1, c2, p3 }) =>
  `C${n(c1[0])} ${n(c1[1])} ${n(c2[0])} ${n(c2[1])} ${n(p3[0])} ${n(p3[1])}`;
const rev = ({ p0, c1, c2, p3 }) => cubic(p3, c2, c1, p0);
const at = (p) => `${n(p[0])} ${n(p[1])}`;

const [CX, CY] = MESH_CROSS;
const seamTop = cubic(
  [10, BOX], [10, BOX + (CY - BOX) * bias], [CX, CY - (CY - BOX) * bias], [CX, CY],
);
const seamBottom = cubic(
  [CX, CY], [CX, CY + (BOX_END - CY) * bias], [10, BOX_END - (BOX_END - CY) * bias], [10, BOX_END],
);
const seamLeft = cubic(
  [BOX, 10], [BOX + (CX - BOX) * bias, 10], [CX - (CX - BOX) * bias, CY], [CX, CY],
);
const seamRight = cubic(
  [CX, CY], [CX + (BOX_END - CX) * bias, CY], [BOX_END - (BOX_END - CX) * bias, 10], [BOX_END, 10],
);

const meshCells = [
  // Top-left: down the top edge, along the top seam, back along the left one.
  `M${at([BOX, BOX])}L${at([10, BOX])}${seg(seamTop)}${seg(rev(seamLeft))}L${at([BOX, BOX])}Z`,
  // Top-right.
  `M${at([10, BOX])}L${at([BOX_END, BOX])}L${at([BOX_END, 10])}`
    + `${seg(rev(seamRight))}${seg(rev(seamTop))}Z`,
  // Bottom-right.
  `M${at([CX, CY])}${seg(seamRight)}L${at([BOX_END, BOX_END])}L${at([10, BOX_END])}`
    + `${seg(rev(seamBottom))}Z`,
  // Bottom-left.
  `M${at([CX, CY])}${seg(seamBottom)}L${at([BOX, BOX_END])}L${at([BOX, 10])}${seg(seamLeft)}Z`,
].map((d, i) => step(d, RAMP[i])).join('');

export const PAINT_KINDS = {
  solid: step(`M${BOX} ${BOX}H${BOX_END}V${BOX_END}H${BOX}Z`, 1),
  linear: linearBands,
  radial: radialRings,
  conic: conicWedges,
  mesh: meshCells,
  // Crosshatch rather than a one-way hatch: a single diagonal run is the
  // universal "none / not applicable" strike, which is the one thing this
  // glyph must not say.
  pattern: crosshatch(BOX + BOX_END, 'sum') + crosshatch(0, 'diff'),

  // A solid parent swatch handing its paint down an elbow to an empty child: the node takes what its parent
  // paints. Laid on the 14px grid the paint segments draw at (`P14` edges for the fill, centers for the
  // strokes), where it is crisp at 1x and 2x.
  inherit: (() => {
    const edge = (k) => n4(k * P14);
    const mid = (k) => n4((k + 0.5) * P14);
    return `<path d="M${edge(2)} ${edge(2)}H${edge(6)}V${edge(6)}H${edge(2)}Z" fill="currentColor" stroke="none"/>`
      + `<path d="M${mid(3)} ${edge(6)}V${mid(9)}H${mid(7)}"/>`
      + `<path d="M${mid(7)} ${mid(7)}H${mid(11)}V${mid(11)}H${mid(7)}Z" stroke-linejoin="miter"/>`;
  })(),

  // Illustrator's convention, and the one glyph in the set that is an empty
  // box rather than a mass of ink — the absence of paint should not look like
  // one of the paints. The slash is the theme's danger red rather than
  // `currentColor`: it stays red on a selected segment, which is what makes
  // it read as "none" instead of as a diagonal texture. Butt caps so it stops
  // exactly on the corners it is drawn between.
  none: `<path d="M${BOX} ${BOX}H${BOX_END}V${BOX_END}H${BOX}Z"/>`
    + `<path d="M${BOX} ${BOX_END}L${BOX_END} ${BOX}" stroke="var(--wzl-danger, #d94a3f)"`
    + ` stroke-width="1.8" stroke-linecap="butt"/>`,
};
