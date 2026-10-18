import type { Action, ActionsProp } from '@weasel-js/routing';
import type { Dispatcher } from '@weasel-js/routing';
import { useActionsRegistry, useDepSource } from '@weasel-js/routing/react';
import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { useDecayLoop } from 'core/viewport/useDecayLoop';
import type { ViewAnimationApi } from 'core/viewport/useViewAnimation';
import type { View } from 'core/viewport/view';
import type { ClipboardIngestCtx } from 'interactions/actions/depSchema';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { useActionSet, useStandardDeps } from 'interactions/actions/useActionSet';
import type React from 'react';
import { useEffect, useMemo } from 'react';
import type { ReflowTransition } from '../../layout/types';
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
  type SnapSources,
} from '../deps';
import type { BridgeAdapter, SceneCanvasProps } from './props';
import { actionsMuting, useActionsPropResolver } from './useActionsPropResolver';
import { useActionTunings } from './useActionTunings';
import { useViewportActions, viewportZoomOption } from './useViewportActions';

/** The `<SceneCanvas>` props the standard actions and their deps read. */
export type StandardActionsProps = Pick<
  SceneCanvasProps<unknown, string, unknown>,
  | 'actions' | 'tune' | 'geometry' | 'viewport' | 'layoutDropTarget'
  | 'reflowTransition' | 'insertNodeFactories' | 'insertPaint' | 'toolOptions' | 'ingestion'
>;

/** What `<SceneCanvas>` hands {@link useSceneStandardActions}. */
export interface SceneStandardActionsInputs {
  props: StandardActionsProps;
  /** `selectTool.rotate === false`, which mutes the rotate action. */
  rotateOff: boolean;
  /** Whether the `view` preset is on; without it the viewport actions are off. */
  viewOn: boolean;
  selection: SelectionApi;
  scene: Scene<unknown, string, unknown>;
  adapter: BridgeAdapter;
  /** The standard actions this canvas registers: its presets' and the ones
   *  its tools bind, in registration order. */
  standardActions: readonly Action[];
  currentViewRef: React.RefObject<View>;
  onViewChange: (v: View) => void;
  /** Wires the `poseDescriptor` dep every built-in pose-touching action reads. */
  poseDescriptor: PoseDescriptor<unknown>;
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
  /** The canvas's camera runner, published on the `view` dep so
   *  `viewport.zoom`'s discrete branches can animate. */
  viewAnimation: ViewAnimationApi;
  /** Lifted edit-mode state so the `pathEditingOverlay` chrome (rendered
   *  outside this subtree) can read the same `editingId` the dep does. */
  editAnchorsExternalState: import('../deps/editAnchors').EditAnchorsStateSource;
  /** The canvas's path snapper, which the `snap` dep composes with
   *  `toolOptions.snapPoint` and `toolOptions.snapTargets` for the drawing
   *  and dragging actions. */
  pathSnapper: SnapSources['paths'];
  /** The canvas element ref, so `useIngestionDepSource` can compute the
   *  visible world rect from the client rect + current view. */
  canvasRef: React.RefObject<HTMLElement | null>;
  /** The canvas handle, whose debug sink backs the `debug` dep. */
  canvasApiRef: React.RefObject<CanvasExtensionApi | null>;
  /** Clipboard-paste ctx (this canvas's adapter + the consumer's reviver)
   *  for the kit weasel-JSON handler, from `useCanvasIngestion`; absent
   *  when disabled. */
  ingestionClipboard?: ClipboardIngestCtx;
}

/**
 * Registers this canvas's standard actions, and the deps they read, into its
 * input scope, then applies the `actions` prop and `tune` over them.
 *
 * Called from a component ahead of `<SceneCanvas>`'s children, never from the
 * canvas's own body: registrations stack newest-live in effect order, and a
 * parent's effects run after its children's, so a child's override would lose.
 */
export function useSceneStandardActions(inputs: SceneStandardActionsInputs): void {
  const {
    props, rotateOff, viewOn, selection, scene, adapter, standardActions, currentViewRef,
    onViewChange, poseDescriptor, dispatcher, pickEvery, layerIsPainted, alphaOf, viewAnimation,
    editAnchorsExternalState, pathSnapper, canvasRef, canvasApiRef, ingestionClipboard,
  } = inputs;
  const { tune, viewport, toolOptions, ingestion } = props;
  const boundsIncludeStroke = props.geometry?.boundsIncludeStroke ?? true;
  const reflowTransition = props.reflowTransition as ReflowTransition<unknown> | null | undefined;
  const actions = useMemo<ActionsProp | undefined>(
    () => (rotateOff ? actionsMuting(props.actions, 'rotate') : props.actions),
    [props.actions, rotateOff],
  );
  const viewportZoom = useMemo(
    () => viewportZoomOption(viewport?.zoom, viewport?.animatedZoom),
    [viewport?.zoom, viewport?.animatedZoom],
  );
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
    viewport?.recenter,
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
  useViewportActions({
    pan: viewOn ? (viewport?.pan ?? true) : false,
    zoom: viewOn ? viewportZoom : false,
    pinchZoom: viewOn ? (viewport?.pinchZoom ?? true) : false,
  });

  // Per-dep wiring modules under `src/canvas/deps/`. See each file for the
  // dep's contract and trade-offs.
  useAreaSelectDepSource(scene, selection, poseDescriptor, alphaOf);
  useNodeAtPointDepSource(pickEvery);
  useLayoutDepSource(scene, props.layoutDropTarget, reflowTransition);
  useInsertDepSource(scene, adapter, props.insertNodeFactories, props.insertPaint);
  usePathLeafDepSources(scene, selection, adapter, poseDescriptor);
  useSnapDepSource(
    { snapPoint: toolOptions?.snapPoint, targets: toolOptions?.snapTargets, paths: pathSnapper },
    currentViewRef,
  );
  useDebugDepSource(canvasApiRef);
  useDepChangeNotices(scene, selection.current, editAnchorsExternalState);
  useIngestionDepSource(canvasRef, () => currentViewRef.current, ingestion?.resolveSrc, ingestion?.svg, ingestionClipboard);
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
}
