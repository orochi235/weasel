/** A wheel event's deltas and the unit they are counted in, as `WheelEvent` carries them. */
export interface WheelDeltas {
  deltaX: number;
  deltaY: number;
  /** 0 for pixels, 1 for lines, 2 for pages: `WheelEvent.DOM_DELTA_*`. */
  deltaMode: number;
}

/** A line's height in CSS px, as browsers that report pixels scroll one. */
export const WHEEL_LINE_PX = 16;

/**
 * A wheel's deltas in CSS px. Firefox counts a mouse wheel's notches in lines, and a page-mode wheel in pages; `page`
 * is how far a page goes along each axis, the box being scrolled.
 */
export function wheelPixels(e: WheelDeltas, page: { x: number; y: number }): { x: number; y: number } {
  const [x, y] = e.deltaMode === 1 ? [WHEEL_LINE_PX, WHEEL_LINE_PX] : e.deltaMode === 2 ? [page.x, page.y] : [1, 1];
  return { x: e.deltaX * x, y: e.deltaY * y };
}
