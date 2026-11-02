/**
 * A path's outline walked as straight segments, in pen order: what
 * `strokeHitTest` tests each capsule of, whole or limited to a span.
 */
import type { LengthSpan } from './along/lengthTable';
import { DEFAULT_FLATTEN_TOLERANCE } from './flatten';
import type { Path, RectPath } from './path';
import { originOf } from './paths/pathOrigin';
import { extractPolylines } from './tessellate/polyline';

/** Visits one segment; answering true ends the walk. */
export type SegmentVisit = (ax: number, ay: number, bx: number, by: number) => boolean;

const WHOLE: LengthSpan = { from: 0, to: Infinity };

/**
 * Does `visit` answer true for any outline segment — every edge of a rect,
 * closing edges of closed subpaths included? With `span`, only the stretch
 * between those pen-order lengths counts: subpaths in authored order, each
 * from its first point, a closed one's closing edge last, the lift between
 * them covering no distance. A segment the span cuts is visited as its
 * covered part.
 */
export function someSegment(
  path: Path, tolerance: number | undefined, span: LengthSpan | undefined, visit: SegmentVisit,
): boolean {
  if (path.kind === 'rect') return someRectEdge(path, span, visit);
  const { from, to } = span ?? WHOLE;
  if (!(from < to)) return false;
  const o = originOf(path);
  let s = 0;
  for (const pl of extractPolylines(path, { flattenTolerance: tolerance ?? DEFAULT_FLATTEN_TOLERANCE })) {
    const p = pl.points;
    const n = p.length / 2;
    const last = pl.closed && n >= 2 ? n : n - 1;
    for (let i = 0; i < last; i++) {
      const j = (i + 1) % n;
      const ax = p[i * 2] + o.x, ay = p[i * 2 + 1] + o.y;
      const bx = p[j * 2] + o.x, by = p[j * 2 + 1] + o.y;
      const s0 = s;
      s += Math.hypot(bx - ax, by - ay);
      if (s <= from) continue;
      if (s0 >= to) return false;
      if (visitCut(ax, ay, bx, by, s0, s, from, to, visit)) return true;
    }
  }
  return false;
}

/** {@link someSegment} for a rect, in `rectToContour`'s order: from the
 *  top-left corner along the top edge, the left edge closing it. */
function someRectEdge(rect: RectPath, span: LengthSpan | undefined, visit: SegmentVisit): boolean {
  const { x, y, width: w, height: h } = rect;
  if (span === undefined) {
    return visit(x, y, x + w, y) || visit(x + w, y, x + w, y + h)
      || visit(x + w, y + h, x, y + h) || visit(x, y + h, x, y);
  }
  const { from, to } = span;
  if (!(from < to)) return false;
  let s = 0;
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) & 3;
    const ax = i === 1 || i === 2 ? x + w : x, ay = i >= 2 ? y + h : y;
    const bx = j === 1 || j === 2 ? x + w : x, by = j >= 2 ? y + h : y;
    const s0 = s;
    s += Math.abs(i & 1 ? h : w);
    if (s <= from) continue;
    if (s0 >= to) return false;
    if (visitCut(ax, ay, bx, by, s0, s, from, to, visit)) return true;
  }
  return false;
}

/** Visit the part of segment a→b, which runs from pen length `s0` to `s1`, inside [`from`, `to`]. */
function visitCut(
  ax: number, ay: number, bx: number, by: number, s0: number, s1: number, from: number, to: number,
  visit: SegmentVisit,
): boolean {
  const len = s1 - s0;
  const t0 = len > 0 ? Math.max(0, (from - s0) / len) : 0;
  const t1 = len > 0 ? Math.min(1, (to - s0) / len) : 1;
  return visit(ax + (bx - ax) * t0, ay + (by - ay) * t0, ax + (bx - ax) * t1, ay + (by - ay) * t1);
}
