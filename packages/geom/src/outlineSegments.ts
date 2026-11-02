/**
 * A path's outline walked as straight segments, in pen order: what
 * `strokeHitTest` tests each capsule of, whole or limited to a span.
 */
import type { CurvePosition, CurveSpan } from './along/curvePosition';
import { pathLengthTable } from './along/pathTable';
import { DEFAULT_FLATTEN_TOLERANCE } from './flatten';
import type { Path, RectPath } from './path';
import { originOf } from './paths/pathOrigin';
import { polylineAtCurve, type PolylinePlace } from './tessellate/atCurve';
import { extractPolylines } from './tessellate/polyline';

/** Visits one segment; answering true ends the walk. */
export type SegmentVisit = (ax: number, ay: number, bx: number, by: number) => boolean;

/**
 * Does `visit` answer true for any outline segment — every edge of a rect,
 * closing edges of closed subpaths included? With `span`, only the stretch
 * between those curve positions counts, ended on the exact points there
 * however coarsely the outline is flattened: subpaths in authored order, each
 * from its first point, a closed one's closing edge last.
 */
export function someSegment(
  path: Path, tolerance: number | undefined, span: CurveSpan | undefined, visit: SegmentVisit,
): boolean {
  if (path.kind === 'rect') return someRectEdge(path, span, visit);
  const o = originOf(path);
  const polylines = extractPolylines(path, { flattenTolerance: tolerance ?? DEFAULT_FLATTEN_TOLERANCE });
  const runs = span ? pathLengthTable(path).runs : undefined;
  const first = span ? span.from.run : 0;
  const last = span ? Math.min(span.to.run, polylines.length - 1) : polylines.length - 1;
  for (let r = Math.max(first, 0); r <= last; r++) {
    const pl = polylines[r];
    const place = (at: CurvePosition): PolylinePlace => polylineAtCurve(pl, at.segment, at.t, runs?.[r]);
    const head = span && r === span.from.run ? place(span.from) : null;
    const tail = span && r === span.to.run ? place(span.to) : null;
    const from = head?.length ?? 0;
    const to = tail?.length ?? Infinity;
    if (!(from < to)) continue;
    const p = pl.points;
    const n = p.length / 2;
    const end = pl.closed && n >= 2 ? n : n - 1;
    let s = 0;
    for (let i = 0; i < end; i++) {
      const j = (i + 1) % n;
      const ax = p[i * 2], ay = p[i * 2 + 1];
      const bx = p[j * 2], by = p[j * 2 + 1];
      const s0 = s;
      s += Math.hypot(bx - ax, by - ay);
      if (head && s <= from) continue;
      if (tail && s0 >= to) break;
      const [x0, y0] = head && s0 < from ? [head.x, head.y] : [ax, ay];
      const [x1, y1] = tail && s > to ? [tail.x, tail.y] : [bx, by];
      if (visit(x0 + o.x, y0 + o.y, x1 + o.x, y1 + o.y)) return true;
    }
  }
  return false;
}

/** {@link someSegment} for a rect, in `rectToContour`'s order: from the
 *  top-left corner along the top edge, the left edge closing it. */
function someRectEdge(rect: RectPath, span: CurveSpan | undefined, visit: SegmentVisit): boolean {
  const { x, y, width: w, height: h } = rect;
  const cx = [x, x + w, x + w, x];
  const cy = [y, y, y + h, y + h];
  const lo = span ? span.from : { run: 0, segment: 0, t: 0 };
  const hi = span ? span.to : { run: 0, segment: 3, t: 1 };
  if (lo.run !== 0 || hi.run !== 0) return false;
  for (let i = Math.max(lo.segment, 0); i <= Math.min(hi.segment, 3); i++) {
    const j = (i + 1) & 3;
    const t0 = i === lo.segment ? lo.t : 0;
    const t1 = i === hi.segment ? hi.t : 1;
    if (!(t1 > t0) && lo.segment === hi.segment) return false;
    const at = (f: number): [number, number] => [cx[i] + (cx[j] - cx[i]) * f, cy[i] + (cy[j] - cy[i]) * f];
    if (visit(...at(t0), ...at(t1))) return true;
  }
  return false;
}
