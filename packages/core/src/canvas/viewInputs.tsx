/**
 * What {@link useViewHelpers} needs that belongs to the surface rather than to
 * one view: the adapter, the geometry, the bounds resolver and the tools.
 *
 * These are read during a view's render, so they travel as context rather than
 * on the `SurfaceHandle`, which is not attached until an effect runs.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { UseViewHelpersOpts } from './useViewHelpers';
import type { SelectionApi } from 'core/selection/useSelection';

/**
 * @internal Provided by the surface, consumed by `<CanvasView>`.
 *
 * The scene-shaped half only. What a gesture is doing right now is read from
 * the asking view's own dispatcher, not from here.
 */
export interface SurfaceViewInputs
  extends Pick<UseViewHelpersOpts<unknown>, 'adapter' | 'geometry' | 'boundsOf' | 'tools'> {
  /** Every id under a world point, bottom-first. */
  pickEvery?: (worldX: number, worldY: number) => string[];
  /** The one id a click resolves to, collapsing parent/child the way the
   *  select tool does. Falls back to `pickEvery`'s last when absent. */
  pickBest?: (worldX: number, worldY: number) => string | null;
  /** A hit node's routing-trait kind, so `target: 'kind:text'` bindings match. */
  kindOfNode?: (id: string) => string | undefined;
  /** Chrome-caps predicate, so a view's hit-test gates on the same chrome ids
   *  the renderer paints. */
  getIsVisible?: () => (id: string) => boolean;
  /** The surface's selection, which a view shares unless it was given one of
   *  its own. */
  selectionApi: SelectionApi;
}

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
