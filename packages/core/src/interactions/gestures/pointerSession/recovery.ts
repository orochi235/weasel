/**
 * The two releases a pointerdown/pointerup pair does not deliver.
 *
 * Both are shared with `useGestureDispatcher`, which owns its own multi-pointer
 * lifecycle and cannot use `openPointerSession` — one implementation of each
 * rule rather than two that drift.
 */

/** The DOM event that says capture went away mid-gesture. */
export const LOST_CAPTURE_EVENT = 'lostpointercapture';

/**
 * Does the press report button state at all?
 *
 * Synthesized events routinely carry `buttons: 0`, or nothing. Reading a
 * missed release out of those would end every such drag on its first move, so
 * a press that reports no buttons disarms {@link isMissedRelease} entirely.
 */
export function reportsButtons(down: { buttons?: number }): boolean {
  return !!down.buttons;
}

/**
 * A move with nothing held is the release the document never saw — the pointer
 * came up over another window, a native drag, or an element that swallowed it.
 * Only ask this when {@link reportsButtons} was true for the press.
 */
export function isMissedRelease(move: { buttons?: number }): boolean {
  return move.buttons === 0;
}
