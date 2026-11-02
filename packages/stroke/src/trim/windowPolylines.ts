import { closingAnchor, type CurvePosition, type CurveSpan, type LengthRun } from '@weasel-js/geom';
import { type Polyline, polylineAtCurve, trimPolyline } from '@weasel-js/geom/tessellate';
import { polylinesLength } from '../tessellate/dash';

const EPS = 1e-9;

/** One visible run of a trimmed stroke. */
export interface WindowedRun {
  /** Open wherever the window cut it, with widths, offsets and anchor params
   *  interpolated at the cuts; a closed subpath the window covers whole stays closed. */
  polyline: Polyline;
  /** Taken from a closed subpath, so it takes no start or end marker. */
  fromClosed: boolean;
  /** How far along its subpath the run starts, in the polyline's own measure: the
   *  dash phase that keeps a pattern where the untrimmed stroke puts it. 0 when uncut at the start. */
  dashPhase: number;
}

/**
 * The parts of `polylines` that `span` draws, one run per subpath it touches,
 * in pen order, each cut on the exact curve point its position names. `runs`
 * is the path's `pathLengthTable` runs, for the curves' control points; the
 * polylines may be any flattening of that path, or a straight-edged copy of it
 * moved elsewhere. A run the window leaves uncut is the input polyline itself.
 */
export function windowPolylines(
  polylines: readonly Polyline[], span: CurveSpan, runs?: readonly LengthRun[],
): WindowedRun[] {
  const out: WindowedRun[] = [];
  for (let r = Math.max(span.from.run, 0); r <= Math.min(span.to.run, polylines.length - 1); r++) {
    const pl = polylines[r];
    const place = (at: CurvePosition) => polylineAtCurve(pl, at.segment, at.t, runs?.[r]);
    const head = r === span.from.run ? place(span.from) : null;
    const tail = r === span.to.run ? place(span.to) : null;
    const total = polylinesLength([pl]);
    const lo = head?.length ?? 0;
    const hi = tail?.length ?? total;
    if (hi - lo <= EPS) continue;
    if (pl.closed && lo <= EPS && total - hi <= EPS) {
      out.push({ polyline: pl, fromClosed: true, dashPhase: 0 });
      continue;
    }
    const base = pl.closed ? opened(pl) : pl;
    const cut = trimPolyline(base, lo, total - hi);
    if (!cut) continue;
    let dashPhase = lo;
    if (cut !== base) {
      // The chord a cut lands on only passes near the curve; the curve's own point ends the run.
      const q = cut.points;
      const k = q.length - 2;
      if (head && lo > 0) {
        // The first chord changes length with its start, so the phase is set by the first vertex kept,
        // which must fall in the pattern where the untrimmed stroke puts it.
        const next = (x: number, y: number) => (k >= 2 ? Math.hypot(q[2] - x, q[3] - y) : 0);
        dashPhase = Math.max(0, lo + next(q[0], q[1]) - next(head.x, head.y));
        [q[0], q[1]] = [head.x, head.y];
      }
      if (tail && total - hi > 0) [q[k], q[k + 1]] = [tail.x, tail.y];
    }
    out.push({ polyline: cut, fromClosed: pl.closed, dashPhase });
  }
  return out;
}

/** `pl` with its closing edge drawn out: the first point repeated at the end,
 *  as the anchor the closing edge reaches. */
function opened(pl: Polyline): Polyline {
  const n = pl.points.length / 2;
  const { anchorA: A, anchorB: B, anchorT: T, widths: W, offsets: O } = pl;
  const end = closingAnchor(pl, n) ?? A?.[0] ?? 0;
  const grow = <F extends Uint32Array | Float32Array>(a: F, v: number): F => {
    const g = new (a.constructor as new (len: number) => F)(n + 1);
    g.set(a);
    g[n] = v;
    return g;
  };
  return {
    points: [...pl.points, pl.points[0], pl.points[1]],
    closed: false,
    anchorA: grow(A ?? new Uint32Array(n), end),
    anchorB: grow(B ?? new Uint32Array(n), end),
    anchorT: grow(T ?? new Float32Array(n), 0),
    ...(W ? { widths: grow(W, W[0]) } : {}),
    ...(O ? { offsets: grow(O, O[0]) } : {}),
  };
}
