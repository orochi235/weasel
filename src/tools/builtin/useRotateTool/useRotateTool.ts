import { useMemo, useRef } from 'react';
import { useRotate, type UseRotateOptions } from 'interactions/actions/rotate/rotate';
import { composeAffordanceLayer } from 'affordances/composeAffordanceLayer';
import {
  createRotationAffordance,
  type RotationScratch,
} from 'affordances/rotationHandle';
import type { Affordance, AffordanceBinding, AffordanceRegion } from 'affordances/types';
import type { RotateAdapter } from 'core/adapters/types';
import { defineTool } from '../../routing';
import type { Tool } from '../../types';
import type { RenderLayer } from 'core/layers/render';
import type { ChromeState } from 'core/selection/chromeState';
import { MULTI_RESIZE_TARGET_ID, type Bounds } from '../shared/selectionTarget';

/** Accept either `CanvasHelpers` (Canvas's runtime call shape) or a bare
 *  `ChromeState` (unit-test call shape) — see useResizeTool for the same helper. */
function toChromeState(data: unknown): ChromeState {
  const maybeHelpers = data as { getChromeState?: () => ChromeState };
  if (typeof maybeHelpers?.getChromeState === 'function') {
    return maybeHelpers.getChromeState();
  }
  return data as ChromeState;
}

export interface UseRotateToolOptions<TNode extends { id: string }, TPose> {
  /** Rotate gesture options forwarded to `useRotate`. */
  rotate?: UseRotateOptions<TPose>;
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
  /** Live selection ids — passed through to the rotation gesture's onStart
   *  so multi-id rotation works (the gesture uses the configured pivot
   *  mode — default 'union' — across all ids). */
  getSelection?: () => string[];
  /** Node lookup — retained for parity with `useSelectTool` and for future
   *  ghost-render wiring. The rotation affordance does not need it directly. */
  getNode?: (id: string) => TNode | null;
}

/** Rotate-only Tool. Owns:
 *   - the `useRotate` gesture controller
 *   - the rotation-handle affordance
 *   - a placeholder ghost overlay layer (decorative; emits nothing until a
 *     consumer-supplied draw is wired in a later task)
 *   - the rotation slice of `previewPose` / `previewIds`
 *
 *  No `pointerDown` / `drag` / `click` / `dblTap` routes — rotation is
 *  exclusively affordance-driven. The dispatcher routes rotation-handle
 *  hits through this tool's `overlay` (which composes the affordance layer)
 *  into the wrapped drag channel below.
 *
 *  No `previewBounds` slice: rotation doesn't synthesize multi-target bounds
 *  (only resize uses `MULTI_RESIZE_TARGET_ID`). */
export function useRotateTool<TNode extends { id: string }, TPose>(
  adapter: RotateAdapter<TNode, TPose>,
  options: UseRotateToolOptions<TNode, TPose>,
): Tool<unknown> & {
  overlay: RenderLayer<unknown>;
  previewPose: (id: string) => TPose | null;
  previewIds: () => Iterable<string> | null;
} {
  const rotate = useRotate<TNode, TPose>(adapter, options.rotate ?? {});

  const handleHitRadius = options.handleHitRadius ?? 8;
  const rotationHandleDistance = options.rotationHandleDistance ?? 24;

  // Latest-callback ref for the rotate controller — the affordance's wrapped
  // drag channel closes over this so we don't have to rebuild the wrapper
  // every render. Mirrors useResizeTool's pattern.
  const rotateRef = useRef(rotate);
  rotateRef.current = rotate;

  // Latest-callback refs so the overlay/affordance closures see the most
  // recent option closures without rebuilding the Tool record.
  const adapterRef = useRef(adapter);
  adapterRef.current = adapter;
  const boundsOfRef = useRef(options.boundsOf);
  boundsOfRef.current = options.boundsOf;
  const getSelectionRef = useRef(options.getSelection);
  getSelectionRef.current = options.getSelection;

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

  // Wrap each region's `bind()` to substitute the affordance's stub drag
  // channel with one that delegates to `useRotate` via the latest-callback
  // ref. Multi-mode rotation against the synthetic union isn't supported by
  // useRotate today — we filter those regions out so the click falls
  // through to the slot walk. FillStyle is stripped; the selection-overlay layer
  // paints the rotation handle separately, and the affordance's `decorate`
  // pass continues to paint the leader line.
  const rotationAffWrapped: Affordance = useMemo(
    () => ({
      id: rotationAff.id,
      regions(state) {
        const out: AffordanceRegion[] = [];
        for (const region of rotationAff.regions(state)) {
          if (region.targetId === MULTI_RESIZE_TARGET_ID) continue;
          out.push({
            ...region,
            paint: undefined,
            bind: (): AffordanceBinding => {
              const inner = region.bind() as AffordanceBinding<RotationScratch>;
              const scratch = inner.initialScratch!;
              const binding: AffordanceBinding<RotationScratch> = {
                drag: {
                  onStart: (_e, dctx) => {
                    const sel = getSelectionRef.current?.();
                    const ids = sel && sel.length > 0 ? [...sel] : [scratch.targetId];
                    rotateRef.current.start({ ids, worldX: dctx.worldX, worldY: dctx.worldY });
                    return 'claim';
                  },
                  onMove: (_e, dctx) => {
                    rotateRef.current.move({ worldX: dctx.worldX, worldY: dctx.worldY, modifiers: dctx.modifiers });
                    return 'claim';
                  },
                  onEnd: () => {
                    rotateRef.current.end();
                    return 'claim';
                  },
                  onCancel: () => {
                    rotateRef.current.cancel();
                  },
                },
                initialScratch: scratch,
              };
              return binding as AffordanceBinding;
            },
          });
        }
        return out;
      },
      decorate: rotationAff.decorate ? (state, view) => rotationAff.decorate!(state, view) : undefined,
    }),
    [rotationAff],
  );

  // Affordance overlay layer. The composer paints `rotationAff.render`
  // glyphs and routes hit-tests through `rotationAffWrapped.hitTest`.
  const affordanceOverlay = useMemo(
    () => composeAffordanceLayer('rotate-affordances', 'Rotate affordances', [
      rotationAffWrapped,
    ]),
    [rotationAffWrapped],
  );

  // Ghost overlay slice. Structural placeholder for the rotate ghost —
  // currently emits nothing because this tool's option surface doesn't
  // include a `drawGhost`/`getNode` ghost-render pair (`useSelectTool`
  // still owns ghost rendering today). SceneCanvas's preview-ghost layer
  // re-renders the affected ids via `previewIds` + `previewPose`.
  const ghostOverlay = useMemo<RenderLayer<unknown>>(
    () => ({
      id: 'rotate-overlay-ghosts',
      label: 'Rotate overlay ghosts',
      space: 'screen',
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      draw: (_data, _view, _dims) => {
        // No-op until ghost-render options are added. Reading
        // `rotate.overlay` here without a draw target would just allocate
        // and discard.
        return [];
      },
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

  // previewPose: surface the rotation controller's in-flight pose for the
  // target id. Returns null when no rotation is in flight or `id` isn't the
  // rotating target. (Multi-id rotation overlay tracks only the first id —
  // the gesture controller documents this; see rotate.ts line ~259.)
  const previewPose = (id: string): TPose | null => {
    const rOv = rotate.overlay;
    if (!rOv) return null;
    if (rOv.id === id) return rOv.currentPose as TPose;
    return null;
  };

  // previewIds: the id whose committed paint should be suppressed while a
  // rotation gesture is in flight. Mirrors the rotation slice of
  // useSelectTool's previewIds.
  const previewIds = (): Iterable<string> | null => {
    const rOv = rotate.overlay;
    if (!rOv) return null;
    return [rOv.id];
  };

  return useMemo(
    () => {
      const base = defineTool<unknown>({
        id: 'rotate',
        // No keybinding — rotate is affordance-driven, not tool-switched.
        cursor: () => 'default',
        presentation: {
          label: 'Rotate',
          group: 'select',
        },
        // No pointerDown/drag/click/dblTap routes: the rotation affordance
        // hit-test routes the gesture directly into useRotate via the
        // dispatcher's affordance-layer pipeline. Rotate never participates
        // in body-hit classification.
        initial: {},
      });
      return {
        ...base,
        overlay,
        previewPose,
        previewIds,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rotate, overlay, handleHitRadius, rotationHandleDistance],
  );
}
