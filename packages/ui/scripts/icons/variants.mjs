// Component variants: how much chrome a control wears. One chip — a rounded
// rect around a bar of "label" — drawn with less on it at each step, so the
// glyphs read as a family and sort by emphasis: solid, outline, subtle, ghost,
// link.
//
// The chip's ink edge is 2..18 by 5..15 in every glyph, whether that edge comes
// from a stroke (outline, ghost) or a fill (solid, subtle), so switching
// between them never moves the silhouette.
const n = (v) => Math.round(v * 100) / 100;

const X0 = 2;
const X1 = 18;
const Y0 = 5;
const Y1 = 15;
const R = 3.25; // outer corner radius of the ink
const SW = 1.5;
const H = SW / 2;

// Stroked chip: center line inset half a stroke so the ink lands on the edge.
const chipStroke = (extra = '') =>
  `<rect x="${X0 + H}" y="${Y0 + H}" width="${X1 - X0 - SW}" height="${Y1 - Y0 - SW}" rx="${R - H}"${extra}/>`;

const roundedRect = (x0, y0, x1, y1, r) =>
  `M${n(x0 + r)} ${y0}H${n(x1 - r)}A${r} ${r} 0 0 1 ${x1} ${n(y0 + r)}V${n(y1 - r)}` +
  `A${r} ${r} 0 0 1 ${n(x1 - r)} ${y1}H${n(x0 + r)}A${r} ${r} 0 0 1 ${x0} ${n(y1 - r)}` +
  `V${n(y0 + r)}A${r} ${r} 0 0 1 ${n(x0 + r)} ${y0}Z`;

// The label: a stroked bar whose round caps put its ink at 6..14.
const LABEL = `M6.75 10h6.5`;
const label = `<path d="${LABEL}"/>`;

// Ghost's dashes. The center-line perimeter is 2·(14.5 + 8.5) less the
// corners' (8 − 2π)·r; dividing it into whole dash periods keeps the seam at
// the start point from showing a short dash or a doubled gap.
const RC = R - H;
const PERIM = 2 * (X1 - X0 - SW + (Y1 - Y0 - SW)) - (8 - 2 * Math.PI) * RC;
const PERIODS = 12;
const DASH = n((PERIM / PERIODS) * 0.45);
const GAP = n(PERIM / PERIODS - DASH);

// Segmented controls (ToggleBar, ButtonBar, OptionsBar) vary the track, not
// the chip: a pill track holding the selected segment, no track at all, or
// square cells sharing their borders. Same 2..18 by 6..14 box in all three.
const SEG_SELECTED = `<rect x="7.25" y="8.5" width="5.5" height="3" rx="1.5" fill="currentColor" stroke="none"/>`;
const CELL = (16 - SW) / 3;
const cellX = [n(X0 + H + CELL), n(X0 + H + 2 * CELL)];

export const VARIANTS = {
  // Ink chip with the label knocked out of it.
  variantSolid:
    `<path d="${roundedRect(X0, Y0, X1, Y1, R)}` +
    `${roundedRect(6, 9.25, 14, 10.75, 0.75)}" fill="currentColor" fill-rule="evenodd" stroke="none"/>`,

  variantOutline: chipStroke() + label,

  // Tinted face, no edge; the label sits on it at full ink.
  variantSubtle:
    `<path d="${roundedRect(X0, Y0, X1, Y1, R)}" fill="currentColor" fill-opacity="0.32" stroke="none"/>` +
    label,

  // The edge is only implied — it appears on hover.
  variantGhost: chipStroke(` stroke-dasharray="${DASH} ${GAP}"`) + label,

  // No chip: the series' label, over an underline on a whole pixel row at 16px 1x.
  variantLink: label + `<path d="M4.75 13.125h10.5" stroke-width="1.25"/>`,

  // A label with nothing around it.
  variantPlain: label,

  variantSegmented:
    `<rect x="2.75" y="6.75" width="14.5" height="6.5" rx="3.25"/>` +
    SEG_SELECTED,

  variantSegmentedMinimal:
    SEG_SELECTED + `<path d="M3.75 10h1.5M14.75 10h1.5"/>`,

  variantSegmentedFlat:
    `<rect x="2.75" y="6.75" width="14.5" height="6.5" rx="1"/>` +
    `<path d="M${cellX[0]} 6.75v6.5M${cellX[1]} 6.75v6.5"/>` +
    `<rect x="${cellX[0]}" y="6.75" width="${n(cellX[1] - cellX[0])}" height="6.5" fill="currentColor" stroke="none"/>`,
};
