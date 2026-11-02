import { useEffect, type RefObject } from 'react';
import { heldPointers } from '@weasel-js/gestures';
import { useLatest } from '@weasel-js/react';
import { usePointerContext, type PointerWorldPos } from '@weasel-js/routing/react';

/** Where a client point is in the world and which view it is over, or `null`
 *  when there is no answer yet (the surface has not mounted its camera). */
export type LocatePointer = (
  pointerId: number,
  clientX: number,
  clientY: number,
) => NonNullable<PointerWorldPos> | null;

/**
 * Publishes the pointer over `elementRef` into the pointer store in scope, as
 * `locate` places it. A pointer pressed on the element keeps publishing once
 * it leaves, so a drag that runs off the edge still reports where it is; a
 * pointer that leaves with nothing held clears the store, unless another view
 * has published since. No-op with no provider in scope.
 *
 * `locate` is read on each event, so it need not be stable.
 */
export function usePublishPointer(
  elementRef: RefObject<HTMLElement | null>,
  locate: LocatePointer,
): void {
  const store = usePointerContext();
  const locateRef = useLatest(locate);
  useEffect(() => {
    const el = elementRef.current;
    if (!el || !store) return;
    let viewId: string | null = null;
    const publish = (e: PointerEvent): void => {
      const at = locateRef.current(e.pointerId, e.clientX, e.clientY);
      if (!at) return;
      viewId = at.viewId;
      store.set(at);
    };
    const held = heldPointers(el);
    const onLeave = (e: PointerEvent): void => {
      if (held.count() > 0) {
        publish(e);
        return;
      }
      const now = store.get();
      if (now && now.viewId === viewId) store.set(null);
    };
    // The element's own listener has the moves that still target it.
    const onDocMove = (e: PointerEvent): void => {
      if (held.count() === 0 || el.contains(e.target as Node | null)) return;
      publish(e);
    };
    el.addEventListener('pointermove', publish);
    el.addEventListener('pointerleave', onLeave);
    document.addEventListener('pointermove', onDocMove);
    return () => {
      el.removeEventListener('pointermove', publish);
      el.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('pointermove', onDocMove);
      held.release();
    };
  }, [elementRef, store, locateRef]);
}
