/**
 * Snap a (dx, dy) direction vector to the nearest 0/45/90/135° axis,
 * preserving the input magnitude. Used by the pen tool's Shift-constrain
 * affordance; reusable for any tool that wants axis/diagonal locking.
 *
 * Returns (0, 0) for a zero-length input (no direction to snap).
 */
export function constrainTo45(dx: number, dy: number): { dx: number; dy: number } {
  const mag = Math.hypot(dx, dy);
  if (mag === 0) return { dx: 0, dy: 0 };
  const angle = Math.atan2(dy, dx);
  // Snap to nearest multiple of π/4.
  const step = Math.PI / 4;
  const snapped = Math.round(angle / step) * step;
  return { dx: Math.cos(snapped) * mag, dy: Math.sin(snapped) * mag };
}
