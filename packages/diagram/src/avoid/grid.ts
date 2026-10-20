/**
 * Where a search may turn: the interesting points of its window — every
 * inflated obstacle's corners, the leg's own ends and stops, and the middle of
 * each channel between two facing obstacles. Lines cast from these points are
 * what `visibility.ts` builds the sparse graph from.
 */
import type { Vec2 } from '@weasel-js/core/math';
import type { Box } from './types';

const EPS = 1e-7;

/** The box around `points` grown by `margin`, which a search first looks in. */
export function searchWindow(points: readonly Vec2[], margin: number): Box {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of points) {
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x);
    y1 = Math.max(y1, p.y);
  }
  return { x: x0 - margin, y: y0 - margin, width: x1 - x0 + 2 * margin, height: y1 - y0 + 2 * margin };
}

/** Whether `inner` lies within `outer`. */
export const within = (inner: Box, outer: Box): boolean =>
  inner.x >= outer.x && inner.y >= outer.y
  && inner.x + inner.width <= outer.x + outer.width && inner.y + inner.height <= outer.y + outer.height;

/** Whether `p` lies inside `box` or on its edge. */
const holds = (box: Box, p: Vec2): boolean =>
  p.x >= box.x - EPS && p.x <= box.x + box.width + EPS && p.y >= box.y - EPS && p.y <= box.y + box.height + EPS;

/** The first index of `sorted`, ordered by `key`, whose key is past `v`. */
function firstPast(sorted: readonly Box[], v: number, key: (b: Box) => number): number {
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (key(sorted[mid]!) <= v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

/** The middle of each channel along one axis: between each box and the
 *  nearest one past it that faces it across that axis, at the middle of the
 *  stretch they face each other over. */
function channelMiddles(boxes: readonly Box[], axis: 'x' | 'y'): Vec2[] {
  const lo = (b: Box) => (axis === 'x' ? b.x : b.y);
  const size = (b: Box) => (axis === 'x' ? b.width : b.height);
  const crossLo = (b: Box) => (axis === 'x' ? b.y : b.x);
  const crossHi = (b: Box) => (axis === 'x' ? b.y + b.height : b.x + b.width);
  const sorted = [...boxes].sort((a, b) => lo(a) - lo(b));
  const out: Vec2[] = [];
  for (const a of sorted) {
    const end = lo(a) + size(a);
    let k = firstPast(sorted, end, lo);
    let nearest: Box | null = null;
    for (; k < sorted.length && nearest === null; k++) {
      const b = sorted[k]!;
      if (crossLo(a) < crossHi(b) && crossLo(b) < crossHi(a)) nearest = b;
    }
    if (nearest === null) continue;
    const along = (end + lo(nearest)) / 2;
    const across = (Math.max(crossLo(a), crossLo(nearest)) + Math.min(crossHi(a), crossHi(nearest))) / 2;
    out.push(axis === 'x' ? { x: along, y: across } : { x: across, y: along });
  }
  return out;
}

/** The interesting points inside `window` for a search among `boxes`, the
 *  inflated obstacles near it, whose own ends and stops are `ends`. The ends
 *  are always kept. */
export function interestingPoints(window: Box, boxes: readonly Box[], ends: readonly Vec2[]): Vec2[] {
  const out: Vec2[] = [...ends];
  for (const b of boxes) {
    for (const p of [
      { x: b.x, y: b.y }, { x: b.x + b.width, y: b.y },
      { x: b.x, y: b.y + b.height }, { x: b.x + b.width, y: b.y + b.height },
    ]) if (holds(window, p)) out.push(p);
  }
  for (const p of [...channelMiddles(boxes, 'x'), ...channelMiddles(boxes, 'y')]) if (holds(window, p)) out.push(p);
  return out;
}
