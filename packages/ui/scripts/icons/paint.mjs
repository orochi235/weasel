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
