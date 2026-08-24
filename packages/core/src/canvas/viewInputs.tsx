/**
 * The surface-wide half of what {@link useViewHelpers} needs, published to the
 * views mounted inside a surface.
 *
 * A view builds its own overlay-aware state, but out of the surface's adapter,
 * geometry, tools and gestures — the same objects `<Canvas>` builds its own
 * from. Only the selection differs per view. These are read during a view's
 * render, so they travel as context rather than on the `SurfaceHandle`, which
 * is not attached until an effect runs.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { UseViewHelpersOpts } from './useViewHelpers';

/** @internal Provided by the surface, consumed by `<CanvasView>`. */
export type SurfaceViewInputs = Omit<UseViewHelpersOpts<unknown>, 'selection'>;

const ViewInputsContext = createContext<SurfaceViewInputs | null>(null);

/** @internal */
export function ViewInputsProvider(
  { value, children }: { value: SurfaceViewInputs; children: ReactNode },
) {
  return <ViewInputsContext.Provider value={value}>{children}</ViewInputsContext.Provider>;
}

/** The hosting surface's view-helper inputs, or `null` outside one. */
export function useOptionalViewInputs(): SurfaceViewInputs | null {
  return useContext(ViewInputsContext);
}
