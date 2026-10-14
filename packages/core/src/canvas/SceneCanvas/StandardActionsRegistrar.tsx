import type { Action, ActionsProp, ActionsRegistry } from '@weasel-js/routing';
import type { Dispatcher } from '@weasel-js/routing';
import { useActionsRegistry, useDepSource, usePointerContext } from '@weasel-js/routing/react';
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
import { useStandardActions } from 'interactions/actions/useStandardActions';
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
  useSliceDepSource,
  useSnapDepSource,
  useTextEditDepSource,
  useViewDepSource,
  type InsertNodeFactory,
  type InsertPaint
} from '../deps';
import { GeometryProjectionRegistrar, ResizePolicyRegistrar } from './poseRegistrars';
import type { BridgeAdapter } from './props';
import { useActionsPropResolver } from './useActionsPropResolver';
import { useViewportActions } from './useViewportActions';

/**
 * Registers the kit's default action set into this canvas's input scope.
 *
 * For `delete`, `duplicate`, `group`, and `ungroup` the descriptor's
 * invoker is a stub (those deps aren't in `DepSchema` yet — Phase 4 T8
 * TODO). This component registers legacy bridge overrides for them so the
 * consumer-facing `run` path is functional. The overrides land after the
 * descriptor registrations (last-writer-wins) and use the same id, so the
 * dispatcher and keybinding system see a real `run` body.
 */
export function StandardActionsRegistrar({
  selection,
  scene,
  adapter,
  actions,
  excludeActions,
  currentViewRef,
  onViewChange,
  resizeOptions,
  poseDescriptor,
  geometryProjection,
  dispatcher,
  getActionRef,
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
  snapPoint,
  canvasRef,
  canvasApiRef,
  ingestionResolveSrc,
  ingestionSvg,
  ingestionClipboard,
  actionsRegistryRef,
}: {
  selection: SelectionApi;
  scene: Scene<unknown, string, unknown>;
  adapter: BridgeAdapter;
  actions?: ActionsProp;
  /** Kit-standard action ids this canvas's presets and tools leave out. */
  excludeActions: readonly string[];
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
  /** Forwarded from `SceneCanvasProps.geometryProjection` — wires the
   *  `geometryProjection` dep consumed by pose-transform actions (move,
   *  resize, nudge, flip). Conditionally mounted so absent → dep undefined. */
  geometryProjection?: GeometryProjection;
  /** Forwarded so `cancelGestureAction` and other actions that need to
   *  abort in-flight handles can read the dispatcher's control surface. */
  dispatcher: Dispatcher;
  /** Ref populated with a live action-lookup function so the dispatcher's
   *  `getAction` closure can resolve action ids after the registry is
   *  mounted. Set on first render; cleared on unmount. */
  getActionRef: React.MutableRefObject<((id: string) => Action | undefined) | null>;
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
  editAnchorsExternalState: import('../deps/editAnchors').EditAnchorsStateRef;
  layoutDropTarget?: LayoutDropTargetMode;
  reflowTransition?: ReflowTransition<unknown> | null;
  /** Forwarded from `SceneCanvasProps` so `useInsertDepSource` can wire the
   *  consumer's per-kind node factories into the `insert` dep. */
  insertNodeFactories?: Record<string, InsertNodeFactory>;
  insertPaint?: InsertPaint;
  /** Forwarded from `SceneCanvasProps.toolOptions.snapPoint` so the `snap`
   *  dep source can expose grid snapping to `insertAction`. */
  snapPoint?: (p: { x: number; y: number }) => { x: number; y: number };
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
  /** Populated with the live registry so `CanvasExtensionApi.ingest`
   *  (assembled in SceneCanvasInner, OUTSIDE the actions provider) can call
   *  `registry.trigger('ingest', …)`. Cleared on unmount. */
  actionsRegistryRef: React.MutableRefObject<ActionsRegistry | null>;
}) {
  const registry = useActionsRegistry();

  // Stash the registry for SceneCanvasInner's imperative `ingest` handle.
  useEffect(() => {
    actionsRegistryRef.current = registry;
    return () => { actionsRegistryRef.current = null; };
  }, [registry, actionsRegistryRef]);

  // Wire the dispatcher into the registry so registry.begin() can delegate
  // to dispatcher.beginUiOngoing() for UI-driven ongoing actions (color,
  // opacity).
  useEffect(() => {
    if (!registry) return;
    return registry.setDispatcher(dispatcher);
  }, [registry, dispatcher]);

  // Populate the action-lookup ref so the dispatcher's getAction closure
  // can resolve action ids once the registry is in scope.
  useEffect(() => {
    if (!registry) return;
    getActionRef.current = (id: string) => registry.list().find((a) => a.id === id);
    return () => { getActionRef.current = null; };
  }, [registry, getActionRef]);

  // Momentum for `viewport.dragPan`. The loop must be a hook (it owns a
  // `useVisibleRaf`), so it is built here and republished on the view dep.
  const decayLoop = useDecayLoop();

  // Build the ViewApi (stable identity, refreshed closures) and hand it to
  // useStandardActions (which publishes the `view` dep along with selection,
  // scene, history, pointer, activeTool). `hostSize` reads the live canvas
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
  useStandardActions({ selection, scene, view, history: scene.history, exclude: excludeActions });
  // A view overlays `view` with its own camera; this name it leaves alone.
  useDepSource('rootView', () => view);
  const pointer = usePointerContext();
  useDepSource('pointer', () => pointer ?? undefined);

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
  useSliceDepSource(scene, selection, adapter, poseDescriptor);
  useSnapDepSource(snapPoint);
  useDebugDepSource(canvasApiRef);
  useDepChangeNotices(scene, selection.current);
  useIngestionDepSource(canvasRef, () => currentViewRef.current, ingestionResolveSrc, ingestionSvg, ingestionClipboard);
  useLassoSelectDepSource(scene, selection, poseDescriptor, alphaOf);
  useTextEditDepSource(scene);
  useEditAnchorsDepSource(scene, selection, adapter, editAnchorsExternalState);
  useDispatcherDepSource(dispatcher);
  usePoseDescriptorDepSource(poseDescriptor);

  // Keyed on the exclusion too: a re-registration of the standard set would
  // otherwise land over the overrides applied on top of it.
  useActionsPropResolver(actions, excludeActions.join('|'));

  // Gate the `resizePolicy` dep registration on the consumer having
  // passed `selectTool.resize`. When absent, consumers wire it via a child
  // component (see PointSnapDemo / GroupsDemo). Registering empty defaults
  // here would race with child-component registrations — React runs child
  // effects before parent effects, so the parent's empty default would
  // overwrite the child's real value. The conditional mount avoids that.
  //
  // Same pattern for `geometryProjection`: only mount when the consumer
  // passed the prop so absent → dep undefined → actions stay pose-only.
  return (
    <>
      {resizeOptions ? <ResizePolicyRegistrar options={resizeOptions} /> : null}
      {geometryProjection ? <GeometryProjectionRegistrar projection={geometryProjection} /> : null}
    </>
  );
}
