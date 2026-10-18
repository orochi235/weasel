/**
 * The points a constraint solve reads, and the coordinate vector it works in:
 * anchors, then each anchor's handles as offsets from it (see `ResidualSpace`).
 */

import { handleAt, spaceSize } from './residuals';
import { constraintFits, type PathConstraint } from './types';

/** An anchor the solver reads and writes, with its handles where it has them. */
export interface ConstraintPoint {
  x: number;
  y: number;
  inHandle?: { x: number; y: number };
  outHandle?: { x: number; y: number };
}

/** One handle of an anchor. */
export interface HandleRef {
  anchor: number;
  side: 'in' | 'out';
}

/**
 * Whether `c` can be solved over `points`: every anchor it names exists, and
 * a `tangent` anchor has both handles.
 */
export function constraintApplies(c: PathConstraint, points: readonly ConstraintPoint[]): boolean {
  if (!constraintFits(c, points.length)) return false;
  if (c.kind !== 'tangent') return true;
  const a = points[c.anchor];
  return !!a.inHandle && !!a.outHandle;
}

/** `points` as a coordinate vector, each anchor at `at(i)` — its reference, say — and its handles riding with it. */
export function pack(points: readonly ConstraintPoint[], at: (i: number) => ConstraintPoint = (i) => points[i]): Float64Array {
  const n = points.length;
  const x = new Float64Array(spaceSize(n));
  points.forEach((p, i) => {
    const place = at(i);
    x[2 * i] = place.x;
    x[2 * i + 1] = place.y;
    const h = handleAt(n, i);
    if (p.inHandle) {
      x[h] = p.inHandle.x - p.x;
      x[h + 1] = p.inHandle.y - p.y;
    }
    if (p.outHandle) {
      x[h + 2] = p.outHandle.x - p.x;
      x[h + 3] = p.outHandle.y - p.y;
    }
  });
  return x;
}

/** The points `x` holds, each with the handles its counterpart in `like` has. */
export function unpack(x: Float64Array, like: readonly ConstraintPoint[]): ConstraintPoint[] {
  const n = like.length;
  return like.map((p, i) => {
    const out: ConstraintPoint = { x: x[2 * i], y: x[2 * i + 1] };
    const h = handleAt(n, i);
    if (p.inHandle) out.inHandle = { x: out.x + x[h], y: out.y + x[h + 1] };
    if (p.outHandle) out.outHandle = { x: out.x + x[h + 2], y: out.y + x[h + 3] };
    return out;
  });
}
