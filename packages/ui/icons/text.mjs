// Character-styling glyphs: the run flags a text tool's options bar carries,
// plus the two scripts and a code face.
//
// The five flags are letterforms rather than pictures, because that is what
// every text editor draws and what the bar replaced — so each one wears the
// treatment it applies: U is underlined, S is struck, O is overlined. Bold
// carries a heavier stroke than the rest of the set on purpose; it is the one
// glyph whose weight *is* its meaning.

// The `x` both scripts are built on, as a box the numeral hangs off.
const cross = (x1, y1, x2, y2) => `M${x1} ${y1} ${x2} ${y2}M${x2} ${y1} ${x1} ${y2}`;

/** A small numeral 2, its bowl a near-semicircle, its foot a flat rule. */
const two = (top) =>
  `M11.9 ${top + 1.9}a2.2 2.2 0 1 1 4.3.8c0 1.4-4.3 2.2-4.3 3.5h4.5`;

export const TEXT = {
  // Two stacked bowls off one stem, at the weight the word names.
  bold: `<path d="M6 3.5h4.6a3.1 3.1 0 0 1 0 6.2H6zM6 9.7h5.4a3.4 3.4 0 0 1 0 6.8H6z" stroke-width="2.1"/>`,

  // Serifed I, so the slant reads as a face and not as a stray rule.
  italic: `<path d="M9 3.5h6M5 16.5h6M12.5 3.5 7.5 16.5"/>`,

  underline: `<path d="M6 3.4v5.6a4 4 0 0 0 8 0V3.4"/><path d="M4.6 17h10.8"/>`,

  // The rule crosses the letter rather than sitting under it, so the S is
  // drawn in two arcs with the gap the rule fills.
  strikethrough: `
    <path d="M14.4 5.8c-.9-1.6-2.4-2.4-4.4-2.4-2.5 0-4.2 1.3-4.2 3.1 0 .9.4 1.6 1.2 2.2"/>
    <path d="M5.6 14.2c.9 1.6 2.4 2.4 4.4 2.4 2.5 0 4.2-1.3 4.2-3.1 0-.9-.4-1.6-1.2-2.2"/>
    <path d="M3.4 10h13.2"/>`,

  overline: `<path d="M4.6 3h10.8"/><ellipse cx="10" cy="11.4" rx="4.4" ry="4.8"/>`,

  // x with the numeral raised: the cross drops to the baseline half of the
  // box, and the 2 takes the top right.
  superscript: `<path d="${cross(3.6, 8.6, 10.4, 16.4)}"/><path d="${two(3.4)}"/>`,

  // The same pair, swapped: cross at cap height, numeral on the baseline.
  subscript: `<path d="${cross(3.6, 3.6, 10.4, 11.4)}"/><path d="${two(9.6)}"/>`,

  // Angle brackets around a slash — the one glyph here that is a picture
  // rather than a letter, because "code" has no letterform.
  code: `<path d="M7 6.2 3.2 10 7 13.8M13 6.2 16.8 10 13 13.8"/><path d="M11.2 4.8 8.8 15.2"/>`,
};

export const TEXT_ORDER = [
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'overline',
  'superscript',
  'subscript',
  'code',
];

// Paragraph alignment: lines of text as rules, the picture every editor uses.
//
// Horizontal: four lines alternating long and short, the short ones pushed to
// the edge (or the middle) the option names. Justify runs every line long but
// the last, which is short at the start edge, as a justified paragraph's is. Rows sit on 3.75-unit centers so
// that at 16px (0.8px a unit) each falls on a pixel center at 1x.
const ROWS = [4.375, 8.125, 11.875, 15.625];
const LONG = [3, 17];
const SHORT = 9;
const rule = (x1, x2, y) => `M${x1} ${y}H${x2}`;
const lines = (shortStart) =>
  `<path d="${ROWS.map((y, i) =>
    i % 2 === 0 ? rule(LONG[0], LONG[1], y) : rule(shortStart, shortStart + SHORT, y),
  ).join('')}"/>`;

// Vertical: two lines inside a box, set against its top, its middle or its
// bottom. The box is structure, so it is a hairline; the lines are ink. Every
// edge and row sits on a 1x pixel center at 16px, like the rows above, and
// the block clears the box's inner edge by the same 2.5 units top and bottom,
// so the three read as one block moved rather than three drawings.
const BOX = `<rect x="1.875" y="1.875" width="16.25" height="16.25" rx="2" stroke-width="1"/>`;
const GAP = 3.75;
const block = (y) => `<path d="${rule(5.5, 14.5, y)}${rule(7, 13, y + GAP)}"/>`;

export const PARAGRAPH = {
  textAlignLeft: lines(LONG[0]),
  textAlignCenter: lines(10 - SHORT / 2),
  textAlignRight: lines(LONG[1] - SHORT),
  textAlignJustify: `<path d="${ROWS.map((y, i) =>
    i < ROWS.length - 1 ? rule(LONG[0], LONG[1], y) : rule(LONG[0], LONG[0] + SHORT, y),
  ).join('')}"/>`,
  textAlignTop: BOX + block(5.625),
  textAlignMiddle: BOX + block(10 - GAP / 2),
  textAlignBottom: BOX + block(14.375 - GAP),
};
