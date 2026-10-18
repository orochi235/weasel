/**
 * Each constraint as residual rows: numbers that are all zero exactly when it
 * holds. Every row is in the path's units, so one tolerance reads them all.
 * Each row's derivatives are analytic, handed out one nonzero at a time.
 */

import { nearestOnCubic } from '../nearest';
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

/**
 * Where a solve keeps its coordinates. `x` holds every anchor's position,
 * interleaved, then every anchor's in and out handle as offsets from it, so a
 * handle rides with its anchor and a constraint on handles reads only them.
 */
export interface ResidualSpace {
  frame: ConstraintFrame;
  /** Anchors. */
  count: number;
}

/** Where anchor `i`'s in handle offset starts in a space of `count` anchors; its out handle follows. */
export const handleAt = (count: number, i: number): number => 2 * count + 4 * i;

/** Coordinates a space of `count` anchors holds. */
export const spaceSize = (count: number): number => 6 * count;

/** Takes one derivative: of residual row `row` (counted from the constraint's first) by coordinate `v`. */
export type Grad = (row: number, v: number, d: number) => void;

/** How many residual rows `c` writes. */
export function residualRows(c: PathConstraint): number {
  return c.kind === 'coincident' || c.kind === 'onPath' ? 2 : c.kind === 'fixed' ? 0 : 1;
}

/** The cubic from anchor `a` to anchor `b` of `x`, by `a`'s out handle and `b`'s in handle: [x0, y0, … x3, y3]. */
function segmentCubic(x: ArrayLike<number>, count: number, [a, b]: AnchorPair): number[] {
  const out = handleAt(count, a) + 2;
  const inn = handleAt(count, b);
  return [
    x[2 * a], x[2 * a + 1],
    x[2 * a] + x[out], x[2 * a + 1] + x[out + 1],
    x[2 * b] + x[inn], x[2 * b + 1] + x[inn + 1],
    x[2 * b], x[2 * b + 1],
  ];
}

/** The parameter of the point on `c`'s segment nearest its anchor, in `x`. */
export function nearestParam(c: PathConstraint & { kind: 'onPath' }, x: ArrayLike<number>, count: number): number {
  const q = segmentCubic(x, count, c.segment);
  return nearestOnCubic(x[2 * c.anchor], x[2 * c.anchor + 1], q[0], q[1], q[2], q[3], q[4], q[5], q[6], q[7]).t;
}

/** The anchor less the point at parameter `x[param]` on the segment, as two rows. */
function onPathRows(
  c: PathConstraint & { kind: 'onPath' },
  x: ArrayLike<number>,
  count: number,
  out: Float64Array,
  at: number,
  grad: Grad | undefined,
  param: number,
): void {
  const t = x[param];
  const s = 1 - t;
  const q = segmentCubic(x, count, c.segment);
  const w = [s * s * s, 3 * s * s * t, 3 * s * t * t, t * t * t];
  for (let k = 0; k < 2; k++) {
    out[at + k] = x[2 * c.anchor + k] - (w[0] * q[k] + w[1] * q[2 + k] + w[2] * q[4 + k] + w[3] * q[6 + k]);
  }
  if (!grad) return;
  const [a, b] = c.segment;
  for (let k = 0; k < 2; k++) {
    grad(k, 2 * c.anchor + k, 1);
    grad(k, 2 * a + k, -(w[0] + w[1]));
    grad(k, 2 * b + k, -(w[2] + w[3]));
    grad(k, handleAt(count, a) + 2 + k, -w[1]);
    grad(k, handleAt(count, b) + k, -w[2]);
    grad(k, param, -(3 * s * s * (q[2 + k] - q[k]) + 6 * s * t * (q[4 + k] - q[2 + k]) + 3 * t * t * (q[6 + k] - q[4 + k])));
  }
}

/**
 * The angle between anchor `i`'s in handle and its out handle turned round,
 * times the geometric mean of their lengths: zero exactly when they point
 * apart along one line. Zero when either has no length.
 */
function tangentRow(x: ArrayLike<number>, count: number, i: number, grad: Grad | undefined): number {
  const h = handleAt(count, i);
  const px = x[h];
  const py = x[h + 1];
  const qx = x[h + 2];
  const qy = x[h + 3];
  const pp = px * px + py * py;
  const qq = qx * qx + qy * qy;
  const scale = Math.sqrt(Math.sqrt(pp) * Math.sqrt(qq));
  if (scale < 1e-9) return 0;
  const theta = Math.atan2(-(px * qy - py * qx), -(px * qx + py * qy));
  if (grad) {
    // r = θ L: ∂θ/∂p = (py, -px) / |p|², ∂θ/∂q = (-qy, qx) / |q|², ∂L = (L / 2) (p / |p|², q / |q|²).
    const k = theta / 2;
    grad(0, h, scale * (py / pp + (k * px) / pp));
    grad(0, h + 1, scale * (-px / pp + (k * py) / pp));
    grad(0, h + 2, scale * (-qy / qq + (k * qx) / qq));
    grad(0, h + 3, scale * (qx / qq + (k * qy) / qq));
  }
  return theta * scale;
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
 * Write `c`'s residual rows for coordinates `x`, laid out as `space` says, into
 * `out` at `at`, and hand each nonzero derivative to `grad` when given. An
 * `onPath` constraint reads its parameter from `x[param]`.
 */
export function writeResiduals(
  c: PathConstraint,
  x: ArrayLike<number>,
  space: ResidualSpace,
  out: Float64Array,
  at: number,
  grad?: Grad,
  param = -1,
): void {
  const { frame } = space;
  switch (c.kind) {
    case 'fixed': return;
    case 'onPath':
      onPathRows(c, x, space.count, out, at, grad, param);
      return;
    case 'tangent':
      out[at] = tangentRow(x, space.count, c.anchor, grad);
      return;
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
