import type { Bounds } from '@weasel-js/core';
import type { Guide, SpacingGap } from '../types';

type Axis = 'x' | 'y';

const EPS = 1e-6;
const lo = (b: Bounds, a: Axis): number => (a === 'x' ? b.x : b.y);
const hi = (b: Bounds, a: Axis): number => (a === 'x' ? b.x + b.width : b.y + b.height);
const mid = (b: Bounds, a: Axis): number => (lo(b, a) + hi(b, a)) / 2;
const cross = (a: Axis): Axis => (a === 'x' ? 'y' : 'x');

/** The distances `measureDistances` found, ready for `createGuidesLayer`:
 *  `gaps` as its `getGaps`, `leaders` as its `getGuides`. */
export interface DistanceReadout {
  /** One measured distance per gap, labeled with its length when drawn. */
  gaps: SpacingGap[];
  /** Where a gap runs past the target, the line from the gap's end along the
   *  target's edge to the target, so the number reads as reaching it. */
  leaders: Guide[];
}

/**
 * The distances between two boxes, on each axis where they separate: for
 * `from` left of `to`, the gap from `from`'s right edge to `to`'s left. A gap
 * is drawn through the range the boxes share on the other axis, or through
 * `from`'s center when they share none, with a leader to `to`. When one box
 * holds the other on an axis and they overlap on the other, the inner box's
 * distances to the outer's two edges on that axis instead. An axis where the
 * boxes partly overlap, or meet flush, has no distance.
 */
export function measureDistances(from: Bounds, to: Bounds): DistanceReadout {
  const out: DistanceReadout = { gaps: [], leaders: [] };
  for (const axis of ['x', 'y'] as const) measureAxis(from, to, axis, out);
  return out;
}

function measureAxis(from: Bounds, to: Bounds, axis: Axis, out: DistanceReadout): void {
  const c = cross(axis);
  const sharedMin = Math.max(lo(from, c), lo(to, c));
  const sharedMax = Math.min(hi(from, c), hi(to, c));
  const shares = sharedMax - sharedMin > EPS;
  const push = (min: number, max: number, at: number): void => {
    if (max - min > EPS) out.gaps.push({ axis, min, max, at });
  };

  const before = hi(from, axis) <= lo(to, axis) + EPS;
  const after = hi(to, axis) <= lo(from, axis) + EPS;
  if (before || after) {
    const [min, max] = before ? [hi(from, axis), lo(to, axis)] : [hi(to, axis), lo(from, axis)];
    if (max - min <= EPS) return;
    const at = shares ? (sharedMin + sharedMax) / 2 : mid(from, c);
    push(min, max, at);
    if (!shares) {
      const edge = before ? lo(to, axis) : hi(to, axis);
      const span = at < lo(to, c) ? { min: at, max: lo(to, c) } : { min: hi(to, c), max: at };
      out.leaders.push({ id: `distance:${axis}`, axis, offset: edge, span });
    }
    return;
  }
  if (!shares) return;
  const [inner, outer] = lo(from, axis) >= lo(to, axis) - EPS && hi(from, axis) <= hi(to, axis) + EPS
    ? [from, to]
    : lo(to, axis) >= lo(from, axis) - EPS && hi(to, axis) <= hi(from, axis) + EPS
      ? [to, from]
      : [null, null];
  if (inner === null || outer === null) return;
  const at = mid(inner, c);
  push(lo(outer, axis), lo(inner, axis), at);
  push(hi(inner, axis), hi(outer, axis), at);
}
