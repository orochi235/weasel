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
 * Nor for placing chrome or measuring a pick slop: `standoff` and
 * `strokeHitTest`'s `slop` work on screen, which stays exact under a rotated
 * target where no per-axis world answer exists.
 *
 * What legitimately remains is a stroke width for a line that is not
 * axis-aligned. A ribbon takes one world width, and the renderer resolves a
 * `{ px }` width through this same mean, so a picker reading ink widths must
 * too. An axis-aligned line has an exact answer — `pxExtent` on its cross
 * axis, as the grid layer does.
 */
export function meanScale(s: { x: number; y: number }): number {
  return Math.sqrt(s.x * s.y);
}
