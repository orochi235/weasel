import { useMemo, useRef } from 'react';
import { composeAffordanceLayer } from 'affordances/composeAffordanceLayer';
import {
  createRotationAffordance,
} from 'affordances/rotationHandle';
import type { RotateAdapter } from 'core/adapters/types';
import { defineTool } from '../../defineTool';
import type { Tool } from '../../types';
import type { RenderLayer } from 'core/layers/render';
import type { ChromeState } from 'core/selection/chromeState';
import type { Bounds } from '../shared/selectionTarget';

/** Accept either `CanvasHelpers` (Canvas's runtime call shape) or a bare
 *  `ChromeState` (unit-test call shape) — see useResizeTool for the same helper. */
function toChromeState(data: unknown): ChromeState {
  const maybeHelpers = data as { getChromeState?: () => ChromeState };
  if (typeof maybeHelpers?.getChromeState === 'function') {
    return maybeHelpers.getChromeState();
  }
  return data as ChromeState;
}

export interface UseRotateToolOptions<TNode extends { id: string }, _TPose> {
  /** Legacy `useRotate` options surface. Ignored now —
   *  rotation flows through `rotateAction`, whose option surface is
   *  configured at the action-registration level. Kept on the type for
   *  backwards-compat with consumers (notably `SceneCanvas`'s
   *  `rotateOptions`) that still pass a value. */
  rotate?: unknown;
  /** Distance from top edge of bounds to rotation handle center. Default: 24. */
  rotationHandleDistance?: number;
  /** Square hit-radius for the rotation handle. Default: 8. */
  handleHitRadius?: number;
  /** World-space bounds lookup. Required for the rotation affordance hit-test
   *  in consumers that wire a `boundsOf` source separately from the
   *  ChromeState-driven affordance pipeline. Retained for parity with
   *  `useResizeTool`; the rotation affordance itself reads bounds via the
   *  dispatcher-supplied ChromeState. */
  boundsOf?: (id: string) => Bounds | null;
  /** Live selection ids — retained for parity with `useResizeTool` /
   *  `useSelectTool` option surfaces. The dispatcher-path `rotateAction`
   *  reads selection from its own `InvocationCtx`, so this tool no longer
   *  forwards selection into the rotation gesture itself. */
  getSelection?: () => string[];
  /** Node lookup — retained for parity with `useSelectTool` and for future
   *  ghost-render wiring. The rotation affordance does not need it directly. */
  getNode?: (id: string) => TNode | null;
}

/** Rotate-only Tool. Owns the rotation-handle affordance render layer; the
 *  gesture itself flows through `rotateAction` (declarative binding in
 *  `useSelectTool.bindings` keyed on the `rotate-handle` affordance hit
 *  kind) → dispatcher → preview surface → scene commit.
 *
 *  The legacy `useRotate` hook is removed — the affordance no
 *  longer wraps each region's drag channel; the unwrapped affordance is
 *  used purely for the paint + hit-test surface. The dispatcher's
 *  `affordanceAt` pipeline produces `rotate-handle` hits independently
 *  (see `src/canvas/affordanceAt.ts`), which the `useSelectTool` rotate
 *  binding then routes to `rotateAction`. */
export function useRotateTool<TNode extends { id: string }, _TPose>(
  adapter: RotateAdapter<TNode, _TPose>,
  options: UseRotateToolOptions<TNode, _TPose>,
): Tool<unknown> & {
  overlay: RenderLayer<unknown>;
} {
  const handleHitRadius = options.handleHitRadius ?? 8;
  const rotationHandleDistance = options.rotationHandleDistance ?? 24;

  // Latest-callback refs so the overlay/affordance closures see the most
  // recent option closures without rebuilding the Tool record.
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const boundsOfRef = useRef(options.boundsOf);
  boundsOfRef.current = options.boundsOf;

  // Rotation affordance. The legacy `rotationHandleDistance` /
  // `handleHitRadius` knobs are no longer used — the affordance is now
  // an invisible elliptical ring around the selection AABB (see
  // `createRotationAffordance`). The `bandPx` option is the only knob
  // exposed for ring thickness, defaulting to 24. `paint: null` keeps
  // the ring fully invisible — the cursor change on hover is the only
  // visual cue, matching the documented intent.
  const rotationAff = useMemo(
    () => createRotationAffordance({ bandPx: rotationHandleDistance, paint: null }),
    [rotationHandleDistance],
  );

  // Pass the rotation affordance through to the overlay layer unmodified
  // — the affordance now carries an `annulus` paint that draws the
  // hover-band ring directly. Previously the wrapper stripped paint
  // because the selection-overlay layer painted a separate point handle;
  // that's no longer the case.
  const affordanceOverlay = useMemo(
    () => composeAffordanceLayer('rotate-affordances', 'Rotate affordances', [
      rotationAff,
    ]),
    [rotationAff],
  );

  // Ghost overlay slice. Structural placeholder retained so the tool's
  // overlay shape is stable; emits nothing because this tool no longer
  // owns ghost rendering — the dispatcher-path `rotateAction` publishes
  // `previewIds` / `previewPose`, and SceneCanvas's preview-ghost layer
  // re-renders the affected ids from those.
  const ghostOverlay = useMemo<RenderLayer<unknown>>(
    () => ({
      id: 'rotate-overlay-ghosts',
      label: 'Rotate overlay ghosts',
      space: 'screen',
      draw: () => [],
    }),
    [],
  );

  // Combined Tool overlay: ghost layer (bottom) + affordance layer (top).
  //
  // Paint only. This used to forward `hitTest` to the affordance layer "so
  // dispatcher-side hit-test pipelines can route rotation-handle hits through
  // it" — but no pipeline ever did. `tools.getActiveOverlays()` feeds Canvas's
  // *draw* stack; the only thing that calls `RenderLayer.hitTest` is
  // `hitTestExtras`, which walks layers a consumer attached with
  // `registerLayer`, and a tool overlay is not one of those. Rotation hits
  // come from `buildAffordanceAt`, which owns the same
  // `createRotationAffordance` this layer paints.
  const overlay = useMemo<RenderLayer<unknown>>(
    () => ({
      id: 'rotate-overlay',
      label: 'Rotate overlay',
      space: 'screen',
      draw: (data, view, dims) => {
        const ghosts = ghostOverlay.draw(data, view, dims);
        const aff = affordanceOverlay.draw(toChromeState(data), view, dims);
        return [...ghosts, ...aff];
      },
    }),
    [ghostOverlay, affordanceOverlay],
  );

  return useMemo(
    () => {
      const base = defineTool<unknown>({
        id: 'rotate',
        capabilities: ['transforms-selection'],
        hookName: 'useRotateTool',
        // No keybinding — rotate is affordance-driven, not tool-switched.
        cursor: () => 'default',
        presentation: {
          label: 'Rotate',
          group: 'select',
        },
      });
      return {
        ...base,
        overlay,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [overlay, handleHitRadius, rotationHandleDistance],
  );
}
