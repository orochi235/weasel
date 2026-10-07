import type { Polyline } from '@weasel-js/geom/tessellate';

/** What one unit of a `vertexWidths` entry measures across the line at a
 *  point whose unit tangent, in the polyline's own space, is `(tx, ty)`. */
export type WidthScale = (tx: number, ty: number) => number;

/** Fill `pl.widths` by interpolating `vertexWidths` across each point's
 *  (anchorA, anchorB, anchorT). Anchor-aligned points (A === B) read the
 *  anchor's value directly. Out-of-range / non-finite anchor entries fall
 *  back to `fallbackWidth`. Given `scale`, each entry is scaled at the point
 *  that reads it, and the fallback is not. */
export function populatePolylineWidths(
  pl: Polyline,
  vertexWidths: number[],
  fallbackWidth: number,
  scale?: WidthScale,
): void {
  const ptCount = pl.points.length / 2;
  if (ptCount === 0) return;
  const aA = pl.anchorA ?? new Uint32Array(ptCount);
  const aB = pl.anchorB ?? new Uint32Array(ptCount);
  const aT = pl.anchorT ?? new Float32Array(ptCount);
  const widths = new Float32Array(ptCount);
  let k = 1;
  const read = (i: number): number => {
    const v = vertexWidths[i];
    return typeof v === 'number' && isFinite(v) && v > 0 ? v * k : fallbackWidth;
  };
  for (let i = 0; i < ptCount; i++) {
    if (scale) k = scaleAt(pl, i, scale);
    const a = aA[i], b = aB[i], t = aT[i];
    if (a === b) {
      widths[i] = read(a);
    } else {
      const wa = read(a);
      const wb = read(b);
      widths[i] = wa + (wb - wa) * t;
    }
  }
  pl.widths = widths;
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
