import { onCircle } from './base.mjs';

// Marks: what `<Icon mark>` sets in a corner of another glyph, to say what a
// press does with it. Each is a glyph like any other and draws alone at full
// size, but is drawn to be read at half of it: one gesture, filling the
// frame, with no detail a slot's few pixels could not hold.
//
// A mark carries no stroke-width of its own. The slot scales the mark down
// and its stroke back up by the same factor, so the mark lands at the weight
// of the glyph it sits on; a width written here would be scaled down with it.

const C = 10;
// Half the span of a straight mark, cap centers. 6.5 leaves the round caps
// 2.75 inside the frame, the gap the knockout around a slot is sized for.
const REACH = 6.5;
const round2 = (v) => Math.round(v * 100) / 100;

// The cross's arms end on the same circle the plus's do.
const DIAG = round2(REACH / Math.SQRT2);

// `check`'s legs at the same angles and ratio, sized so the longer one spans
// what the plus does, and centered on its bounding box the same way.
const SHORT = onCircle(0, 0, 5.9, 135);
const LONG = onCircle(0, 0, 13, 48);
const mid = [(SHORT[0] + LONG[0]) / 2, LONG[1] / 2];
const at = ([x, y]) => `${round2(x + C - mid[0])} ${round2(y + C - mid[1])}`;

// An arrowhead on the vertical stem: two legs back from the tip, `dir` 1 pointing down.
const HEAD = 5.5;
const head = (dir) => {
  const tip = C + dir * REACH;
  return `M${C - HEAD} ${tip - dir * HEAD} ${C} ${tip} ${C + HEAD} ${tip - dir * HEAD}`;
};

const pt = ([x, y]) => `${round2(x)} ${round2(y)}`;
// A solid head: two stroked legs close up into a blob under a slot's stroke. Its base is the radius through the
// arc's end, and its tip lies ahead of that end along the tangent, so the arc runs into the middle of the base.
const RESET_R = 6;
const RESET_CY = C + 0.5;
const RESET_END = 45;
const RESET_FROM = onCircle(C, RESET_CY, RESET_R, 130);
const RESET_TO = onCircle(C, RESET_CY, RESET_R, RESET_END);
const HEAD_HALF = 3.2;
const HEAD_LONG = 5;
const rad = (RESET_END * Math.PI) / 180;
// Screen y runs down: outward along the radius, and onward along the counterclockwise tangent.
const out = [Math.cos(rad), -Math.sin(rad)];
const on = [-Math.sin(rad), -Math.cos(rad)];
const resetHead = [
  [RESET_TO[0] + out[0] * HEAD_HALF, RESET_TO[1] + out[1] * HEAD_HALF],
  [RESET_TO[0] + on[0] * HEAD_LONG, RESET_TO[1] + on[1] * HEAD_LONG],
  [RESET_TO[0] - out[0] * HEAD_HALF, RESET_TO[1] - out[1] * HEAD_HALF],
];

const star = `M${Array.from({ length: 10 }, (_, i) => pt(onCircle(C, C + 0.5, i % 2 ? 2.9 : 6.5, 90 + i * 36))).join(' ')}Z`;

export const MARKS = {
  'mark-add': `<path d="M${C} ${C - REACH}v${2 * REACH}M${C - REACH} ${C}h${2 * REACH}"/>`,
  'mark-remove': `<path d="M${C - REACH} ${C}h${2 * REACH}"/>`,
  'mark-check': `<path d="M${at(SHORT)} ${at([0, 0])} ${at(LONG)}"/>`,
  'mark-close': `<path d="M${C - DIAG} ${C - DIAG} ${C + DIAG} ${C + DIAG}M${C + DIAG} ${C - DIAG} ${C - DIAG} ${C + DIAG}"/>`,
  'mark-dot': `<circle cx="${C}" cy="${C}" r="5" fill="currentColor" stroke="none"/>`,

  // A card, and the top and right edges of one behind it.
  'mark-clone': `<rect x="3.5" y="8.5" width="8" height="8" rx="1"/><path d="M8.5 3.5H15.5a1 1 0 0 1 1 1V11.5"/>`,

  // Filled, since a slot's stroke leaves no room inside a body this size.
  'mark-lock': `<rect x="4.5" y="10" width="11" height="6.5" rx="1" fill="currentColor"/><path d="M6.5 10V7a3.5 3.5 0 0 1 7 0V10"/>`,

  'mark-up': `<path d="M${C} ${C + REACH}V${C - REACH}"/><path d="${head(-1)}"/>`,
  'mark-down': `<path d="M${C} ${C - REACH}V${C + REACH}"/><path d="${head(1)}"/>`,

  'mark-reset': `<path d="M${pt(RESET_FROM)}A${RESET_R} ${RESET_R} 0 1 0 ${pt(RESET_TO)}"/><path d="M${resetHead.map(pt).join(' ')}Z" fill="currentColor" stroke="none"/>`,

  'mark-search': `<circle cx="8.5" cy="8.5" r="4.5"/><path d="M12 12 16.5 16.5"/>`,

  // The point is a stroke of no length, so its round caps draw it as wide as the stem at any scale.
  'mark-alert': `<path d="M${C} ${C - REACH}v7.5"/><path d="M${C} 16.2v.01"/>`,

  'mark-star': `<path d="${star}" fill="currentColor"/>`,
};
