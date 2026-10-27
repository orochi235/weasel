/**
 * Conditional `<PointerContextProvider>` wrapper. Mounts a provider only
 * when no parent provider is in scope — otherwise renders children unwrapped
 * so SceneCanvas defers to the host's existing scope.
 *
 * Pairs with `usePointerPublisher`, which attaches native pointermove/leave
 * listeners to the canvas element and writes world-space coords into the
 * surrounding context's `pointerRef`.
 */
import { useEffect, type MutableRefObject, type ReactNode, type RefObject } from 'react';
import { heldPointers } from '@weasel-js/gestures';
import { PointerContextProvider, usePointerContext } from '@weasel-js/routing/react';
import type { CanvasExtensionApi } from '../canvasExtension';
import { useOptionalViewRegistry } from '../viewRegistry';
import { worldPointAt } from './worldPointAt';

/** Mount a `<PointerContextProvider>` only when none is already in scope. */
export function PointerProviderIfRoot({ children }: { children: ReactNode }) {
  const parent = usePointerContext();
  if (parent) return <>{children}</>;
  return <PointerContextProvider>{children}</PointerContextProvider>;
}

/**
 * Attaches native `pointermove` / `pointerleave` listeners to the supplied
 * canvas element and publishes the world-space pointer coordinates into the
 * surrounding `<PointerContextProvider>`. No-op when no provider is in scope
 * (matches "publish if anyone is listening").
 *
 * Called inside the provider scope so it sees both consumer-mounted providers
 * and SceneCanvas's auto-mounted one.
 */
export function usePointerPublisher(
  canvasRef: MutableRefObject<HTMLElement | null>,
  canvasApiRef: RefObject<CanvasExtensionApi | null>,
): void {
  const ctx = usePointerContext();
  const registry = useOptionalViewRegistry();
  useEffect(() => {
    if (!ctx) return;
    const el = canvasRef.current;
    if (!el) return;
    // The surface's one resolver answers which camera a client point belongs
    // to, so paste-at-pointer lands in the panel the cursor is over. With no
    // views declared it answers the canvas's own camera and rect.
    const publish = (pointerId: number | null, clientX: number, clientY: number): void => {
      const api = canvasApiRef.current;
      if (!api) return;
      const target = registry?.resolver.at(pointerId, clientX, clientY);
      const [worldX, worldY] = worldPointAt(api, target, clientX, clientY);
      ctx.set({ world: { x: worldX, y: worldY }, viewId: target?.id ?? null });
    };
    const onMove = (e: PointerEvent): void => publish(e.pointerId, e.clientX, e.clientY);
    const held = heldPointers(el);
    const onLeave = (e: PointerEvent): void => {
      // A pointer held on the canvas is still working it once it leaves the
      // rect, and what it drives needs the latest world position.
      if (held.count() > 0) {
        publish(e.pointerId, e.clientX, e.clientY);
        return;
      }
      ctx.set(null);
    };
    // A drag that began on the canvas keeps reporting once it is off it; the
    // canvas's own listener has the moves that still target it.
    const onDocMove = (e: PointerEvent): void => {
      if (e.target === el) return;
      if (held.count() === 0) return;
      publish(e.pointerId, e.clientX, e.clientY);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    document.addEventListener('pointermove', onDocMove);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('pointermove', onDocMove);
      held.release();
    };
    // canvasRef + registry + ctx identity are all stable across the lifetime
    // of the surrounding provider; effect runs once per mount.
  }, [ctx, canvasRef, canvasApiRef, registry]);
}
