/** What the gesture dispatcher reads from the surface's view registry. */
import { useMemo } from 'react';
import type { UseGestureDispatcherOptions } from '@weasel-js/routing/react';
import { surfaceLocal, type ViewRegistry } from '../viewRegistry';

/**
 * The dispatcher's routing to registered views, and its canvas-local mapping
 * through the surface's camera, so both follow a `clientToWorld` override.
 * Empty outside a registry: every point then resolves to the canvas.
 */
export function useSurfaceRouting(
  viewRegistry: ViewRegistry | null,
): Pick<UseGestureDispatcherOptions, 'views' | 'clientToLocal'> {
  return useMemo(() => {
    if (!viewRegistry) return {};
    return {
      // Rebuilt per event, so a view that mounts or moves mid-session is
      // routable on the next one.
      views: {
        targets: () => viewRegistry.list().map((r) => ({ id: r.id, ...r.target })),
        resolver: viewRegistry.resolver,
      },
      clientToLocal: (clientX: number, clientY: number) => surfaceLocal(viewRegistry.surface(), clientX, clientY),
    };
  }, [viewRegistry]);
}
