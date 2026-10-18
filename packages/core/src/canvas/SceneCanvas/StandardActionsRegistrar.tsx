import type { Action, ActionsProp, ActionTunings } from '@weasel-js/routing';
import type { Dispatcher } from '@weasel-js/routing';
import { useActionsRegistry, useDepSource } from '@weasel-js/routing/react';
import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { useDecayLoop } from 'core/viewport/useDecayLoop';
import type { ViewAnimationApi } from 'core/viewport/useViewAnimation';
import type { View } from 'core/viewport/view';
import type { PinchZoomOptions } from 'interactions/actions/defaults/pinchZoom';
import type { WheelPanOptions } from 'interactions/actions/defaults/viewportWheelPan';
import type { ViewportZoomOptions } from 'interactions/actions/defaults/viewportZoom';
import type { ClipboardIngestCtx, SvgIngestOptions } from 'interactions/actions/depSchema';
import type { GeometryProjection } from 'interactions/actions/geometryProjection';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { UseResizeOptions } from 'interactions/actions/resize/options';
import { useActionSet, useStandardDeps } from 'interactions/actions/useActionSet';
import type React from 'react';
import { useEffect } from 'react';
import type { LayoutDropTargetMode, ReflowTransition } from '../../layout/types';
import type { CanvasExtensionApi } from '../canvasExtension';
import {
  useAreaSelectDepSource,
  useDebugDepSource,
  useDepChangeNotices,
  useDispatcherDepSource,
  useEditAnchorsDepSource,
  useIngestionDepSource,
  useInsertDepSource,
  useLassoSelectDepSource,
  useLayoutDepSource,
  useNodeAtPointDepSource,
  usePoseDescriptorDepSource,
  usePathLeafDepSources,
  useSnapDepSource,
  useSurfaceDepSources,
  useTextEditDepSource,
  useViewDepSource,
  type InsertNodeFactory,
  type InsertPaint,
  type SnapSources,
} from '../deps';
import { GeometryProjectionRegistrar, ResizePolicyRegistrar } from './poseRegistrars';
import type { BridgeAdapter } from './props';
import { useActionsPropResolver } from './useActionsPropResolver';
import { useActionTunings } from './useActionTunings';
import { useViewportActions } from './useViewportActions';

/** What `<SceneCanvas>` hands {@link StandardActionsRegistrar}. */
export interface StandardActionsRegistrarProps {
  selection: SelectionApi;
  scene: Scene<unknown, string, unknown>;
  adapter: BridgeAdapter;
  actions?: ActionsProp;
  tune?: ActionTunings;
  /** The standard actions this canvas registers: its presets' and the ones
   *  its tools bind, in registration order. */
  standardActions: readonly Action[];
  currentViewRef: React.RefObject<View>;
  onViewChange: (v: View) => void;
  /** Forwarded from `selectTool.resize` — wires the `resizePolicy` dep
   *  consumed by the dispatcher-path `resizeAction`. The legacy
   *  `useResizeTool` consumes the same options separately (both paths run
   *  in parallel during the dispatcher migration). */
  resizeOptions?: UseResizeOptions<unknown>;
  /** Forwarded from `SceneCanvasProps.poseDescriptor` — wires the
   *  `poseDescriptor` dep every built-in pose-touching action reads. */
  poseDescriptor: PoseDescriptor<unknown>;
  /** Forwarded from `SceneCanvasProps.geometry.boundsIncludeStroke` — wires
   *  the `boundsIncludeStroke` dep. */
  boundsIncludeStroke: boolean;
  /** Forwarded from `SceneCanvasProps.geometryProjection` — wires the
   *  `geometryProjection` dep consumed by pose-transform actions (move,
   *  resize, nudge, flip). Conditionally mounted so absent → dep undefined. */
  geometryProjection?: GeometryProjection;
  /** Forwarded so `cancelGestureAction` and other actions that need to
   *  abort in-flight handles can read the dispatcher's control surface. */
  dispatcher: Dispatcher;
  /** World-space picker forwarded so the `nodeAtPoint` dep source can
   *  reuse the same hit-test plumbing the tool dispatcher uses. */
  pickEvery: (worldX: number, worldY: number) => string[];
  /** This canvas's own view gate for scene layers, published on the `view`
   *  dep and read by the selecting actions. Absent when it hides nothing. */
  layerIsPainted?: (layerId: string) => boolean;
  /** The composed paint alpha, when the consumer fades anything, so a region
   *  select passes over what is painted at zero. */
  alphaOf?: (id: string) => number;
  /** Resolved `viewport.pan` flag — default true, false to disable. */
  viewportPanEnabled: boolean | WheelPanOptions;
  /** Resolved `viewport.zoom` setting — `true` (default Cmd+wheel zoom),
   *  `false` (disabled), or a {@link ViewportZoomOptions} config. */
  viewportZoom: boolean | ViewportZoomOptions;
  /** Resolved `viewport.pinchZoom` setting — `true` (default two-finger pinch),
   *  `false` (disabled), or a {@link PinchZoomOptions} scale clamp. */
  viewportPinchZoom: boolean | PinchZoomOptions;
  /** Optional recenter callback. When supplied, wires through to the
   *  `view` dep so `viewport.zoom` reset (Cmd-0) calls it instead of
   *  snapping to identity. A returned `View` is a target the kit may
   *  animate to; `void` means the callback dispatched it itself. */
  viewportRecenter?: () => View | void;
  /** The canvas's camera runner, published on the `view` dep so
   *  `viewport.zoom`'s discrete branches can animate. */
  viewAnimation: ViewAnimationApi;
  /** Lifted edit-mode state so the `pathEditingOverlay` chrome (rendered
   *  outside this subtree) can read the same `editingId` the dep does. */
  editAnchorsExternalState: import('../deps/editAnchors').EditAnchorsStateSource;
  layoutDropTarget?: LayoutDropTargetMode;
  reflowTransition?: ReflowTransition<unknown> | null;
  /** Forwarded from `SceneCanvasProps` so `useInsertDepSource` can wire the
   *  consumer's per-kind node factories into the `insert` dep. */
  insertNodeFactories?: Record<string, InsertNodeFactory>;
  insertPaint?: InsertPaint;
  /** `toolOptions.snapPoint`, `toolOptions.snapTargets` and the canvas's path snapper, which the
   *  `snap` dep composes for the drawing and dragging actions. */
  snap: SnapSources;
  /** The canvas element ref, so `useIngestionDepSource` can compute the
   *  visible world rect from the client rect + current view. */
  canvasRef: React.RefObject<HTMLElement | null>;
  /** The canvas handle, whose debug sink backs the `debug` dep. */
  canvasApiRef: React.RefObject<CanvasExtensionApi | null>;
  /** Forwarded from `SceneCanvasProps.ingestion.resolveSrc` — consumer
   *  file→src override for the kit image handler. */
  ingestionResolveSrc?: (file: File) => Promise<string>;
  /** Forwarded from `SceneCanvasProps.ingestion.svg` — kit SVG-handler
   *  options (`unpack`). */
  ingestionSvg?: SvgIngestOptions;
  /** Clipboard-paste ctx (this canvas's adapter + the consumer's reviver)
   *  for the kit weasel-JSON handler, from `useCanvasIngestion`; absent
   *  when disabled. */
  ingestionClipboard?: ClipboardIngestCtx;
}

/**
 * Registers this canvas's standard actions, and the deps they read, into its
 * input scope, then applies the `actions` prop and `tune` over them.
 */
export function StandardActionsRegistrar({
  selection,
  scene,
  adapter,
  actions, tune,
  standardActions,
  currentViewRef,
  onViewChange,
  resizeOptions,
  poseDescriptor,
  boundsIncludeStroke,
  geometryProjection,
  dispatcher,
  pickEvery,
  layerIsPainted,
  alphaOf,
  viewportPanEnabled,
  viewportZoom,
  viewportPinchZoom,
  viewportRecenter,
  viewAnimation,
  editAnchorsExternalState,
  layoutDropTarget,
  reflowTransition,
  insertNodeFactories,
  insertPaint,
  snap,
  canvasRef,
  canvasApiRef,
  ingestionResolveSrc,
  ingestionSvg,
  ingestionClipboard,
}: StandardActionsRegistrarProps) {
  const registry = useActionsRegistry();

  // Wire the dispatcher into the registry so registry.begin() can delegate
  // to dispatcher.beginUiOngoing() for UI-driven ongoing actions (color,
  // opacity).
  useEffect(() => {
    if (!registry) return;
    return registry.setDispatcher(dispatcher);
  }, [registry, dispatcher]);

  // Momentum for `viewport.dragPan`. The loop must be a hook (it owns a
  // `useVisibleRaf`), so it is built here and republished on the view dep.
  const decayLoop = useDecayLoop();

  // Build the ViewApi (stable identity, refreshed closures) and hand it to
  // useStandardDeps (which publishes the `view` dep along with selection,
  // scene, history, activeTool). `hostSize` reads the live canvas
  // element so keyboard zoom (Cmd+=/-) can anchor at the visible center.
  const view = useViewDepSource(
    currentViewRef,
    onViewChange,
    viewportRecenter,
    () => {
      const el = canvasRef.current;
      return el ? { width: el.clientWidth, height: el.clientHeight } : null;
    },
    viewAnimation,
    decayLoop,
    layerIsPainted,
  );
  useStandardDeps({ selection, scene, view, history: scene.history });
  useActionSet(standardActions);
  // A view overlays `view` with its own camera; this name it leaves alone.
  useDepSource('rootView', () => view);
  useSurfaceDepSources(canvasRef, currentViewRef);
  useDepSource('actionParams', () => registry?.paramsOf);

  // viewport.pan / viewport.zoom are SceneCanvas-coupled (need the `view` dep
  // published just above), so they're registered here rather than in
  // KIT_STANDARD_DESCRIPTORS. Both default ON; consumer opts out via
  // `viewport={{ pan: false }}` / `viewport={{ zoom: false }}`.
  useViewportActions({ pan: viewportPanEnabled, zoom: viewportZoom, pinchZoom: viewportPinchZoom });

  // Per-dep wiring modules under `src/canvas/deps/`. See each file for the
  // dep's contract and trade-offs.
  useAreaSelectDepSource(scene, selection, poseDescriptor, alphaOf);
  useNodeAtPointDepSource(pickEvery);
  useLayoutDepSource(scene, layoutDropTarget, reflowTransition);
  useInsertDepSource(scene, adapter, insertNodeFactories, insertPaint);
  usePathLeafDepSources(scene, selection, adapter, poseDescriptor);
  useSnapDepSource(snap, currentViewRef);
  useDebugDepSource(canvasApiRef);
  useDepChangeNotices(scene, selection.current, editAnchorsExternalState);
  useIngestionDepSource(canvasRef, () => currentViewRef.current, ingestionResolveSrc, ingestionSvg, ingestionClipboard);
  useLassoSelectDepSource(scene, selection, poseDescriptor, alphaOf);
  useTextEditDepSource(scene);
  useEditAnchorsDepSource(scene, selection, adapter, editAnchorsExternalState, tune);
  useDispatcherDepSource(dispatcher);
  usePoseDescriptorDepSource(poseDescriptor);
  useDepSource('boundsIncludeStroke', () => boundsIncludeStroke);

  // Keyed on the set too: a re-registration of it would otherwise land over
  // the overrides applied on top of it.
  useActionsPropResolver(actions, standardActions.map((a) => a.id).join('|'));
  useActionTunings(tune);

  // Mounted only when passed: an empty default registered here would land
  // after, and over, a dep a child component registered (child effects run
  // first). Absent `geometryProjection` leaves the dep undefined.
  return (
    <>
      {resizeOptions ? <ResizePolicyRegistrar options={resizeOptions} /> : null}
      {geometryProjection ? <GeometryProjectionRegistrar projection={geometryProjection} /> : null}
    </>
  );
}
