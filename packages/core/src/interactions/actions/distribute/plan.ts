import type { DistributeAxis, DistributeMode } from './distribute';

/** Axis-aligned box a distribute plan is computed from. Pass the *visual*
 *  bounds (`visualBoundsViaDescriptor`) — a rotated shape's ink is wider than
 *  the box it was posed in, and both the stride and the gap divide by size. */
export interface DistributeBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Where each box's min edge along `axis` should land. Result is parallel to
 * `bounds`. The two extreme boxes stay put in both modes; `'centers'` spaces
 * centers evenly between them, `'gaps'` spaces the empty runs evenly.
 *
 * Callers translate by `target - currentMin`, so the plan is expressed in the
 * same frame as the bounds it was given.
 */
export function planDistribute(
  bounds: readonly DistributeBounds[],
  axis: DistributeAxis,
  mode: DistributeMode,
): number[] {
  const min = (b: DistributeBounds): number => (axis === 'x' ? b.x : b.y);
  const size = (b: DistributeBounds): number => (axis === 'x' ? b.width : b.height);
  const center = (b: DistributeBounds): number => min(b) + size(b) / 2;

  const order = bounds.map((b, i) => ({ b, i })).sort((p, q) => min(p.b) - min(q.b));
  const n = order.length;
  const targets = new Array<number>(n);
  if (n === 0) return targets;
  const first = order[0].b;
  const last = order[n - 1].b;

  if (mode === 'centers') {
    const c0 = center(first);
    const stride = (center(last) - c0) / (n - 1);
    for (let i = 0; i < n; i++) {
      const { b, i: orig } = order[i];
      targets[orig] = c0 + stride * i - size(b) / 2;
    }
    return targets;
  }

  const span = (min(last) + size(last)) - min(first);
  let sumSizes = 0;
  for (const { b } of order) sumSizes += size(b);
  const gap = (span - sumSizes) / (n - 1);
  let cursor = min(first);
  for (let i = 0; i < n; i++) {
    const { b, i: orig } = order[i];
    targets[orig] = cursor;
    cursor += size(b) + gap;
  }
  return targets;
}
