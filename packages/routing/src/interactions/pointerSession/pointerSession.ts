/**
 * The DOM half of a drag: one pointer, held down, from press to release.
 *
 * Every pointerdown-to-pointerup lifecycle in the kit used to answer capture,
 * pointer identity, teardown and lost-pointer recovery for itself, and each
 * answered them differently. This is the one place those are decided; anything
 * above it — thresholds, coordinate spaces, what the drag *means* — belongs to
 * its caller.
 */

/** The DOM event that says capture went away mid-gesture. */
const LOST_CAPTURE_EVENT = 'lostpointercapture';

/**
 * Does the press report button state at all?
 *
 * Synthesized events routinely carry `buttons: 0`, or nothing. Reading a
 * missed release out of those would end every such drag on its first move, so
 * a press that reports no buttons disarms {@link isMissedRelease} entirely.
 */
function reportsButtons(down: { buttons?: number }): boolean {
  return !!down.buttons;
}

/**
 * A move with nothing held is the release the document never saw — the pointer
 * came up over another window, a native drag, or an element that swallowed it.
 * Only ask this when {@link reportsButtons} was true for the press.
 */
function isMissedRelease(move: { buttons?: number }): boolean {
  return move.buttons === 0;
}

/** Why a session ended without the pointer being released. */
export type PointerSessionCancelReason =
  /** The browser cancelled the pointer (touch interrupted, palm rejection). */
  | 'pointercancel'
  /** The origin left the document mid-gesture, taking capture with it. */
  | 'lostcapture'
  /** `cancel()` — an unmount, a window blur, Escape, a consumer's own rule. */
  | 'aborted'
  /** A new press arrived on this pointer, so the tracked one had ended. */
  | 'superseded';

export interface PointerSessionCallbacks {
  /** Every move belonging to this pointer, while it is still held. */
  onMove?: (e: PointerEvent) => void;
  /** The pointer was released. Fires once, before teardown completes. */
  onEnd?: (e: PointerEvent) => void;
  /** The session ended without a release. Fires once. */
  onCancel?: (reason: PointerSessionCancelReason) => void;
}

export interface PointerSessionOptions {
  /** Ask the origin element to capture the pointer. Default `true`. Capture
   *  keeps hover and click off everything the drag passes over; the session
   *  does not depend on it to keep receiving events. */
  capture?: boolean;
}

export interface PointerSession {
  readonly pointerId: number;
  /** False once the session has ended, by any route. */
  readonly active: boolean;
  /** End the session now, reporting `'aborted'`. Idempotent. */
  cancel: () => void;
}

/**
 * Open a session for the pointer that `down` belongs to.
 *
 * Listens on the origin's document rather than on the element: a captured
 * element that is removed mid-drag stops receiving events, and every listener
 * hung on it goes with it. Three recovery rules close the gaps a plain
 * pointerup/pointercancel pair leaves — losing capture cancels only once the
 * origin has left the document, a move reporting no held button is read as
 * the release that never arrived, and a fresh press on the same pointer says
 * the tracked one had already ended.
 */
export function openPointerSession(
  origin: Element,
  down: PointerEvent | React.PointerEvent,
  cb: PointerSessionCallbacks,
  opts: PointerSessionOptions = {},
): PointerSession {
  const pointerId = down.pointerId;
  const doc = origin.ownerDocument ?? document;
  const buttonsReported = reportsButtons(down);
  let active = true;

  const teardown = () => {
    active = false;
    doc.removeEventListener('pointermove', onMove, true);
    doc.removeEventListener('pointerup', onUp, true);
    doc.removeEventListener('pointercancel', onPointerCancel, true);
    doc.removeEventListener('pointerdown', onRepress, true);
    origin.removeEventListener(LOST_CAPTURE_EVENT, onLostCapture);
    if (opts.capture !== false) {
      try { origin.releasePointerCapture?.(pointerId); } catch { /* already gone */ }
    }
  };

  const mine = (e: PointerEvent) => e.pointerId === pointerId;

  const end = (e: PointerEvent) => {
    if (!active) return;
    teardown();
    cb.onEnd?.(e);
  };

  const abort = (reason: PointerSessionCancelReason) => {
    if (!active) return;
    teardown();
    cb.onCancel?.(reason);
  };

  function onMove(e: PointerEvent) {
    if (!active || !mine(e)) return;
    if (buttonsReported && isMissedRelease(e)) { end(e); return; }
    cb.onMove?.(e);
  }
  function onUp(e: PointerEvent) {
    if (mine(e)) end(e);
  }
  function onPointerCancel(e: PointerEvent) {
    if (mine(e)) abort('pointercancel');
  }
  // A press on a pointer we still believe is held: the release landed
  // somewhere that never told us, and where it ended is unknown — so this
  // cancels rather than ending at the new press's coordinates.
  function onRepress(e: PointerEvent) {
    if (mine(e)) abort('superseded');
  }
  // Losing capture only ends the gesture when the origin is gone, because
  // then nothing more is coming. While it is still in the document the
  // session keeps tracking: it listens there, not on the origin, so it needs
  // capture for retargeting and not for delivery. Chrome releases capture
  // implicitly a beat *before* it delivers `pointerup`, so cancelling here
  // unconditionally threw away releases that had already been dispatched.
  function onLostCapture(e: Event) {
    if ((e as PointerEvent).pointerId !== pointerId) return;
    if (!origin.isConnected) abort('lostcapture');
  }

  if (opts.capture !== false) {
    // Best-effort: a detached element throws, and jsdom's implementation
    // records the call and does nothing. Neither is a reason to fail the drag.
    try { origin.setPointerCapture?.(pointerId); } catch { /* uncaptured is fine */ }
  }
  // Capture phase, so a consumer's own stopPropagation cannot strand a session.
  doc.addEventListener('pointermove', onMove, true);
  doc.addEventListener('pointerup', onUp, true);
  doc.addEventListener('pointercancel', onPointerCancel, true);
  doc.addEventListener('pointerdown', onRepress, true);
  origin.addEventListener(LOST_CAPTURE_EVENT, onLostCapture);

  return {
    pointerId,
    get active() { return active; },
    cancel: () => abort('aborted'),
  };
}
