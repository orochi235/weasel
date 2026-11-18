import { settleWithinRounding } from '@weasel-js/core';
import type { DistributeAxis, DistributeMode } from './distribute';
import type { Rect } from '@weasel-js/geom';

/**
 * Where each box's min edge along `axis` should land. Result is parallel to
 * `bounds`. The two extreme boxes stay put in both modes; `'centers'` spaces
 * centers evenly between the outermost two centers, `'gaps'` spaces the empty
 * runs evenly between the boxes that start first and last.
 *
 * Callers translate by `target - currentMin`, so the plan is expressed in the
 * same frame as the bounds it was given. A target within rounding of where a
 * box already starts is where it starts, so a distributed selection plans no
 * move when distributed again.
 */
export function planDistribute(
  bounds: readonly Rect[],
  axis: DistributeAxis,
  mode: DistributeMode,
): number[] {
  const min = (b: Rect): number => (axis === 'x' ? b.x : b.y);
  const size = (b: Rect): number => (axis === 'x' ? b.width : b.height);
  const center = (b: Rect): number => min(b) + size(b) / 2;

  const key = mode === 'centers' ? center : min;
  const order = bounds.map((b, i) => ({ b, i })).sort((p, q) => key(p.b) - key(q.b));
  const n = order.length;
  const targets = new Array<number>(n);
  if (n === 0) return targets;
  const first = order[0].b;
  const last = order[n - 1].b;

  let scale = 0;
  for (const { b } of order) scale = Math.max(scale, Math.abs(min(b)), Math.abs(min(b) + size(b)));
  const settle = (b: Rect, target: number): number => settleWithinRounding(min(b), target, scale);

  if (mode === 'centers') {
    const c0 = center(first);
    const stride = n === 1 ? 0 : (center(last) - c0) / (n - 1);
    for (let i = 0; i < n; i++) {
      const { b, i: orig } = order[i];
      targets[orig] = settle(b, c0 + stride * i - size(b) / 2);
    }
    return targets;
  }

  const span = (min(last) + size(last)) - min(first);
  let sumSizes = 0;
  for (const { b } of order) sumSizes += size(b);
  const gap = n === 1 ? 0 : (span - sumSizes) / (n - 1);
  let cursor = min(first);
  for (let i = 0; i < n; i++) {
    const { b, i: orig } = order[i];
    targets[orig] = settle(b, cursor);
    cursor += size(b) + gap;
  }
  return targets;
}
