/**
 * Conditional `<PointerContextProvider>` wrapper. Mounts a provider only
 * when no parent provider is in scope — otherwise renders children unwrapped
 * so SceneCanvas defers to the host's existing scope.
 *
 * Pairs with `usePointerPublisher`, which publishes the canvas's pointer
 * into the surrounding context.
 */
import type { MutableRefObject, ReactNode, RefObject } from 'react';
import { PointerContextProvider, usePointerContext } from '@weasel-js/routing/react';
import type { CanvasExtensionApi } from '../canvasExtension';
import { useOptionalViewRegistry } from '../viewRegistry';
import { worldPointAt } from './worldPointAt';
import { usePublishPointer } from '../../input/usePublishPointer';

/** Mount a `<PointerContextProvider>` only when none is already in scope. */
export function PointerProviderIfRoot({ children }: { children: ReactNode }) {
  const parent = usePointerContext();
  if (parent) return <>{children}</>;
  return <PointerContextProvider>{children}</PointerContextProvider>;
}

/**
 * Publishes the canvas's pointer into the surrounding `<PointerContextProvider>`
 * through {@link usePublishPointer}, placing it with the surface's view
 * resolver so paste-at-pointer lands in the panel the cursor is over. With no
 * views declared it answers the canvas's own camera and rect.
 */
export function usePointerPublisher(
  canvasRef: MutableRefObject<HTMLElement | null>,
  canvasApiRef: RefObject<CanvasExtensionApi | null>,
): void {
  const registry = useOptionalViewRegistry();
  usePublishPointer(canvasRef, (pointerId, clientX, clientY) => {
    const api = canvasApiRef.current;
    if (!api) return null;
    const target = registry?.resolver.at(pointerId, clientX, clientY);
    const [x, y] = worldPointAt(api, target, clientX, clientY);
    return { world: { x, y }, viewId: target?.id ?? null };
  });
}
