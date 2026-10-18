/**
 * What {@link useViewHelpers} needs that belongs to the surface rather than to
 * one view: the adapter, the geometry and the bounds resolver.
 *
 * These are read during a view's render, so they travel as context rather than
 * on the `SurfaceHandle`, which is not attached until an effect runs.
 */
import { createContext, useContext, type ReactNode } from 'react';
import type { UseViewHelpersOpts } from './useViewHelpers';
import type { SelectionApi } from 'core/selection/useSelection';
import type { View } from 'core/viewport/view';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import type { PlaneMap } from 'core/viewport/parallax';
import type { ChromeCaps } from 'features/chrome-caps/useChromeCaps';
import type { PickView } from './SceneCanvas/useSceneSelectTool';

export type { ViewRuleInputs } from 'features/chrome-caps/useChromeCaps';

/**
 * @internal Provided by the surface, consumed by `<CanvasView>`.
 *
 * The scene-shaped half only. What a gesture is doing right now is read from
 * the asking view's own dispatcher, not from here.
 */
export interface SurfaceViewInputs
  extends Pick<UseViewHelpersOpts<unknown>, 'adapter' | 'geometry'> {
  /** A node's box for chrome, drawn under `view` — the camera of the view
   *  asking, since a node on a parallax plane lands somewhere else in each. */
  boundsOf: ((id: string, view?: View | null) => Bounds | null) | undefined;
  /** How `view`'s world maps into the parallax plane `id` is drawn through,
   *  or null when its layer moves with the camera. */
  planeOfNode?: ((id: string, view?: View | null) => PlaneMap | null) | undefined;
  /** `boundsOf` for `id` drawn at an in-flight `pose`, under `view`. */
  boundsOfPose?: ((id: string, pose: unknown, view?: View | null) => Bounds | null) | undefined;
  /** Every id under a world point, bottom-first. `view` is the view the
   *  point was produced under — a screen-pixel tolerance cannot be converted
   *  without its scale, nor a layer judged without its paint, and the world
   *  point carries neither. */
  pickEvery?: (worldX: number, worldY: number, view?: PickView | null) => string[];
  /** The one id a click resolves to, collapsing parent/child the way the
   *  select tool does. Falls back to `pickEvery`'s last when absent. */
  pickBest?: (worldX: number, worldY: number, view?: PickView | null) => string | null;
  /** A hit node's routing-trait kind, so `target: 'kind:text'` bindings match. */
  kindOfNode?: (id: string) => string | undefined;
  /** The node a double-click on a hit names (`doubleClickTarget`). */
  doubleClickNames?: ((hitId: string) => string) | undefined;
  /** The surface's chrome-caps rule table, evaluated against a view's own
   *  context. */
  chromeCaps?: ChromeCaps;
  /** The surface's selection, which a view shares unless it was given one of
   *  its own. */
  selectionApi: SelectionApi;
  /** The rotate badge the surface's selection overlay paints, which every
   *  view drawing that overlay has to make grabbable where it is drawn. */
  rotationBadge?: { distancePx: number; sizePx: number } | null;
  /** `selectTool.resize.edgeHandles`: whether the resize handles every view
   *  grabs include the edge midpoints. Default true. */
  edgeHandles?: boolean;
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
