import { useMemo, useRef } from 'react';
import { composeAffordanceLayer } from 'affordances/composeAffordanceLayer';
import {
  createRotationAffordance,
} from 'affordances/rotationHandle';
import type { Affordance, AffordanceBinding, AffordanceRegion } from 'affordances/types';
import type { RotateAdapter } from 'core/adapters/types';
import { defineTool } from '../../routing';
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
  /** Legacy `useRotate` options surface. Ignored after Phase 14e Task 3 —
   *  rotation now flows through `rotateAction`, whose option surface is
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
 *  Phase 14e Task 3: legacy `useRotate` hook removed — the affordance no
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

  // Rotation affordance. Defaults to the same `handleHitRadius` /
  // `rotationHandleDistance` the tool exposes so the affordance's hit math
  // matches what users configure.
  const rotationAff = useMemo(
    () => createRotationAffordance({
      distance: rotationHandleDistance,
      handleHitRadius,
    }),
    [rotationHandleDistance, handleHitRadius],
  );

  // Strip the affordance's per-region paint (the selection-overlay layer
  // paints the rotation handle separately). Unlike the pre-14e-T3 wrapper,
  // this no longer overrides `bind()` to swap in a `useRotate` drag
  // channel — the dispatcher path owns the gesture now. The region's stub
  // drag is still emitted via `bind()` so the affordance layer can serve
  // as a hit-test surface for legacy callers, but the new dispatcher
  // reaches the rotate gesture via the `useSelectTool` binding +
  // `affordanceAt`-generated `rotate-handle` hits.
  const rotationAffStripped: Affordance = useMemo(
    () => ({
      id: rotationAff.id,
      regions(state) {
        const out: AffordanceRegion[] = [];
        for (const region of rotationAff.regions(state)) {
          out.push({
            ...region,
            paint: undefined,
            bind: (): AffordanceBinding => region.bind(),
          });
        }
        return out;
      },
      decorate: rotationAff.decorate ? (state, view) => rotationAff.decorate!(state, view) : undefined,
    }),
    [rotationAff],
  );

  // Affordance overlay layer. The composer paints `rotationAff.render`
  // glyphs and routes hit-tests through `rotationAffStripped.hitTest`.
  const affordanceOverlay = useMemo(
    () => composeAffordanceLayer('rotate-affordances', 'Rotate affordances', [
      rotationAffStripped,
    ]),
    [rotationAffStripped],
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
  // hitTest comes from the affordance layer so dispatcher-side hit-test
  // pipelines can route rotation-handle hits through it. Ghosts have no
  // hitTest of their own.
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
      hitTest: (wx, wy, data, view, dims) =>
        affordanceOverlay.hitTest(wx, wy, toChromeState(data), view, dims),
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
        initial: {},
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
