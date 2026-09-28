/**
 * How far, in CSS pixels, a press must travel before it is a drag rather than
 * a click. `useGestureDispatcher` holds a pointerdown back until the pointer
 * crosses it, so a press-and-release that stays under it never opens a drag.
 */
export const DRAG_THRESHOLD_PX = 4;

/** Whether a pointer that went down at `from` has travelled far enough, by
 *  `to`, to be a drag. Both points are client coordinates. */
export function pastDragThreshold(
  from: { clientX: number; clientY: number },
  to: { clientX: number; clientY: number },
  threshold: number = DRAG_THRESHOLD_PX,
): boolean {
  return Math.hypot(to.clientX - from.clientX, to.clientY - from.clientY) >= threshold;
}
