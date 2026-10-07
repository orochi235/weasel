/**
 * The space a screen-pixel stroke is built in.
 *
 * A `{ px }` stroke is exact on screen only when its ribbon is offset in a
 * space that measures lengths the way the screen does. The transform's linear
 * part is `scale · R · P`: a uniform scale, a rotation (or reflection) that
 * moves no lengths, and `P`, the symmetric unit-determinant stretch left over.
 * Offsetting the ribbon after `P` and mapping it back through `P⁻¹` gives a
 * world-space mesh that the full transform turns into a ribbon of exactly
 * `width · scale` pixels in every direction — and keeps the mesh drawable by
 * every path that draws a world-space ribbon.
 *
 * `P` depends only on the lengths the transform induces (`LᵀL`), not on any
 * rotation applied after it, so a view that only pans or zooms uniformly keeps
 * the same metric and the ribbon cache keeps hitting.
 */
import type { Polyline } from '@weasel-js/geom/tessellate';

/** `P` = [[p, q], [q, r]], with `pr − q² = 1`. */
export interface StrokeMetric {
  readonly p: number;
  readonly q: number;
  readonly r: number;
}

/** Below this, a stretch is a rounding error and the transform a similarity. */
const CONFORMAL_EPSILON = 1e-9;

/**
 * Split the linear map `x' = a·x + c·y, y' = b·x + d·y` — a GL `mat3`'s
 * `m[0], m[1], m[3], m[4]` — into its geometric-mean scale and its stroke
 * metric. `metric` is `null` when the map is a similarity, where world space
 * already measures like the screen; `scale` is `0` for a singular map.
 */
export function strokeSpaceOf(
  a: number, b: number, c: number, d: number,
): { scale: number; metric: StrokeMetric | null } {
  const det2 = Math.abs(a * d - b * c);
  const scale = Math.sqrt(det2);
  if (!(det2 > 0) || !Number.isFinite(det2)) return { scale: 0, metric: null };
  // G = LᵀL / det, whose determinant is 1, so √G = (G + I) / √(tr G + 2).
  const g11 = (a * a + b * b) / det2;
  const g12 = (a * c + b * d) / det2;
  const g22 = (c * c + d * d) / det2;
  const s = Math.sqrt(g11 + g22 + 2);
  const p = (g11 + 1) / s;
  const q = g12 / s;
  const r = (g22 + 1) / s;
  if (Math.abs(q) < CONFORMAL_EPSILON && Math.abs(p - r) < CONFORMAL_EPSILON) {
    return { scale, metric: null };
  }
  return { scale, metric: { p, q, r } };
}

/** A cache-key fragment naming `metric`; empty for none. */
export function metricKey(metric: StrokeMetric | undefined): string {
  return metric === undefined ? '' : `${metric.p},${metric.q},${metric.r}`;
}

/** Map `pl`'s points through `P`, in place. */
export function polylineIntoMetric(pl: Polyline, m: StrokeMetric): void {
  const pts = pl.points;
  for (let i = 0; i < pts.length; i += 2) {
    const x = pts[i], y = pts[i + 1];
    pts[i] = m.p * x + m.q * y;
    pts[i + 1] = m.q * x + m.r * y;
  }
}

/** Map interleaved x,y pairs back out through `P⁻¹` = [[r, −q], [−q, p]], in
 *  place. */
export function coordsOutOfMetric(coords: Float32Array, m: StrokeMetric): void {
  for (let i = 0; i < coords.length; i += 2) {
    const x = coords[i], y = coords[i + 1];
    coords[i] = m.r * x - m.q * y;
    coords[i + 1] = m.p * y - m.q * x;
  }
}

/** Whether `P` takes an axis-aligned rect to another one. */
export function metricKeepsRects(m: StrokeMetric): boolean {
  return m.q === 0;
}

/** `rect` in the metric's space, while `P` keeps it axis-aligned; otherwise
 *  `null`, and the rect has to be carried as a polygon. */
export function rectIntoMetric(
  rect: { x: number; y: number; width: number; height: number },
  m: StrokeMetric,
): { kind: 'rect'; x: number; y: number; width: number; height: number } | null {
  if (!metricKeepsRects(m)) return null;
  return { kind: 'rect', x: m.p * rect.x, y: m.r * rect.y, width: m.p * rect.width, height: m.r * rect.height };
}
