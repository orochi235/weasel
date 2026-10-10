import { openPointerSession, pastDragThreshold } from '@weasel-js/routing';

/**
 * A drag that does not start until the pointer has moved far enough to mean
 * it. Below the threshold the gesture is still a click; above it, `onActivate`
 * fires once and every later move is a drag.
 *
 * The pointer lifecycle underneath — capture, pointer identity, lost-capture
 * and missed-release recovery, teardown — belongs to `openPointerSession`.
 */
export interface ThresholdDragOptions {
  /** Travel, in CSS pixels, that makes the press a drag. Default `DRAG_THRESHOLD_PX`. */
  threshold?: number;
  /** Element the session opens on. Defaults to `e.currentTarget`; a list must
   *  pass its container, since a grabbed row unmounting drops capture. */
  origin?: Element;
  onActivate?: (e: PointerEvent) => void;
  onMove: (e: PointerEvent) => void;
  onCommit: (e: PointerEvent) => void;
  /** Released below the threshold — the click the press turned out to be. */
  onClick?: (e: PointerEvent) => void;
  /** Ended without a release: pointercancel, lost capture, Escape during the drag, or `cancel()`. */
  onCancel?: () => void;
}

/** Handle returned by `startThresholdDrag` exposing live gesture state. */
export interface ThresholdDragHandle {
  /** True after the pointer has moved past `threshold` and the drag is live. */
  isDragging: () => boolean;
  /** End the gesture now, as a cancel. For an unmount, or any other rule the caller owns. */
  cancel: () => void;
}

/** Begin a threshold-gated drag from a React PointerDown event; returns a handle exposing live state. */
export function startThresholdDrag(
  e: React.PointerEvent,
  opts: ThresholdDragOptions,
): ThresholdDragHandle {
  const start = { clientX: e.clientX, clientY: e.clientY };
  let activated = false;

  const maybeActivate = (ev: PointerEvent) => {
    if (activated) return;
    if (!pastDragThreshold(start, ev, opts.threshold)) return;
    activated = true;
    opts.onActivate?.(ev);
  };

  const origin = opts.origin ?? (e.currentTarget as Element);
  const keys: EventTarget = origin.ownerDocument.defaultView ?? origin.ownerDocument;
  // Window capture, and stopped there: the Escape that ends a drag must not also close the dialog the drag is in.
  const onKey = (ev: Event) => {
    if (!activated || (ev as KeyboardEvent).key !== 'Escape') return;
    ev.preventDefault();
    ev.stopPropagation();
    session.cancel();
  };
  const unlisten = () => keys.removeEventListener('keydown', onKey, true);
  keys.addEventListener('keydown', onKey, true);

  const session = openPointerSession(origin, e, {
    onMove: (ev) => {
      maybeActivate(ev);
      if (activated) opts.onMove(ev);
    },
    onEnd: (ev) => {
      unlisten();
      if (activated) opts.onCommit(ev);
      else opts.onClick?.(ev);
    },
    onCancel: () => {
      unlisten();
      opts.onCancel?.();
    },
  });

  return {
    isDragging: () => activated,
    cancel: () => { session.cancel(); },
  };
}
