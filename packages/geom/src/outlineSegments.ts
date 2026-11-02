/**
 * A path's outline walked as straight segments: what `strokeHitTest` tests
 * each capsule of, whole or limited to a pen-order span.
 */
import { DEFAULT_FLATTEN_TOLERANCE } from './flatten';
import type { Path } from './path';
import { flatSubpaths } from './pathSubpaths';
import { originOf } from './paths/pathOrigin';
import { extractPolylines } from './tessellate/polyline';

/** Visits one segment; answering true ends the walk. */
export type SegmentVisit = (ax: number, ay: number, bx: number, by: number) => boolean;

/** Does `visit` answer true for any outline segment — every edge of a rect,
 *  closing edges of closed subpaths included? */
export function someSegment(path: Path, tolerance: number | undefined, visit: SegmentVisit): boolean {
  if (path.kind === 'rect') {
    const { x: rx, y: ry, width: w, height: h } = path;
    return visit(rx, ry, rx + w, ry) || visit(rx + w, ry, rx + w, ry + h)
      || visit(rx + w, ry + h, rx, ry + h) || visit(rx, ry + h, rx, ry);
  }
  const { closed, open } = flatSubpaths(path, tolerance ?? DEFAULT_FLATTEN_TOLERANCE);
  const run = (sub: readonly number[], wrap: boolean): boolean => {
    const n = sub.length;
    const last = wrap ? n : n - 2;
    for (let i = 0; i < last; i += 2) {
      const j = (i + 2) % n;
      if (visit(sub[i], sub[i + 1], sub[j], sub[j + 1])) return true;
    }
    return false;
  };
  return closed.some((sub) => run(sub, true)) || open.some((sub) => run(sub, false));
}

/**
 * {@link someSegment} over only the stretch of the outline between pen-order
 * lengths `from` and `to`: subpaths in authored order, each from its first
 * point, a closed one's closing edge last, the lift between them covering no
 * distance. A segment the span cuts is visited as its covered part.
 */
export function someSegmentInSpan(
  path: Path, tolerance: number | undefined, span: { from: number; to: number }, visit: SegmentVisit,
): boolean {
  const { from, to } = span;
  if (!(from < to)) return false;
  const o = path.kind === 'polygon' ? originOf(path) : { x: 0, y: 0 };
  let s = 0;
  for (const pl of extractPolylines(path, { flattenTolerance: tolerance ?? DEFAULT_FLATTEN_TOLERANCE })) {
    const p = pl.points;
    const n = p.length / 2;
    const last = pl.closed && n >= 2 ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const j = (i + 1) % n;
      const ax = p[i * 2] + o.x, ay = p[i * 2 + 1] + o.y;
      const bx = p[j * 2] + o.x, by = p[j * 2 + 1] + o.y;
      const len = Math.hypot(bx - ax, by - ay);
      const s0 = s;
      s += len;
      if (s <= from) continue;
      if (s0 >= to) return false;
      const t0 = len > 0 ? Math.max(0, (from - s0) / len) : 0;
      const t1 = len > 0 ? Math.min(1, (to - s0) / len) : 1;
      if (visit(ax + (bx - ax) * t0, ay + (by - ay) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1)) return true;
    }
  }
  return false;
}
