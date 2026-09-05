import { useCallback, useEffect, useRef } from 'react';
import { clientToCanvasRect } from 'core/viewport/clientToCanvas';
import {
  openPointerSession,
  type PointerSession,
  type PointerSessionCancelReason,
} from '../pointerSession';

/** A 2D point in the rect element's local coordinate space. */
export interface HandleDragPoint {
  x: number;
  y: number;
}

/** What a released drag reports. */
export interface HandleDragEnd {
  /** Where the pointer was let go, in the rect element's local space. */
  point: HandleDragPoint;
  /** False when the pointer never moved — a press, not a drag. Commit-on-end
   *  consumers use this to tell an edit from a stray click. */
  moved: boolean;
  event: PointerEvent;
}

/** Options for {@link useHandleDrag}. */
export interface UseHandleDragOptions<T extends HTMLElement | SVGElement> {
  /** Called on every `pointermove` with coords local to the rect element (see `getRect`). */
  onMove: (p: HandleDragPoint, e: PointerEvent) => void;
  /** Called on `pointerdown` with the same local coords passed to `onMove`. */
  onStart?: (p: HandleDragPoint, e: React.PointerEvent<T>) => void;
  /** The pointer was released. Not called when the drag is cancelled — a
   *  cancelled gesture is not an edit, and conflating the two made every
   *  commit-on-end consumer sniff the event type to tell them apart. */
  onEnd?: (end: HandleDragEnd) => void;
  /** The drag ended without a release: the pointer was cancelled, capture was
   *  lost, or the component unmounted mid-gesture. */
  onCancel?: (reason: PointerSessionCancelReason) => void;
  /**
   * Element whose `getBoundingClientRect()` defines the local coordinate
   * space. Defaults to the handle target's owning `<svg>` if it has one,
   * otherwise the target itself.
   */
  getRect?: (target: T) => Element;
}

/** Return shape of {@link useHandleDrag}. */
export interface UseHandleDragReturn<T extends HTMLElement | SVGElement> {
  onPointerDown: (e: React.PointerEvent<T>) => void;
}

function defaultRectEl(target: HTMLElement | SVGElement): Element {
  if (target instanceof SVGElement && target.ownerSVGElement) {
    return target.ownerSVGElement;
  }
  return target;
}

/**
 * Pointer drag for SVG/HTML handles. On `pointerdown` opens a
 * {@link openPointerSession | pointer session} on the handle, then forwards
 * every move to `onMove` with coordinates local to the rect-providing element
 * (defaulting to the handle's owning `<svg>`).
 *
 * The rect is measured once, at the press: a handle that moves under its own
 * drag must not shift the space its coordinates are reported in.
 */
export function useHandleDrag<T extends HTMLElement | SVGElement>(
  opts: UseHandleDragOptions<T>,
): UseHandleDragReturn<T> {
  const { onMove, onStart, onEnd, onCancel, getRect } = opts;
  const live = useRef<PointerSession | null>(null);

  useEffect(() => () => { live.current?.cancel(); }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<T>) => {
      e.preventDefault();
      live.current?.cancel();

      const target = e.currentTarget;
      const rectEl = getRect ? getRect(target) : defaultRectEl(target);
      const rect = rectEl.getBoundingClientRect();
      const localOf = (clientX: number, clientY: number): HandleDragPoint => {
        const [x, y] = clientToCanvasRect(rect, clientX, clientY);
        return { x, y };
      };

      let moved = false;
      live.current = openPointerSession(target, e, {
        onMove: (ev) => {
          moved = true;
          onMove(localOf(ev.clientX, ev.clientY), ev);
        },
        onEnd: (ev) => {
          live.current = null;
          onEnd?.({ point: localOf(ev.clientX, ev.clientY), moved, event: ev });
        },
        onCancel: (reason) => {
          live.current = null;
          onCancel?.(reason);
        },
      });

      onStart?.(localOf(e.clientX, e.clientY), e);
    },
    [onMove, onStart, onEnd, onCancel, getRect],
  );

  return { onPointerDown };
}
