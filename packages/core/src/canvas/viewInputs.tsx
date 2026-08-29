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
import type { NodeId } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import type { RuleCtx } from 'features/chrome-caps';
import type { PickCamera } from './SceneCanvas/useSceneSelectTool';

/**
 * The part of a chrome-caps rule context that belongs to one view. Everything
 * else a `RuleCtx` carries — mode, capabilities, device, focus — is the
 * surface's and the same for every view drawn on it.
 */
export interface ViewRuleInputs {
  selection: readonly NodeId[];
  view: View;
  /** What that view's dispatcher currently has in flight. */
  action: { kind: string | null; id: string | null };
}

/**
 * @internal Provided by the surface, consumed by `<CanvasView>`.
 *
 * The scene-shaped half only. What a gesture is doing right now is read from
 * the asking view's own dispatcher, not from here.
 */
export interface SurfaceViewInputs
  extends Pick<UseViewHelpersOpts<unknown>, 'adapter' | 'geometry' | 'boundsOf' | 'tools'> {
  /** Every id under a world point, bottom-first. `camera` is the view the
   *  point was produced under — a screen-pixel pick tolerance cannot be
   *  converted without it, and the world point does not carry it. */
  pickEvery?: (worldX: number, worldY: number, camera?: PickCamera | null) => string[];
  /** The one id a click resolves to, collapsing parent/child the way the
   *  select tool does. Falls back to `pickEvery`'s last when absent. */
  pickBest?: (worldX: number, worldY: number, camera?: PickCamera | null) => string | null;
  /** A hit node's routing-trait kind, so `target: 'kind:text'` bindings match. */
  kindOfNode?: (id: string) => string | undefined;
  /**
   * The surface's chrome-caps rule table, evaluated against a view's own
   * context. The rules are surface-wide on purpose — one consumer table, one
   * set of kit defaults — but a rule keyed on selection, camera or the
   * in-flight action answers differently per view, so the caller supplies the
   * context and both the paint gate and the dispatcher's eligibility filter
   * read the same one.
   */
  chromeCaps?: {
    /** `undefined` when the surface gates nothing — no mode registry wired,
     *  which is what `<SceneCanvas>` reports for its own view too. */
    ruleCtx(inputs: ViewRuleInputs): RuleCtx | undefined;
    isVisible(inputs: ViewRuleInputs): (id: string) => boolean;
  };
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
