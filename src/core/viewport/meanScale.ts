/**
 * Geometric mean of a per-axis scale. Used as a scalar fallback for chrome
 * hit-test radii and hairline stroke widths under non-uniform zoom.
 * Degenerates to `s.x` (or `s.y`) when the two axes are equal; otherwise
 * sits between them.
 *
 * Under non-uniform zoom a circular screen-pixel hit region projects to
 * an ellipse in world space (and vice versa). The geometric-mean
 * approximation is intentionally a v1 fallback — proper axis-aware
 * elliptical hit shapes are a future follow-up.
 */
export function meanScale(s: { x: number; y: number }): number {
  return Math.sqrt(s.x * s.y);
}
