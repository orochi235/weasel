/**
 * Whether constraints hold for a set of points, and whether a solve made them
 * hold only by collapsing what they measure.
 */

import { constraintApplies, pack, type ConstraintPoint } from './points';
import { frameAt, nearestParam, residualRows, writeResiduals } from './residuals';
import type { AnchorPair, PathConstraint } from './types';

/** The residual, in the path's units, under which a constraint counts as holding. */
export const CONSTRAINT_TOLERANCE = 1e-3;

/** The anchor pairs `c` measures as segments. */
function segmentsOf(c: PathConstraint): AnchorPair[] {
  switch (c.kind) {
    case 'fixed':
    case 'tangent':
    case 'coincident': return [];
    case 'horizontal':
    case 'vertical':
    case 'onPath':
    case 'length': return [c.segment];
    default: return [...c.segments];
  }
}

const handleLength = (p: ConstraintPoint, h: { x: number; y: number } | undefined) =>
  (h ? Math.hypot(h.x - p.x, h.y - p.y) : 0);

/**
 * Constraints the solve satisfied only by shrinking what they measure to a
 * point — horizontal and vertical on one segment both hold once its ends
 * meet, and a tangent holds once a handle has no length. That is a conflict,
 * not a solution. A pair a constraint means to join, by `coincident` or a
 * zero `length`, is exempt.
 */
export function collapsedBy(
  from: readonly ConstraintPoint[],
  to: readonly ConstraintPoint[],
  constraints: readonly PathConstraint[],
  skipped: ReadonlySet<number>,
): number[] {
  const key = ([a, b]: AnchorPair) => (a < b ? `${a},${b}` : `${b},${a}`);
  const joined = new Set(constraints.flatMap((c) =>
    c.kind === 'coincident' ? [key(c.anchors)]
      : c.kind === 'length' && c.length <= CONSTRAINT_TOLERANCE ? [key(c.segment)] : []));
  const len = (p: readonly ConstraintPoint[], [a, b]: AnchorPair) => Math.hypot(p[b].x - p[a].x, p[b].y - p[a].y);
  const shrank = (was: number, now: number) => was > 10 * CONSTRAINT_TOLERANCE && now <= CONSTRAINT_TOLERANCE;
  const out: number[] = [];
  constraints.forEach((c, i) => {
    if (skipped.has(i) || !constraintApplies(c, from)) return;
    if (c.kind === 'tangent') {
      const [a, b] = [from[c.anchor], to[c.anchor]];
      if (shrank(handleLength(a, a.inHandle), handleLength(b, b.inHandle))
        || shrank(handleLength(a, a.outHandle), handleLength(b, b.outHandle))) out.push(i);
      return;
    }
    if (segmentsOf(c).some((s) => !joined.has(key(s)) && shrank(len(from, s), len(to, s)))) out.push(i);
  });
  return out;
}

/** Options for {@link unsatisfiedConstraints}. */
export interface UnsatisfiedConstraintsOptions {
  axisAngle?: number;
  /** A frame per constraint, by index, over `axisAngle`. */
  axisAngles?: readonly (number | undefined)[];
  /** Where a `fixed` anchor belongs. Absent, a `fixed` constraint always holds. */
  reference?: readonly (ConstraintPoint | undefined)[];
  /** Default {@link CONSTRAINT_TOLERANCE}. */
  tolerance?: number;
}

/**
 * Indices of the constraints that do not hold for `points`: a residual past
 * the tolerance, an anchor index the points do not have, or a tangent on an
 * anchor missing a handle.
 */
export function unsatisfiedConstraints(
  points: readonly ConstraintPoint[],
  constraints: readonly PathConstraint[],
  opts: UnsatisfiedConstraintsOptions = {},
): number[] {
  const { tolerance = CONSTRAINT_TOLERANCE, reference } = opts;
  const spaceOf = (i: number) => ({ frame: frameAt(opts.axisAngles?.[i] ?? opts.axisAngle), count: points.length });
  const packed = pack(points);
  // One slot past the points for an `onPath` parameter, set to the nearest point's each time.
  const x = new Float64Array(packed.length + 1);
  x.set(packed);
  const param = packed.length;
  const r = new Float64Array(2);
  const out: number[] = [];
  constraints.forEach((c, i) => {
    if (!constraintApplies(c, points)) {
      out.push(i);
      return;
    }
    if (c.kind === 'fixed') {
      const at = reference?.[c.anchor];
      const p = points[c.anchor];
      if (at && Math.hypot(at.x - p.x, at.y - p.y) > tolerance) out.push(i);
      return;
    }
    if (c.kind === 'onPath') x[param] = nearestParam(c, x, points.length);
    writeResiduals(c, x, spaceOf(i), r, 0, undefined, param);
    for (let k = 0; k < residualRows(c); k++) {
      if (Math.abs(r[k]) > tolerance) {
        out.push(i);
        return;
      }
    }
  });
  return out;
}
