import type { Polyline } from '@weasel-js/geom/tessellate';

/** Fill `pl.widths` by interpolating `vertexWidths` across each point's
 *  (anchorA, anchorB, anchorT). Anchor-aligned points (A === B) read the
 *  anchor's value directly. Out-of-range / non-finite anchor entries fall
 *  back to `fallbackWidth`. */
export function populatePolylineWidths(
  pl: Polyline,
  vertexWidths: number[],
  fallbackWidth: number,
): void {
  const ptCount = pl.points.length / 2;
  if (ptCount === 0) return;
  const aA = pl.anchorA ?? new Uint32Array(ptCount);
  const aB = pl.anchorB ?? new Uint32Array(ptCount);
  const aT = pl.anchorT ?? new Float32Array(ptCount);
  const widths = new Float32Array(ptCount);
  const read = (i: number): number => {
    const v = vertexWidths[i];
    return typeof v === 'number' && isFinite(v) && v > 0 ? v : fallbackWidth;
  };
  for (let i = 0; i < ptCount; i++) {
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
