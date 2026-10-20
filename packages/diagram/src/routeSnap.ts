/**
 * Snapping for a route-handle drag: a dragged point lines up with the stops
 * beside it and with a port's axis, and a guide shows each alignment.
 */
import type { Vec2 } from '@weasel-js/core/math';
import type { Port } from './types';

/** A coordinate a drag may snap to on one or both axes, and the point the guide runs from. */
export interface SnapTarget {
  x?: number;
  y?: number;
  at: Vec2;
}

/** A snapped point, and a guide from each target it lined up with. */
export interface Snapped {
  point: Vec2;
  guides: (readonly [Vec2, Vec2])[];
}

/** A stop as a target on both axes. */
export const stopTarget = (p: Vec2): SnapTarget => ({ x: p.x, y: p.y, at: p });

/** A port as a target along its axis only: a port facing east or west lines
 *  up on y, one facing north or south on x, and one facing nowhere on both. */
export function portTarget(port: Port): SnapTarget {
  const n = port.normal;
  if (n === null) return stopTarget(port.point);
  return Math.abs(n.x) >= Math.abs(n.y) ? { y: port.point.y, at: port.point } : { x: port.point.x, at: port.point };
}

/** The target on `axis` nearest `value` within `tolerance`, or null. */
function nearest(targets: readonly SnapTarget[], axis: 'x' | 'y', value: number, tolerance: number): SnapTarget | null {
  let best: SnapTarget | null = null;
  let gap = tolerance;
  for (const t of targets) {
    const v = t[axis];
    if (v === undefined || Math.abs(v - value) > gap) continue;
    gap = Math.abs(v - value);
    best = t;
  }
  return best;
}

/** `p` snapped on each axis in `axes` to the nearest target within `tolerance` world units. */
export function snapPoint(
  p: Vec2,
  targets: readonly SnapTarget[],
  tolerance: number,
  axes: { x: boolean; y: boolean } = { x: true, y: true },
): Snapped {
  const tx = axes.x ? nearest(targets, 'x', p.x, tolerance) : null;
  const ty = axes.y ? nearest(targets, 'y', p.y, tolerance) : null;
  const point = { x: tx?.x ?? p.x, y: ty?.y ?? p.y };
  const guides: (readonly [Vec2, Vec2])[] = [];
  if (tx !== null) guides.push([tx.at, point]);
  if (ty !== null) guides.push([ty.at, point]);
  return { point, guides };
}
