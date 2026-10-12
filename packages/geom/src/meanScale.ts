/**
 * Geometric mean of a per-axis scale's magnitudes, so a flipped (negative)
 * axis counts by its size.
 *
 * **Not for hit-testing.** A screen-pixel length is not one world distance
 * under non-uniform zoom, and collapsing it to a scalar makes a pickable
 * region too generous on one axis and too mean on the other. Use `pxExtent`
 * for a per-axis world length, or `withinPxBox` / `withinPxRadius` to compare
 * in screen space directly. Nor for placing chrome or measuring a pick slop:
 * `standoff` and `strokeHitTest`'s `slop` work on screen.
 *
 * What legitimately remains is a stroke width for a line that is not
 * axis-aligned: the renderer resolves a `{ px }` width through this same
 * mean, so a picker reading ink widths must too.
 */
export function meanScale(s: { x: number; y: number }): number {
  return Math.sqrt(Math.abs(s.x * s.y));
}
