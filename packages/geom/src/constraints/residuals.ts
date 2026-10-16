/**
 * Each constraint as residual rows: numbers that are all zero exactly when it
 * holds. Every row is in the path's units, so one tolerance reads them all.
 */

import type { AnchorPair, PathConstraint } from './types';

/** The axes `horizontal` and `vertical` read: the x axis is `(cos, sin)`. */
export interface ConstraintFrame {
  cos: number;
  sin: number;
}

/** The frame turned `angle` radians from the world's axes. */
export function frameAt(angle = 0): ConstraintFrame {
  return { cos: Math.cos(angle), sin: Math.sin(angle) };
}

/** How many residual rows `c` writes. */
export function residualRows(c: PathConstraint): number {
  return c.kind === 'coincident' ? 2 : c.kind === 'fixed' ? 0 : 1;
}

const dx = (x: ArrayLike<number>, [a, b]: AnchorPair) => x[2 * b] - x[2 * a];
const dy = (x: ArrayLike<number>, [a, b]: AnchorPair) => x[2 * b + 1] - x[2 * a + 1];

/**
 * The cross (`parallel`) or dot (`perpendicular`) product of two segments,
 * over the geometric mean of their lengths: the sine or cosine of the angle
 * between them, times a length. Zero when either segment has no length,
 * which leaves the angle undefined rather than wrong.
 */
function angleRow(x: ArrayLike<number>, s: readonly [AnchorPair, AnchorPair], cross: boolean): number {
  const ux = dx(x, s[0]);
  const uy = dy(x, s[0]);
  const vx = dx(x, s[1]);
  const vy = dy(x, s[1]);
  const scale = Math.sqrt(Math.hypot(ux, uy) * Math.hypot(vx, vy));
  if (scale < 1e-9) return 0;
  return (cross ? ux * vy - uy * vx : ux * vx + uy * vy) / scale;
}

/** Write `c`'s residual rows for anchor coordinates `x` (interleaved x, y) into `out` at `at`. */
export function writeResiduals(
  c: PathConstraint,
  x: ArrayLike<number>,
  frame: ConstraintFrame,
  out: Float64Array,
  at: number,
): void {
  switch (c.kind) {
    case 'fixed': return;
    case 'horizontal':
      out[at] = -frame.sin * dx(x, c.segment) + frame.cos * dy(x, c.segment);
      return;
    case 'vertical':
      out[at] = frame.cos * dx(x, c.segment) + frame.sin * dy(x, c.segment);
      return;
    case 'length':
      out[at] = Math.hypot(dx(x, c.segment), dy(x, c.segment)) - c.length;
      return;
    case 'coincident':
      out[at] = dx(x, c.anchors);
      out[at + 1] = dy(x, c.anchors);
      return;
    case 'equalLength':
      out[at] = Math.hypot(dx(x, c.segments[0]), dy(x, c.segments[0]))
        - Math.hypot(dx(x, c.segments[1]), dy(x, c.segments[1]));
      return;
    case 'parallel':
      out[at] = angleRow(x, c.segments, true);
      return;
    case 'perpendicular':
      out[at] = angleRow(x, c.segments, false);
  }
}
