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
import type { View } from 'core/viewport/view';

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
  viewRef,
}: {
  canvasRef: MutableRefObject<HTMLCanvasElement | null>;
  viewRef: MutableRefObject<View>;
}) {
  const ctx = usePointerContext();
  useEffect(() => {
    if (!ctx) return;
    const el = canvasRef.current;
    if (!el) return;
    const onMove = (e: PointerEvent): void => {
      const rect = el.getBoundingClientRect();
      const view = viewRef.current;
      ctx.pointerRef.current = {
        worldX: (e.clientX - rect.left) / view.scale + view.x,
        worldY: (e.clientY - rect.top) / view.scale + view.y,
      };
    };
    const onLeave = (): void => {
      ctx.pointerRef.current = null;
    };
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerleave', onLeave);
    return () => {
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerleave', onLeave);
    };
    // canvasRef + viewRef + ctx identity are all stable across the lifetime
    // of the surrounding provider; effect runs once per mount.
  }, [ctx, canvasRef, viewRef]);
  return null;
}
