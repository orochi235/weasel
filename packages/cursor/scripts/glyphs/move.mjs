// Cursor glyphs a move shows while it is about to do something other than
// translate. Hotspotted at the box center: they say what a release will do,
// not where a tool bites.
//
// Geometry is computed, not eyeballed — see docs/icons.md ("Drawing rules").

import { closed } from './lib.mjs';

// ── swap ─────────────────────────────────────────────────────────────────
// Two arrows passing each other, ⇄: the cursor while a swap drop is armed.
// Each is one polygon, a straight shaft on a compass direction with its head
// on the end, so no seam shows in the halo. Every straight edge sits on a
// whole unit, so at 24px the shafts are three crisp pixels and the head bases
// one sharp column. The rows are far enough apart that the white halo
// (CURSOR_HALO_WIDTH, 2.6) still runs between the upper head's barb and the
// lower shaft, which it overhangs.
const C = 12;
const REACH = 9;       // tip's distance from the center
const HEAD_LEN = 6;
const HEAD_HALF = 4;
const SHAFT_HALF = 1.5;
const ROW = 4.5;       // each shaft's center above or below the box center

/** One arrow along row `y`, pointing right when `dir` is 1 and left when it is -1. */
const arrow = (y, dir) => {
  const tail = C - dir * REACH;
  const tip = C + dir * REACH;
  const base = tip - dir * HEAD_LEN;
  return closed([
    [tail, y - SHAFT_HALF],
    [base, y - SHAFT_HALF],
    [base, y - HEAD_HALF],
    [tip, y],
    [base, y + HEAD_HALF],
    [base, y + SHAFT_HALF],
    [tail, y + SHAFT_HALF],
  ]);
};

const swap = {
  box: 24,
  hotspot: [C, C],
  paths: [
    { role: 'ink', d: arrow(C - ROW, 1) },
    { role: 'ink', d: arrow(C + ROW, -1) },
  ],
};

export const MOVE = { swap };
