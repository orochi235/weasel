// Stroke cap, join and align. Unlike the outlined register in base.mjs these
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
// A bar ending on a hairline terminus rule. Without the rule, butt and square
// are a claim about where the path stops rather than something you can see.
// The bar starts off-viewBox so its *other* end is clipped away — at x 0 a
// round cap domes there too and the glyph reads as a lozenge.
const capBar = 'M-2 10H6.7';
const capRule = 'M6.7 2.4V17.6';
const cap = (linecap) =>
  `<path d="${capBar}" stroke="currentColor" stroke-width="9.5" stroke-linecap="${linecap}" stroke-linejoin="miter"/>
   <path d="${capRule}" stroke="currentColor" stroke-width="1" stroke-linecap="butt"/>`;

// ── join ─────────────────────────────────────────────────────────────────
// Height ranks as the geometry does — miter runs furthest past the corner, a
// round join reaches its half-width, a bevel is cut shortest — so the set
// reads by height as well as by shape.
const fill = (d, rule) =>
  `<path d="${d}" fill="currentColor" stroke="none"${rule ? ` fill-rule="${rule}"` : ''}/>`;

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
};
