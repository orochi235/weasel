// Stroke cap, join, align and dash. Unlike the outlined register in base.mjs these
// are filled silhouettes: the glyph IS the ink, so the option it names is
// legible as a shape rather than as a diagram of one.

const n = (v) => Math.round(v * 100) / 100;

/** A full circle as two half arcs, opening at 12 o'clock. */
const disc = (cx, cy, r) =>
  `M${n(cx)} ${n(cy - r)}A${n(r)} ${n(r)} 0 1 0 ${n(cx)} ${n(cy + r)}A${n(r)} ${n(r)} 0 1 0 ${n(cx)} ${n(cy - r)}Z`;

// ── align ────────────────────────────────────────────────────────────────
// One circle of radius R, zoomed until the ink band's far edge leaves the
// box. `inner` closes into a disc and `outer` into the box's complement of
// it, so the three are the same band at three offsets and read as a set.
const R = 6.2;
const W = 3.4;
const alignRing = disc(10, 10, R + W / 2) + disc(10, 10, R - W / 2);
const alignOuter = `M0 0H20V20H0Z` + disc(10, 10, R);

// ── cap ──────────────────────────────────────────────────────────────────
// The one option glyph drawn in both registers: the path's body is a hollow
// rectangle and the ink the cap *adds past its right edge* is solid, so butt
// reads as "nothing beyond the end" rather than as a shorter bar.
//
// Each glyph is placed by its own ink extent, so `butt` — the one carrying no
// ink past the edge — sits further right than the other two. Centring the set
// on one shared x instead leaves `butt` visibly left in its segment, and a
// segmented control is judged a button at a time rather than as a strip.
//
// The cap ink is flush with the body's OUTER profile (half a stroke past its
// edges), not its centerline: the two otherwise meet in a visible step.
const capH = 4.75;
const capW = 1.5;
const capLen = 9;
const capOut = n(capH + capW / 2);
const capInk = {
  butt: () => '',
  round: (x) => `M${n(x)} ${n(10 - capOut)}A${capOut} ${capOut} 0 0 1 ${n(x)} ${n(10 + capOut)}Z`,
  square: (x) => `M${n(x)} ${n(10 - capOut)}H${n(x + capOut)}V${n(10 + capOut)}H${n(x)}Z`,
};
const cap = (linecap) => {
  const reach = linecap === 'butt' ? capW / 2 : capOut;
  const x0 = n(10 - (capW / 2 + capLen + reach) / 2 + capW / 2);
  const x1 = n(x0 + capLen);
  const ink = capInk[linecap](x1);
  return (
    `<path d="M${x0} ${n(10 - capH)}H${x1}V${n(10 + capH)}H${x0}Z" fill="none" stroke="currentColor" stroke-width="${capW}" stroke-linejoin="miter"/>` +
    (ink ? `<path d="${ink}" fill="currentColor" stroke="none"/>` : '')
  );
};

// ── join ─────────────────────────────────────────────────────────────────
// Height ranks as the geometry does — miter runs furthest past the corner, a
// round join reaches its half-width, a bevel is cut shortest — so the set
// reads by height as well as by shape.
const fill = (d, rule) =>
  `<path d="${d}" fill="currentColor" stroke="none"${rule ? ` fill-rule="${rule}"` : ''}/>`;

// ── dash ─────────────────────────────────────────────────────────────────
// One rule across the box at four patterns. Drawn heavier than the set's 1.5
// so a gap survives the 16px grid, and butt-capped so a mark is the length the
// array says rather than half a round cap longer at each end.
//
// Every pattern is solved to end on ink at both ends of the run. A pattern
// that merely repeats leaves a partial period at the right, and the four then
// differ in how far their ink reaches as well as in rhythm — which is the
// louder difference, and the wrong one.
const dashRun = 16;
const dashRule = (pattern) =>
  `<path d="M2 10h${dashRun}" stroke-width="3" stroke-linecap="butt"${pattern ? ` stroke-dasharray="${pattern}"` : ''}/>`;
/** `count` marks of `mark` units, gapped to fill the run exactly. */
const dashEven = (count, mark) =>
  dashRule(`${mark} ${n((dashRun - count * mark) / (count - 1))}`);

// ── the categories ───────────────────────────────────────────────────────
// Each is the bare path its row treats, in the outlined register: the label
// is the line, the options beside it are the ink. Staying at the set's 1.5
// also keeps `align` from reading as its own `center` option, which is the
// same ring several units fatter.
const category = {
  // Width is the odd one out: there is no path to draw, so it ranks three
  // rules instead.
  'stroke-width': `<path d="M3.4 5.6h13.2" stroke-width="1"/>
                   <path d="M3.4 10h13.2" stroke-width="2"/>
                   <path d="M3.4 15.2h13.2" stroke-width="3.4"/>`,
  'stroke-cap': '<path d="M2.5 10H12" stroke-linecap="butt"/><path d="M12 6V14" stroke-width="1"/>',
  'stroke-join': '<path d="M4.4 15.5 10 5.5 15.6 15.5" stroke-linecap="butt" stroke-linejoin="miter"/>',
  'stroke-align': '<circle cx="10" cy="10" r="6.2"/>',
};


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
const ring = (d, op) =>
  `<path d="${d}" fill="currentColor" fill-rule="evenodd" stroke="none" fill-opacity="${op}"/>`;
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

export const PAINT = {
  ...category,

  'cap-butt': cap('butt'),
  'cap-round': cap('round'),
  'cap-square': cap('square'),

  'join-miter': fill('M10 3.5 15.6 15.5H4.4Z'),
  'join-round': fill('M4.4 15.5V12a5.6 5.6 0 0 1 11.2 0v3.5Z'),
  'join-bevel': fill('M6.8 8.2h6.4l2.4 7.3H4.4Z'),

  'align-inner': fill(disc(10, 10, R)),
  'align-center': fill(alignRing, 'evenodd'),
  'align-outer': fill(alignOuter, 'evenodd'),

  'dash-solid': dashRule(''),
  'dash-dashed': dashEven(2, 6),
  'dash-dotted': dashEven(4, 2.5),
  // Long-short-long: the one pattern that is neither preset, which is what
  // `custom` reports. 5 + 2 + 2 + 2 + 5 is the run exactly.
  'dash-custom': dashRule('5 2 2 2'),

  'paint-solid': step(`M${BOX} ${BOX}H${BOX_END}V${BOX_END}H${BOX}Z`, 1),
  'paint-linear': linearBands,
  'paint-radial': radialRings,
  'paint-conic': conicWedges,
  // Crosshatch rather than a one-way hatch: a single diagonal run is the
  // universal "none / not applicable" strike, which is the one thing this
  // glyph must not say.
  'paint-pattern': crosshatch(BOX + BOX_END, 'sum') + crosshatch(0, 'diff'),

  // Illustrator's convention, and the one glyph in the set that is an empty
  // box rather than a mass of ink — the absence of paint should not look like
  // one of the paints. The slash is the theme's danger red rather than
  // `currentColor`: it stays red on a selected segment, which is what makes
  // it read as "none" instead of as a diagonal texture. Butt caps so it stops
  // exactly on the corners it is drawn between.
  'paint-none': `<path d="M${BOX} ${BOX}H${BOX_END}V${BOX_END}H${BOX}Z"/>`
    + `<path d="M${BOX} ${BOX_END}L${BOX_END} ${BOX}" stroke="var(--wzl-danger, #d94a3f)"`
    + ` stroke-width="1.8" stroke-linecap="butt"/>`,
};
