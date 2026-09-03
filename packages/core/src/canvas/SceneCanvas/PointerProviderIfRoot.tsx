/**
 * Conditional `<PointerContextProvider>` wrapper. Mounts a provider only
 * when no parent provider is in scope — otherwise renders children unwrapped
 * so SceneCanvas defers to the host's existing scope.
 *
 * Pairs with `<PointerPublisher>` which attaches native pointermove/leave
 * listeners to the canvas element and writes world-space coords into the
 * surrounding context's `pointerRef`.
 */
import { useEffect, type MutableRefObject, type ReactNode } from 'react';
import { PointerContextProvider, usePointerContext } from 'features/pointer/PointerContext';
import { clientToWorld } from 'core/viewport/clientToWorld';
import { useOptionalViewRegistry } from '../viewRegistry';

/** Mount a `<PointerContextProvider>` only when none is already in scope. */
export function PointerProviderIfRoot({ children }: { children: ReactNode }) {
  const parent = usePointerContext();
  if (parent) return <>{children}</>;
  return <PointerContextProvider>{children}</PointerContextProvider>;
}

/**
 * Attaches native `pointermove` / `pointerleave` listeners to the supplied
 * canvas element and publishes the world-space pointer coordinates into the
 * surrounding `<PointerContextProvider>`. Renders nothing. No-op when no
 * provider is in scope (matches "publish if anyone is listening").
 *
 * Lives inside the provider scope so it sees both consumer-mounted providers
 * and SceneCanvas's auto-mounted one.
 */
export function PointerPublisher({
  canvasRef,
}: {
  canvasRef: MutableRefObject<HTMLElement | null>;
}) {
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
      const target = registry?.resolver.at(pointerId, clientX, clientY);
      const rect = el.getBoundingClientRect();
      const [worldX, worldY] = clientToWorld(
        clientX, clientY,
        target?.origin ?? rect,
        target?.view ?? { x: 0, y: 0, scale: { x: 1, y: 1 } },
      );
      ctx.pointerRef.current = { worldX, worldY };
    };
    const onMove = (e: PointerEvent): void => publish(e.pointerId, e.clientX, e.clientY);
    const onLeave = (e: PointerEvent): void => {
      // Don't clear coords mid-drag: any pointer button down means the user
      // is still actively manipulating the canvas, and downstream consumers
      // (resize/move/etc.) need the latest world position even when the
      // cursor leaves the canvas rect. The `useGestureDispatcher`-side
      // `setPointerCapture` keeps pointermove flowing in that case, so we
      // get fresh values; this guard just prevents the leave event from
      // racing in and nulling them between captured moves.
      if (e.buttons !== 0) {
        publish(e.pointerId, e.clientX, e.clientY);
        return;
      }
      ctx.pointerRef.current = null;
    };
    // Document-level pointermove backstop so the HUD keeps updating when the
    // pointer drifts off the canvas during a drag (pointer capture routes
    // events back to the canvas, but the leave-window edge case is covered
    // here too). Filter to events whose target isn't the canvas to avoid
    // double-publishing.
    const onDocMove = (e: PointerEvent): void => {
      if (e.target === el) return;
      // Only forward off-canvas moves during an active drag — idle hover
      // outside the canvas shouldn't be reported as a canvas pointer position.
      if (e.buttons === 0) return;
      publish(e.pointerId, e.clientX, e.clientY);
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    document.addEventListener('pointermove', onDocMove);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
      document.removeEventListener('pointermove', onDocMove);
    };
    // canvasRef + registry + ctx identity are all stable across the lifetime
    // of the surrounding provider; effect runs once per mount.
  }, [ctx, canvasRef, registry]);
  return null;
}
