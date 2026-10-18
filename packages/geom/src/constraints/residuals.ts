/**
 * Each constraint as residual rows: numbers that are all zero exactly when it
 * holds. Every row is in the path's units, so one tolerance reads them all.
 * Each row's derivatives are analytic, handed out one nonzero at a time.
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

/** Takes one derivative: of residual row `row` (counted from the constraint's first) by coordinate `v`. */
export type Grad = (row: number, v: number, d: number) => void;

/** How many residual rows `c` writes. */
export function residualRows(c: PathConstraint): number {
  return c.kind === 'coincident' ? 2 : c.kind === 'fixed' ? 0 : 1;
}

const dx = (x: ArrayLike<number>, [a, b]: AnchorPair) => x[2 * b] - x[2 * a];
const dy = (x: ArrayLike<number>, [a, b]: AnchorPair) => x[2 * b + 1] - x[2 * a + 1];

/** `d` times the derivative of segment `s`'s vector by its own `(gx, gy)`, spread onto its two ends. */
function segmentGrad(grad: Grad, row: number, [a, b]: AnchorPair, gx: number, gy: number): void {
  grad(row, 2 * b, gx);
  grad(row, 2 * b + 1, gy);
  grad(row, 2 * a, -gx);
  grad(row, 2 * a + 1, -gy);
}

function lengthOf(x: ArrayLike<number>, s: AnchorPair, grad: Grad | undefined, row: number, sign: number): number {
  const ux = dx(x, s);
  const uy = dy(x, s);
  const len = Math.hypot(ux, uy);
  if (grad && len > 1e-12) segmentGrad(grad, row, s, (sign * ux) / len, (sign * uy) / len);
  return len;
}

/**
 * The cross (`parallel`) or dot (`perpendicular`) product of two segments,
 * over the geometric mean of their lengths: the sine or cosine of the angle
 * between them, times a length. Zero when either segment has no length,
 * which leaves the angle undefined rather than wrong.
 */
function angleRow(
  x: ArrayLike<number>,
  s: readonly [AnchorPair, AnchorPair],
  cross: boolean,
  grad: Grad | undefined,
  row: number,
): number {
  const ux = dx(x, s[0]);
  const uy = dy(x, s[0]);
  const vx = dx(x, s[1]);
  const vy = dy(x, s[1]);
  const uu = ux * ux + uy * uy;
  const vv = vx * vx + vy * vy;
  const scale = Math.sqrt(Math.sqrt(uu) * Math.sqrt(vv));
  if (scale < 1e-9) return 0;
  const g = cross ? ux * vy - uy * vx : ux * vx + uy * vy;
  const f = g / scale;
  if (grad) {
    // f = g / S with S = sqrt(|u| |v|): ∂f = ∂g / S - (f / 2) (u / |u|² + v / |v|²).
    const [gux, guy, gvx, gvy] = cross ? [vy, -vx, -uy, ux] : [vx, vy, ux, uy];
    segmentGrad(grad, row, s[0], gux / scale - (f / 2) * (ux / uu), guy / scale - (f / 2) * (uy / uu));
    segmentGrad(grad, row, s[1], gvx / scale - (f / 2) * (vx / vv), gvy / scale - (f / 2) * (vy / vv));
  }
  return f;
}

/**
 * Write `c`'s residual rows for anchor coordinates `x` (interleaved x, y) into
 * `out` at `at`, and hand each nonzero derivative to `grad` when given.
 */
export function writeResiduals(
  c: PathConstraint,
  x: ArrayLike<number>,
  frame: ConstraintFrame,
  out: Float64Array,
  at: number,
  grad?: Grad,
): void {
  switch (c.kind) {
    case 'fixed': return;
    case 'horizontal':
      out[at] = -frame.sin * dx(x, c.segment) + frame.cos * dy(x, c.segment);
      if (grad) segmentGrad(grad, 0, c.segment, -frame.sin, frame.cos);
      return;
    case 'vertical':
      out[at] = frame.cos * dx(x, c.segment) + frame.sin * dy(x, c.segment);
      if (grad) segmentGrad(grad, 0, c.segment, frame.cos, frame.sin);
      return;
    case 'length':
      out[at] = lengthOf(x, c.segment, grad, 0, 1) - c.length;
      return;
    case 'coincident':
      out[at] = dx(x, c.anchors);
      out[at + 1] = dy(x, c.anchors);
      if (grad) {
        segmentGrad(grad, 0, c.anchors, 1, 0);
        segmentGrad(grad, 1, c.anchors, 0, 1);
      }
      return;
    case 'equalLength':
      out[at] = lengthOf(x, c.segments[0], grad, 0, 1) - lengthOf(x, c.segments[1], grad, 0, -1);
      return;
    case 'parallel':
      out[at] = angleRow(x, c.segments, true, grad, 0);
      return;
    case 'perpendicular':
      out[at] = angleRow(x, c.segments, false, grad, 0);
  }
}
