/**
 * Guide — a horizontal or vertical world-space line used as a snap target
 * and an optional rendered overlay.
 *
 * `axis === 'x'` means a vertical line at world `x = offset` (snaps the X
 * coordinate); `axis === 'y'` means a horizontal line at world `y = offset`
 * (snaps the Y coordinate). This matches "the X axis snaps along X."
 */
export interface Guide {
  /** Stable, caller-supplied id. Used by removeGuide and as a render key. */
  id: string;
  /** Which world axis this guide constrains. */
  axis: 'x' | 'y';
  /** World-space offset along the constrained axis. */
  offset: number;
  /** The stretch of the line worth drawing, in world units on the other
   *  axis: an `'x'` guide's y range. Derived alignment guides carry the
   *  extent of the boxes that produced them. Absent, the line has no extent
   *  of its own and `createGuidesLayer` draws it across the canvas. */
  span?: { min: number; max: number };
}

/**
 * SpacingGap — one measured gap between two boxes, drawn as an equal-spacing
 * marker. `axis === 'x'` is a horizontal gap from world `x = min` to
 * `x = max`, drawn at `y = at`; `axis === 'y'` is the vertical counterpart.
 */
export interface SpacingGap {
  axis: 'x' | 'y';
  min: number;
  max: number;
  /** World position on the other axis the marker is drawn at. */
  at: number;
}
