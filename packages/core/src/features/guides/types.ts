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
}
