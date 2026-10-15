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
 *  each entry is scaled at the point that reads it, and the fallback is not. */
export function populatePolylineWidths(
  pl: Polyline,
  vertexWidths: readonly VertexWidth[],
  fallbackWidth: number,
  scale?: WidthScale,
): void {
  const ptCount = pl.points.length / 2;
  if (ptCount === 0) return;
  const aA = pl.anchorA ?? new Uint32Array(ptCount);
  const aB = pl.anchorB ?? new Uint32Array(ptCount);
  const aT = pl.anchorT ?? new Float32Array(ptCount);
  const widths = new Float32Array(ptCount);
  const offsets = new Float32Array(ptCount);
  let sided = false;
  const fallback = fallbackWidth / 2;
  let k = 1;
  // A fallback side is not scaled: it is the stroke's own width.
  const sides = (i: number): [number, number] => {
    const h = vertexHalfWidths(vertexWidths[i], NaN);
    return [Number.isNaN(h.left) ? fallback : h.left * k, Number.isNaN(h.right) ? fallback : h.right * k];
  };
  for (let i = 0; i < ptCount; i++) {
    if (scale) k = scaleAt(pl, i, scale);
    const a = aA[i], b = aB[i], t = aT[i];
    let [left, right] = sides(a);
    if (a !== b) {
      const [lb, rb] = sides(b);
      left += (lb - left) * t;
      right += (rb - right) * t;
    }
    widths[i] = left + right;
    offsets[i] = (right - left) / 2;
    if (offsets[i] !== 0) sided = true;
  }
  pl.widths = widths;
  if (sided) pl.offsets = offsets;
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

/** `scale` along the line's direction at point `i`: the bisector of the
 *  segments either side, or the one segment at an open end. */
function scaleAt(pl: Polyline, i: number, scale: WidthScale): number {
  const pts = pl.points;
  const n = pts.length / 2;
  let tx = 0, ty = 0;
  const add = (from: number, to: number) => {
    const dx = pts[to * 2] - pts[from * 2], dy = pts[to * 2 + 1] - pts[from * 2 + 1];
    const len = Math.hypot(dx, dy);
    if (len > 0) { tx += dx / len; ty += dy / len; }
  };
  if (i > 0) add(i - 1, i);
  else if (pl.closed && n > 1) add(n - 1, 0);
  if (i < n - 1) add(i, i + 1);
  else if (pl.closed && n > 1) add(n - 1, 0);
  const len = Math.hypot(tx, ty);
  return len > 0 ? scale(tx / len, ty / len) : 1;
}
