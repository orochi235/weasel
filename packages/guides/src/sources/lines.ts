import type { Bounds, Locus, SnapCollect, SnapProbeAt } from '@weasel-js/core';

type Point = { x: number; y: number };
type Axis = 'x' | 'y';

/** The line `axis = offset` as a locus, through `near` on the other axis. */
export function axisLine(axis: Axis, offset: number, near: Point): Locus {
  return axis === 'x'
    ? { at: { x: offset, y: near.y }, dirs: [{ x: 0, y: 1 }] }
    : { at: { x: near.x, y: offset }, dirs: [{ x: 1, y: 0 }] };
}

/** The subject's box where the unsnapped gesture puts it, from its `box.min`
 *  and `box.max` probes, or null when the query carries neither. */
export function probeBox(probes: readonly SnapProbeAt[]): Bounds | null {
  const min = probes.find((p) => p.id === 'box.min');
  const max = probes.find((p) => p.id === 'box.max');
  if (!min || !max) return null;
  return { x: min.at.x, y: min.at.y, width: max.at.x - min.at.x, height: max.at.y - min.at.y };
}

/** How far the resolved move `delta` carries a probe from where `q` saw it. */
export function landedShift(q: Pick<SnapCollect, 'delta0'>, delta: Point): Point {
  return { x: delta.x - q.delta0.x, y: delta.y - q.delta0.y };
}
