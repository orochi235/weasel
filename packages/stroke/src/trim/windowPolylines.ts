import { lengthTable, type LengthTable } from '@weasel-js/geom';
import { type Polyline, trimPolyline } from '@weasel-js/geom/tessellate';
import type { StrokeTrim } from '@weasel-js/paint';
import { resolveTrim } from './resolveTrim';

const EPS = 1e-9;

/** One visible run of a trimmed stroke. */
export interface WindowedRun {
  /** Open wherever the window cut it, with widths, offsets and anchor params
   *  interpolated at the cuts; a closed subpath the window covers whole stays closed. */
  polyline: Polyline;
  /** Taken from a closed subpath, so it takes no start or end marker. */
  fromClosed: boolean;
  /** How far along its subpath the run starts: the dash phase that keeps a
   *  pattern anchored to the path's start. 0 when uncut at the start. */
  dashPhase: number;
}

/** The world-space length table of a stroke's flattened polylines.
 *  `anchorSources` (from `resolveCornersWithSources`) keeps anchors in authored numbering. */
export function polylineTable(polylines: readonly Polyline[], anchorSources?: Uint32Array | null): LengthTable {
  return lengthTable(polylines, 2, anchorSources);
}

/**
 * The parts of `polylines` that `trim` draws, one run per subpath the window
 * touches, in pen order. `null` when there is no trim, so the caller draws
 * `polylines` as they are; empty when the window draws nothing.
 */
export function windowPolylines(
  polylines: readonly Polyline[], trim: StrokeTrim | undefined, anchorSources?: Uint32Array | null,
): WindowedRun[] | null {
  if (trim === undefined) return null;
  const table = polylineTable(polylines, anchorSources);
  const span = resolveTrim(table, trim);
  if (!span) return [];
  const out: WindowedRun[] = [];
  polylines.forEach((pl, r) => {
    const runFrom = table.runStart[r];
    const runTo = table.runStart[r + 1];
    const lo = Math.max(span.from, runFrom);
    const hi = Math.min(span.to, runTo);
    if (hi - lo <= EPS) return;
    const head = lo - runFrom;
    const tail = runTo - hi;
    if (pl.closed && head <= EPS && tail <= EPS) {
      out.push({ polyline: pl, fromClosed: true, dashPhase: 0 });
      return;
    }
    const cut = trimPolyline(pl.closed ? opened(pl) : pl, head, tail);
    if (cut) out.push({ polyline: cut, fromClosed: pl.closed, dashPhase: head });
  });
  return out;
}

/** `pl` with its closing edge drawn out: the first point repeated at the end,
 *  as the anchor the closing edge reaches. */
function opened(pl: Polyline): Polyline {
  const n = pl.points.length / 2;
  const { anchorA: A, anchorB: B, anchorT: T, widths: W, offsets: O } = pl;
  const end = pl.closeAnchor ?? (A && B && A[n - 1] !== B[n - 1] ? B[n - 1] : A?.[0] ?? 0);
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
