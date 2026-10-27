import { useEffect, type RefObject } from 'react';
import { usePointerContext } from '@weasel-js/routing/react';

/**
 * Publishes the pointer's world point over `canvas` to the shared pointer
 * store under `viewId`, and clears it when the pointer leaves with no button
 * held — a drag that leaves keeps its claim.
 */
export function usePublishPointer(
  canvas: RefObject<HTMLCanvasElement | null>,
  clientToWorld: (cx: number, cy: number) => { x: number; y: number },
  viewId: string,
): void {
  const pointerStore = usePointerContext();
  useEffect(() => {
    const el = canvas.current;
    if (!el || !pointerStore) return;
    const onMove = (e: PointerEvent): void => {
      const w = clientToWorld(e.clientX, e.clientY);
      pointerStore.set({ world: { x: w.x, y: w.y }, viewId });
    };
    const onLeave = (e: PointerEvent): void => {
      if (e.buttons !== 0) return;
      if (pointerStore.get()?.viewId === viewId) pointerStore.set(null);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
  }, [canvas, pointerStore, clientToWorld, viewId]);
}
