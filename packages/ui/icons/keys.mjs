import { chevron } from '../../icons/scripts/lib/base.mjs';

// Key legends: the symbols printed on keycaps, for a KeyCap to draw in place
// of a font's glyph. Their ink fills the same 3..17 box, so a row of them reads
// as one set whatever face the letters around them are in.

const n = (v) => Math.round(v * 100) / 100;

// Heavier than the set's 1.5: a legend renders at 11-13px, where 1.5 is under a
// pixel and goes gray. The center line keeps to 3..17 less half of it.
const SW = 2;
const LO = 3 + SW / 2;
const HI = 17 - SW / 2;
const MID = 10;
const stroked = (...ds) => ds.map((d) => `<path d="${d}" stroke-width="${SW}"/>`).join('');

// Every head in the set: an open V whose vertex is the shaft's end.
const HEAD = [3.5, 45];
const arrow = ([x0, y0], [x1, y1], head = HEAD) => [
  `M${x0} ${y0}L${x1} ${y1}`,
  chevron([x1, y1], [x1 - x0, y1 - y0], ...head),
];
const ring = (cx, cy, r) => `M${n(cx - r)} ${cy}A${r} ${r} 0 1 0 ${n(cx + r)} ${cy}A${r} ${r} 0 1 0 ${n(cx - r)} ${cy}Z`;
const polar = (cx, cy, r, deg) => [n(cx + r * Math.cos((deg * Math.PI) / 180)), n(cy + r * Math.sin((deg * Math.PI) / 180))];

// Command: a square whose sides run on past its corners into four loops. A loop
// is three quarters of a circle of radius R, centered diagonally off a corner, so
// each side meets it at the circle's nearest point and leaves on its tangent. At
// R = (HI - LO) / 6 the square and the loops leave holes the same size.
const R = (HI - LO) / 6;
const A = LO + 2 * R;
const B = HI - 2 * R;
const loop = (x, y) => `A${R} ${R} 0 1 1 ${n(x)} ${n(y)}`;
const command =
  `M${n(A)} ${n(A - R)}V${n(B + R)}${loop(A - R, B)}` +
  `H${n(B + R)}${loop(B, B + R)}` +
  `V${n(A - R)}${loop(B + R, A)}` +
  `H${n(A - R)}${loop(A, A - R)}Z`;

// Shift and Scroll Lock: outlined arrows, each head as wide as the box at 45°, on
// a stem half as wide.
const HALF = (HI - LO) / 2;
const STEM = HALF / 2;
const shift =
  `M${MID} ${LO} ${HI} ${MID}H${MID + STEM}V${HI}H${MID - STEM}V${MID}H${LO}Z`;
// Scroll Lock's heads are shorter, so a stem shows between them.
const HEAD_H = 3.75;
const STEM_W = 1.75;
const scrollLock =
  `M${MID} ${LO} ${MID + HEAD_H} ${LO + HEAD_H}H${MID + STEM_W}V${HI - HEAD_H}H${MID + HEAD_H}L${MID} ${HI}` +
  `L${MID - HEAD_H} ${HI - HEAD_H}H${MID - STEM_W}V${LO + HEAD_H}H${MID - HEAD_H}Z`;

// Escape: a ring broken at its upper left, and an arrow out through the gap.
const ESC_C = 10.25;
const ESC_R = HI - ESC_C;
const escape = [
  `M${ESC_C} ${n(ESC_C - ESC_R)}A${ESC_R} ${ESC_R} 0 1 1 ${n(ESC_C - ESC_R)} ${ESC_C}`,
  ...arrow([9, 9], [LO, LO], [3.2, 45]),
];

// Backspace: a key pointing left with a cross in it; Delete points right.
const backspace = [`M${HI} 5H8.5L${LO} 10 8.5 15H${HI}Z`, 'M10 8.5 13 11.5M13 8.5 10 11.5'];

// Page Up: an arrow crossed twice on its shaft; Page Down is it upside down.
const pageUp = [...arrow([MID, HI], [MID, LO]), 'M7 10.75H13M7 14H13'];
const flipY = (d) => d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_, x, y) => `${x} ${n(20 - y)}`);

// Control, as ISO 9995-7 draws it: a helm, with handles out past its rim.
// Only the square spokes cross the hub, so the four spaces between them stay open.
const RIM = 4.25;
const helm = [
  ring(MID, MID, RIM),
  `M${MID} ${LO}V${HI}M${LO} ${MID}H${HI}`,
  [45, 135, 225, 315].map((a) => `M${polar(MID, MID, RIM, a).join(' ')}L${polar(MID, MID, 6.25, a).join(' ')}`).join(''),
];

export const KEYS = {
  keyCommand: stroked(command),
  keyShift: stroked(shift),
  // Option: a switch — a line that drops from the top rail to the bottom one,
  // beside the rail it left.
  keyOption: stroked(`M${LO} 6H7.5L12.5 14H${HI}`, `M12.25 6H${HI}`),
  // Alt, ISO's switch: short rails at the left, long ones at the right.
  keyAlt: stroked(`M${LO} 6H7L10 14H${HI}`, `M10.5 6H${HI}`),
  // Control on a Mac: a caret, centered on the box.
  keyControl: stroked(`M${LO} 13 ${MID} 7 ${HI} 13`),
  keyHelm: stroked(...helm),
  keyEscape: stroked(...escape),
  // Return: down the right, then back along the bottom to the left.
  keyReturn: stroked(`M${HI} 5V11.5H${LO}`, chevron([LO, 11.5], [-1, 0], ...HEAD)),
  // Tab: an arrow up against a bar.
  keyTab: stroked(`M${HI} 6V14`, ...arrow([LO, MID], [13.5, MID])),
  // Space: an open box, like the one written for a space.
  keySpace: stroked(`M${LO} 9V13H${HI}V9`),
  keyBackspace: stroked(...backspace),
  keyDelete: stroked(`M${LO} 5H11.5L${HI} 10 11.5 15H${LO}Z`, 'M7 8.5 10 11.5M10 8.5 7 11.5'),
  // Backspace off a Mac: a long arrow left.
  keyBackspaceArrow: stroked(...arrow([HI, MID], [LO, MID])),
  keyArrowUp: stroked(...arrow([MID, HI], [MID, LO])),
  keyArrowDown: stroked(...arrow([MID, LO], [MID, HI])),
  keyArrowLeft: stroked(...arrow([HI, MID], [LO, MID])),
  keyArrowRight: stroked(...arrow([LO, MID], [HI, MID])),
  // Home and End: diagonal arrows, their barbs on the pixel axes.
  keyHome: stroked(...arrow([15.5, 15.5], [4.5, 4.5], [4, 45])),
  keyEnd: stroked(...arrow([4.5, 4.5], [15.5, 15.5], [4, 45])),
  keyPageUp: stroked(...pageUp),
  keyPageDown: stroked(...pageUp.map(flipY)),
  // Print Screen: a page standing in a tray, its top corner folded.
  keyPrintScreen: stroked(`M6.5 11V${LO}H11.5L13.5 6V11`, `M${LO} 11H${HI}V${HI}H${LO}Z`),
  // Insert: a wide V with the mark being inserted in its notch.
  keyInsert: stroked(`M${LO} 6 ${MID} 15 ${HI} 6`, `M${MID} 6.5h0`),
  keyScrollLock: stroked(scrollLock),
  // Pause: a ring crossed by a bar with a notch in it.
  keyPause: stroked(ring(MID, MID, 6), `M${LO} 9.25H7.75L${MID} 11.5 12.25 9.25H${HI}`),
  // The Windows key: a window of four panes.
  keyWindows: stroked(`M${LO} ${LO}H${HI}V${HI}H${LO}Z`, `M${MID} ${LO}V${HI}M${LO} ${MID}H${HI}`),
  // The menu key: a box ruled across.
  keyMenu: stroked(`M${LO} ${LO}H${HI}V${HI}H${LO}Z`, `M${LO} 8H${HI}M${LO} 12H${HI}`),
};
