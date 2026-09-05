import { openPointerSession } from '../pointerSession';

/**
 * A drag that does not start until the pointer has moved far enough to mean
 * it. Below the threshold the gesture is still a click; above it, `onActivate`
 * fires once and every later move is a drag.
 *
 * The pointer lifecycle underneath — capture, pointer identity, lost-capture
 * and missed-release recovery, teardown — belongs to `openPointerSession`.
 */
export interface ThresholdDragOptions {
  threshold?: number;
  onActivate?: (e: PointerEvent) => void;
  onMove: (e: PointerEvent) => void;
  onCommit: (e: PointerEvent) => void;
  /** Released below the threshold, or ended without a release at all. */
  onCancel?: () => void;
}

/** Handle returned by `startThresholdDrag` exposing live gesture state. */
export interface ThresholdDragHandle {
  /** True after the pointer has moved past `threshold` and the drag is live. */
  isDragging: () => boolean;
  /** End the gesture now, as a cancel. For an unmount, an Escape, or any other
   *  rule the caller owns. */
  cancel: () => void;
}

/** Begin a threshold-gated drag from a React PointerDown event; returns a handle exposing live state. */
export function startThresholdDrag(
  e: React.PointerEvent,
  opts: ThresholdDragOptions,
): ThresholdDragHandle {
  const startX = e.clientX;
  const startY = e.clientY;
  const threshold = opts.threshold ?? 4;
  let activated = false;

  const maybeActivate = (ev: PointerEvent) => {
    if (activated) return;
    const dx = ev.clientX - startX;
    const dy = ev.clientY - startY;
    if (dx * dx + dy * dy < threshold * threshold) return;
    activated = true;
    opts.onActivate?.(ev);
  };

  const session = openPointerSession(e.currentTarget as Element, e, {
    onMove: (ev) => {
      maybeActivate(ev);
      if (activated) opts.onMove(ev);
    },
    onEnd: (ev) => {
      if (activated) opts.onCommit(ev);
      else opts.onCancel?.();
    },
    onCancel: () => { opts.onCancel?.(); },
  });

  return {
    isDragging: () => activated,
    cancel: () => { session.cancel(); },
  };
}
