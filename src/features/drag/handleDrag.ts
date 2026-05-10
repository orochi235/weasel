import { useCallback } from 'react';

/** A 2D point in the rect element's local coordinate space. */
export interface HandleDragPoint {
  x: number;
  y: number;
}

/** Options for {@link useHandleDrag}. */
export interface UseHandleDragOptions<T extends HTMLElement | SVGElement> {
  /** Called on every `pointermove` with coords local to the rect element (see `getRect`). */
  onMove: (p: HandleDragPoint, e: PointerEvent) => void;
  /** Called on `pointerdown` with the same local coords passed to `onMove`. */
  onStart?: (p: HandleDragPoint, e: React.PointerEvent<T>) => void;
  /** Called on `pointerup` / `pointercancel`, after listeners are removed. */
  onEnd?: (e: PointerEvent) => void;
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
 * Pointer-capture drag for SVG/HTML handles. On `pointerdown` captures the
 * pointer, then forwards every `pointermove` to `onMove` with coordinates
 * local to the rect-providing element (defaulting to the handle's owning
 * `<svg>`). Listeners are cleaned up on `pointerup` / `pointercancel`.
 */
export function useHandleDrag<T extends HTMLElement | SVGElement>(
  opts: UseHandleDragOptions<T>,
): UseHandleDragReturn<T> {
  const { onMove, onStart, onEnd, getRect } = opts;

  const onPointerDown = useCallback(
    (e: React.PointerEvent<T>) => {
      e.preventDefault();
      const target = e.currentTarget;
      const rectEl = getRect ? getRect(target) : defaultRectEl(target);
      const rect = rectEl.getBoundingClientRect();
      const localOf = (clientX: number, clientY: number): HandleDragPoint => ({
        x: clientX - rect.left,
        y: clientY - rect.top,
      });

      target.setPointerCapture(e.pointerId);
      onStart?.(localOf(e.clientX, e.clientY), e);

      const move = (ev: PointerEvent) => {
        onMove(localOf(ev.clientX, ev.clientY), ev);
      };
      const end = (ev: PointerEvent) => {
        target.removeEventListener('pointermove', move as EventListener);
        target.removeEventListener('pointerup', end as EventListener);
        target.removeEventListener('pointercancel', end as EventListener);
        try {
          target.releasePointerCapture(ev.pointerId);
        } catch {}
        onEnd?.(ev);
      };

      target.addEventListener('pointermove', move as EventListener);
      target.addEventListener('pointerup', end as EventListener);
      target.addEventListener('pointercancel', end as EventListener);
    },
    [onMove, onStart, onEnd, getRect],
  );

  return { onPointerDown };
}
