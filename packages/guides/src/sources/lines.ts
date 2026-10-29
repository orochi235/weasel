import type { Bounds, Locus, SnapCollect, SnapFrame } from '@weasel-js/core';

type Point = { x: number; y: number };
type Axis = 'x' | 'y';

/** The line `axis = offset` as a locus, through `near` on the other axis. */
export function axisLine(axis: Axis, offset: number, near: Point): Locus {
  return axis === 'x'
    ? { at: { x: offset, y: near.y }, dirs: [{ x: 0, y: 1 }] }
    : { at: { x: near.x, y: offset }, dirs: [{ x: 1, y: 0 }] };
}

/** The line `axis = offset` of `frame`'s own coordinates as a world locus,
 *  through `near` (in the frame) on the other axis. */
export function frameLine(frame: SnapFrame, axis: Axis, offset: number, near: Point): Locus {
  const on = axis === 'x' ? { x: offset, y: near.y } : { x: near.x, y: offset };
  const at = frame.toWorld(on);
  const tip = frame.toWorld(axis === 'x' ? { x: offset, y: near.y + 1 } : { x: near.x + 1, y: offset });
  return { at, dirs: [{ x: tip.x - at.x, y: tip.y - at.y }] };
}

/** How far the resolved move `delta` carries a probe from where `q` saw it. */
export function landedShift(q: Pick<SnapCollect, 'delta0'>, delta: Point): Point {
  return { x: delta.x - q.delta0.x, y: delta.y - q.delta0.y };
}

/** The probe positions at which a side moving at `rate` per unit of the move
 *  has moved by `by`: the line normal to `rate`, `by / |rate|` from `near`. */
export function sideLine(near: Point, rate: Point, by: number): Locus {
  const k = by / (rate.x * rate.x + rate.y * rate.y);
  return { at: { x: near.x + rate.x * k, y: near.y + rate.y * k }, dirs: [{ x: -rate.y, y: rate.x }] };
}

/** Where the resolved move `delta` puts the subject's box: the session's
 *  answer, else `box` carried along as a move carries it. */
export function landedBox(q: Pick<SnapCollect, 'box' | 'boxAt' | 'delta0'>, delta: Point): Bounds | null {
  if (q.boxAt) return q.boxAt(delta);
  if (!q.box) return null;
  const shift = landedShift(q, delta);
  return { ...q.box, x: q.box.x + shift.x, y: q.box.y + shift.y };
}
