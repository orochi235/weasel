/**
 * The slot an in-flight ongoing handle is keyed by:
 * - `key-held`: `key-held-<code>` (`key-held-Space`), so two keys that share a
 *   `key`, such as the two Shifts, hold separately. An event with no code keys
 *   by `key`.
 * - `pointerdown` and the drag that follows: `pointer-<pointerId>`. An event
 *   with no `pointerId` (a synthesized probe, a programmatic drag, most tests)
 *   keys to `pointer-mouse`.
 * - `multitouch`: `multitouch-<fingers>`.
 * - `carry`: `carry-<pointerId>`, keyed as a pointer is.
 * - any other kind that starts an ongoing invoker: `ongoing-<kind>`.
 */
import type { InputEvent } from './matcher';

/**
 * The in-flight handle slot a pointer's gestures key into. Exported because
 * the React seam (`useGestureDispatcher`) has to name the same slot when it
 * asks `dispatcher.inFlight()` whether a given pointer is mid-drag.
 *
 * @param pointerId - `PointerEvent.pointerId`, or `undefined` for a
 *   synthesized event with no originating DOM pointer.
 */
export function pointerGestureId(pointerId: number | undefined): string {
  return `pointer-${pointerId ?? 'mouse'}`;
}

/** The in-flight handle slot a multitouch gesture of `fingers` fingers keys into. */
export function multiTouchGestureId(fingers: number): string {
  return `multitouch-${fingers}`;
}

/** Whether `gestureId` is a multitouch gesture's, of any finger count. */
export function isMultiTouchGestureId(gestureId: string): boolean {
  return gestureId.startsWith('multitouch-');
}

export function gestureIdFor(event: InputEvent): string {
  if (event.kind === 'key-held') {
    return `key-held-${event.code ?? event.key}`;
  }
  if (
    event.kind === 'pointerdown' ||
    event.kind === 'pointermove' ||
    event.kind === 'pointerup' ||
    event.kind === 'pointercancel'
  ) {
    return pointerGestureId(event.pointerId);
  }
  if (event.kind === 'multitouch') {
    return multiTouchGestureId(event.fingers);
  }
  if (event.kind === 'carry') {
    return `carry-${event.pointerId ?? 'mouse'}`;
  }
  return `ongoing-${event.kind}`;
}
