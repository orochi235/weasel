import type { Locus, SnapCollect } from '@weasel-js/core';

type Point = { x: number; y: number };
type Axis = 'x' | 'y';

/** The line `axis = offset` as a locus, through `near` on the other axis. */
export function axisLine(axis: Axis, offset: number, near: Point): Locus {
  return axis === 'x'
    ? { at: { x: offset, y: near.y }, dirs: [{ x: 0, y: 1 }] }
    : { at: { x: near.x, y: offset }, dirs: [{ x: 1, y: 0 }] };
}

/** How far the resolved move `delta` carries a probe from where `q` saw it. */
export function landedShift(q: Pick<SnapCollect, 'delta0'>, delta: Point): Point {
  return { x: delta.x - q.delta0.x, y: delta.y - q.delta0.y };
}
