import type { Polyline } from '@weasel-js/geom/tessellate';
import { type StrokeNib, type VertexWidth, vertexHalfWidths, widestHalfWidth } from '@weasel-js/paint';
import { applyNib } from './nib';

/** What one unit of a `vertexWidths` entry measures across the line at a
 *  point whose unit tangent, in the polyline's own space, is `(tx, ty)`. */
export type WidthScale = (tx: number, ty: number) => number;

/** Fill `pl.widths` by interpolating `vertexWidths` across each point's
 *  (anchorA, anchorB, anchorT), each side of the path on its own, and
 *  `pl.offsets` where the two sides differ. Anchor-aligned points (A === B)
 *  read the anchor's value directly. Entries resolve through
 *  `vertexHalfWidths`, so a missing one takes `fallbackWidth`. Given `scale`,
 *  each entry is scaled along the segment that reads it, and the fallback is
 *  not: a corner becomes two coincident points, one for each segment, as a nib
 *  splits it, since one factor at a corner of a stretched space is wrong for
 *  at least one side. */
export function populatePolylineWidths(
  pl: Polyline,
  vertexWidths: readonly VertexWidth[],
  fallbackWidth: number,
  scale?: WidthScale,
): void {
  const n = pl.points.length / 2;
  if (n === 0) return;
  const P = pl.points;
  const aA = pl.anchorA ?? new Uint32Array(n);
  const aB = pl.anchorB ?? new Uint32Array(n);
  const aT = pl.anchorT ?? new Float32Array(n);
  const fallback = fallbackWidth / 2;
  // A fallback side is not scaled: it is the stroke's own width.
  const sides = (i: number, k: number): [number, number] => {
    const h = vertexHalfWidths(vertexWidths[i], NaN);
    return [Number.isNaN(h.left) ? fallback : h.left * k, Number.isNaN(h.right) ? fallback : h.right * k];
  };
  const pts: number[] = [], ptA: number[] = [], ptB: number[] = [], ptT: number[] = [], ws: number[] = [], os: number[] = [];
  let sided = false;
  const push = (i: number, k: number): void => {
    const a = aA[i], b = aB[i], t = aT[i];
    let [left, right] = sides(a, k);
    if (a !== b) {
      const [lb, rb] = sides(b, k);
      left += (lb - left) * t;
      right += (rb - right) * t;
    }
    pts.push(P[i * 2], P[i * 2 + 1]);
    ptA.push(a); ptB.push(b); ptT.push(t);
    ws.push(left + right);
    os.push((right - left) / 2);
    if (right !== left) sided = true;
  };
  const segCount = n < 2 ? 0 : pl.closed ? n : n - 1;
  if (!scale || segCount === 0) {
    for (let i = 0; i < n; i++) push(i, 1);
  } else {
    const factors: number[] = [];
    for (let i = 0; i < segCount; i++) {
      const j = (i + 1) % n;
      const dx = P[j * 2] - P[i * 2], dy = P[j * 2 + 1] - P[i * 2 + 1];
      const len = Math.hypot(dx, dy);
      factors.push(len > 0 ? scale(dx / len, dy / len) : NaN);
    }
    // A zero-length segment takes the direction of the one before it.
    for (let i = 0; i < segCount; i++) {
      if (Number.isNaN(factors[i])) factors[i] = i > 0 ? factors[i - 1] : (factors.find((f) => !Number.isNaN(f)) ?? 1);
    }
    push(0, factors[0]);
    for (let i = 1; i < n; i++) {
      push(i, factors[i - 1]);
      if (i < segCount) push(i, factors[i]);
    }
    if (pl.closed) push(0, factors[segCount - 1]);
    pl.points = pts;
    pl.anchorA = Uint32Array.from(ptA);
    pl.anchorB = Uint32Array.from(ptB);
    pl.anchorT = Float32Array.from(ptT);
  }
  pl.widths = Float32Array.from(ws);
  if (sided) pl.offsets = Float32Array.from(os);
}

/** The widest a stroke of `width` draws: twice the farthest any edge sits
 *  from the path. A nib only ever narrows it. */
export function widestStrokeWidth(width: number, vertexWidths: readonly VertexWidth[] | undefined): number {
  return 2 * widestHalfWidth(width, vertexWidths);
}

/** Fill `pl.widths` from whichever of `vertexWidths` and `nib` a stroke
 *  sets, the nib's factor multiplying the per-vertex width. Leaves them unset
 *  for a stroke of one width. */
export function populateWidths(
  pl: Polyline,
  vertexWidths: readonly VertexWidth[] | null,
  nib: StrokeNib | undefined,
  width: number,
  scale?: WidthScale,
): void {
  if (vertexWidths) populatePolylineWidths(pl, vertexWidths, width, scale);
  if (nib) applyNib(pl, nib, width);
}
