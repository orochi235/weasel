// The crosshair: the cursor of every tool that draws a shape, whose center is
// the hotspot. The shape it draws is a mark set in its lower right
// (`{ mark: 'rect' }`), from ./marks.mjs.
//
// Geometry is computed, not eyeballed — see docs/icons.md ("Drawing rules").

import { n } from './lib.mjs';

const C = 12;
const ARM_IN = 2.6;   // gap half-width, so the aiming point stays visible
const ARM_OUT = 7.4;  // arm length from the center
const ARM_W = 1.6;

// Marked, the crosshair moves 3 up and left to leave the mark its corner. The
// arms are short for the same reason: at 7.4 they stop clear of the mark's
// halo.
const SHIFT = -3;

/** The four arms. One path each: a cross drawn as two crossing lines would
 *  put ink over the aiming point the gap exists to keep clear. */
const arms = () =>
  [
    [C - ARM_OUT, C, C - ARM_IN, C],
    [C + ARM_IN, C, C + ARM_OUT, C],
    [C, C - ARM_OUT, C, C - ARM_IN],
    [C, C + ARM_IN, C, C + ARM_OUT],
  ].map(([x1, y1, x2, y2]) => ({
    role: 'stroke',
    d: `M ${n(x1)} ${n(y1)} L ${n(x2)} ${n(y2)}`,
    width: ARM_W,
  }));

const crosshair = {
  box: 24,
  hotspot: [C, C],
  // Centered where the two arms leave room, in the shifted frame, and sized so
  // the mark's halo stops short of the box edge.
  mark: { x: 17.6, y: 17.6, size: 10, shift: [SHIFT, SHIFT] },
  paths: arms(),
};

export const SHAPES = { crosshair };
