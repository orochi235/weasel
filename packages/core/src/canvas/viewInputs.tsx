/**
 * What {@link useViewHelpers} needs that belongs to the surface rather than to
 * one view: the adapter, the geometry, the bounds resolver and the tools.
 *
 * These are read during a view's render, so they travel as context rather than
 * on the `SurfaceHandle`, which is not attached until an effect runs.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { UseViewHelpersOpts } from './useViewHelpers';

/**
 * @internal Provided by the surface, consumed by `<CanvasView>`.
 *
 * The scene-shaped half only. What a gesture is doing right now is read from
 * the asking view's own dispatcher, not from here.
 */
export type SurfaceViewInputs =
  Pick<UseViewHelpersOpts<unknown>, 'adapter' | 'geometry' | 'boundsOf' | 'tools'>;

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
