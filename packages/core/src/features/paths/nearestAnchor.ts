/**
 * Anchor lookup across several paths, measured on screen: which existing
 * anchor is nearest a point, and whether it ends an open subpath. Feeds the
 * pen's anchor snapping and its pick-up of an open path's endpoint.
 */

import { scaleDelta, type Scale2 } from 'core/viewport/pxExtent';
import { pathToAnchors, type PenAnchor } from './anchors';
import type { PolygonPath } from './types';

/** An existing anchor found near a point. */
export interface PathAnchorHit {
  /** The id the path was supplied under. */
  id: string;
  /** Subpath index, then anchor index within that subpath. */
  sub: number;
  idx: number;
  x: number;
  y: number;
  /** Which end of an open subpath this anchor is, or null when it is an
   *  interior anchor or its subpath is closed. A lone anchor reads `'last'`. */
  end: 'first' | 'last' | null;
}

/**
 * The anchor nearest `point` within a screen-space circle of radius `px`,
 * across every subpath of every path in `paths`. Paths and `point` share one
 * world frame; `scale` is the view's, so the radius stays round under
 * non-uniform zoom. `accept` narrows the candidates (endpoints only, say).
 * Ties go to the earlier path, so pass paths front-to-back.
 */
export function nearestPathAnchor(
  paths: Iterable<{ id: string; path: PolygonPath }>,
  point: { x: number; y: number },
  px: number,
  scale: Scale2,
  accept?: (hit: PathAnchorHit) => boolean,
): PathAnchorHit | null {
  let best: PathAnchorHit | null = null;
  let bestD2 = px * px;
  for (const { id, path } of paths) {
    const { anchors, closed } = pathToAnchors(path);
    for (let sub = 0; sub < anchors.length; sub++) {
      const list = anchors[sub];
      for (let idx = 0; idx < list.length; idx++) {
        const a = list[idx];
        const s = scaleDelta(a.x - point.x, a.y - point.y, scale);
        const d2 = s.x * s.x + s.y * s.y;
        if (d2 > bestD2 || (best !== null && d2 === bestD2)) continue;
        const end = closed[sub]
          ? null
          : idx === list.length - 1 ? 'last' : idx === 0 ? 'first' : null;
        const hit: PathAnchorHit = { id, sub, idx, x: a.x, y: a.y, end };
        if (accept && !accept(hit)) continue;
        best = hit;
        bestD2 = d2;
      }
    }
  }
  return best;
}

/** Reverse a subpath's direction without changing its shape: the anchor
 *  order flips and each anchor's in and out handles trade places. */
export function reverseAnchors<A extends PenAnchor>(anchors: readonly A[]): A[] {
  return anchors.map((a) => {
    const { inHandle, outHandle, ...rest } = a;
    const r = { ...rest } as A;
    if (outHandle) r.inHandle = { ...outHandle };
    if (inHandle) r.outHandle = { ...inHandle };
    return r;
  }).reverse();
}
