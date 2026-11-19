import type { RefObject } from 'react';
import { heldPointers } from '@weasel-js/gestures';
import { useLatest } from '@weasel-js/react';
import { usePointerContext, type PointerWorldPos } from '@weasel-js/routing/react';
import { useElementEffect } from './useElementEffect';

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
 * it leaves, so a drag that runs off the edge still reports where it is until
 * it is released. A pointer that leaves with nothing held, or is released
 * or canceled outside (off the window included), clears the store, unless
 * another view has published since. No-op with no provider in scope.
 *
 * `locate` is read on each event, so it need not be stable. The ref is read
 * after every render, so an element that mounts later or is swapped is followed.
 */
export function usePublishPointer(
  elementRef: RefObject<HTMLElement | null>,
  locate: LocatePointer,
): void {
  const store = usePointerContext();
  const locateRef = useLatest(locate);
  useElementEffect(() => (store ? elementRef.current : null), (el) => {
    if (!store) return;
    let viewId: string | null = null;
    const publish = (e: PointerEvent): void => {
      const at = locateRef.current(e.pointerId, e.clientX, e.clientY);
      if (!at) return;
      viewId = at.viewId;
      store.set(at);
    };
    const held = heldPointers(el);
    const clear = (): void => {
      const now = store.get();
      if (now && now.viewId === viewId) store.set(null);
    };
    // Whether a held pointer has left the element since it last moved over it.
    let outside = false;
    const onMove = (e: PointerEvent): void => {
      outside = false;
      publish(e);
    };
    const onLeave = (e: PointerEvent): void => {
      if (held.count() === 0) {
        clear();
        return;
      }
      outside = true;
      publish(e);
    };
    // A press that left the element ends with no leave to follow: released, canceled, or let go
    // off the window, which the held set learns of from the next move with no button down.
    const unheld = held.subscribe(() => {
      if (held.count() > 0 || !outside) return;
      outside = false;
      clear();
    });
    // The element's own listener has the moves that still target it.
    const onDocMove = (e: PointerEvent): void => {
      if (held.count() === 0 || el.contains(e.target as Node | null)) return;
      publish(e);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    document.addEventListener('pointermove', onDocMove);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('pointermove', onDocMove);
      unheld();
      held.release();
    };
  }, [store, locateRef]);
}
