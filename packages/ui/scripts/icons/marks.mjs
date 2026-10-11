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

export const MARKS = {
  'mark-add': `<path d="M${C} ${C - REACH}v${2 * REACH}M${C - REACH} ${C}h${2 * REACH}"/>`,
  'mark-remove': `<path d="M${C - REACH} ${C}h${2 * REACH}"/>`,
  'mark-check': `<path d="M${at(SHORT)} ${at([0, 0])} ${at(LONG)}"/>`,
  'mark-close': `<path d="M${C - DIAG} ${C - DIAG} ${C + DIAG} ${C + DIAG}M${C + DIAG} ${C - DIAG} ${C - DIAG} ${C + DIAG}"/>`,
  'mark-dot': `<circle cx="${C}" cy="${C}" r="5" fill="currentColor" stroke="none"/>`,
};
