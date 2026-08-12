/**
 * Geometric mean of a per-axis scale. Degenerates to `s.x` (or `s.y`) when the
 * two axes are equal; otherwise sits between them.
 *
 * **Not for hit-testing.** A screen-pixel length is not one world distance
 * under non-uniform zoom, and collapsing it to a scalar makes a pickable
 * region too generous on one axis and too mean on the other. Use `pxExtent`
 * for a per-axis world length, or `withinPxBox` / `withinPxRadius` to compare
 * in screen space directly. Chrome hit-tests moved off this in 2026-08.
 *
 * What legitimately remains: hairline stroke widths (`1 / meanScale`), where
 * a single width is all the renderer accepts and no per-axis answer exists,
 * and painted chrome placement, whose per-axis form doesn't separate under a
 * rotated target.
 */
export function meanScale(s: { x: number; y: number }): number {
  return Math.sqrt(s.x * s.y);
}
