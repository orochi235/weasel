/**
 * `<SceneCanvas>` — `<Canvas>` wired to a `Scene` primitive. Bare, it only renders: behavior
 * comes from the `features` presets (`canvas/SceneCanvas/features.ts`), each of which turns on
 * its own actions, tools, ambient bindings, and chrome.
 *
 * A consumer needing custom tools can pass `tools={useTools(...)}` and SceneCanvas forwards it
 * as-is — the internal tool registry is ignored in that case.
 */
import { getActiveModeFor } from '@weasel-js/modes';
import { assignRef, useLatest } from '@weasel-js/react';
import type { Action, ActionsProp, ActionsRegistry } from '@weasel-js/routing';
import { createDispatcher, type Dispatcher } from '@weasel-js/routing';
import { InputScope } from '@weasel-js/routing/react';
import type { Affordance } from 'affordances/types';
import { sceneFromJSON } from 'core/scene/scene';
import { isSerializedScene } from 'core/scene/serialization';
import type { Node, NodeId, Scene } from 'core/scene/types';
import { readOnlySelection } from 'core/selection/readOnlySelection';
import { usePublishSceneSelection } from 'core/selection/usePublishSceneSelection';
import { useSelection, type UseSelectionOptions } from 'core/selection/useSelection';
import { useCanvasCamera } from './SceneCanvas/useCanvasCamera';
import { useHeldModifiers } from './SceneCanvas/useHeldModifiers';
import { never, useHoverTracking } from 'features/chrome-caps';
import { useChromeCaps, type ViewRuleInputs } from 'features/chrome-caps/useChromeCaps';
import { useCanvasIngestion } from 'features/ingestion/useCanvasIngestion';
import { isSelectedNode } from 'features/paths/pathEditState';
import { usePathEditOverlayLayer, usePathEditState } from 'features/paths/usePathEdit';
import type { ViewportZoomOptions } from 'interactions/actions/defaults/viewportZoom';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { UseResizeOptions } from 'interactions/actions/resize/options';
import { KIT_STANDARD_ACTION_IDS } from 'interactions/actions/useStandardActions';
import type React from 'react';
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceProfileProvider, useDeviceProfile } from '../core/device/useDeviceProfile';
import type { RedrawSource } from '../core/layers/render';
import { createNodeRouting } from '../core/scene/NodeRouting';
import { dlog } from '../debug/flag';
import type { DebugConfig } from '../debug/types';
import { createLongPressFeedbackContribution } from '../features/longPress/longPressFeedback';
import type { ReflowTransition } from '../layout/types';
import { installTestHookIfRequested, releaseTestHook } from '../test-hook/install';
import { useTools, type Contribution, type ToolsApi } from '../tools/overlayBinding';
import { Canvas } from './Canvas';
import { builtLayersOf, type CanvasLayers } from './layerSlots';
import { CanvasView, type CanvasViewProps } from './CanvasView';
import { DevHuds } from './SceneCanvas/DevHuds';
import { GestureDispatcherMounter } from './SceneCanvas/GestureDispatcherMounter';
import { PointerProviderIfRoot, PointerPublisher } from './SceneCanvas/PointerProviderIfRoot';
import { worldPointAt } from './SceneCanvas/worldPointAt';
import { StandardActionsRegistrar } from './SceneCanvas/StandardActionsRegistrar';
import { ToolKeybindingsMounter } from './SceneCanvas/ToolKeybindingsMounter';
import { inferredNodeRouting } from './SceneCanvas/defaultNodeRouting';
import { createDispatcherPreviewSources, createGestureSource } from './SceneCanvas/dispatcherGestureBounds';
import {
  featureActionIds,
  featureAmbient,
  featureChromeRules,
  resolveFeatures,
  type FeatureBindingOptions,
} from './SceneCanvas/features';
import {
  mergeLayersWithDefaults,
  type BridgeAdapter,
  type SceneCanvasProps,
} from './SceneCanvas/props';
import { useBuiltinTools } from './SceneCanvas/useBuiltinTools';
import type { ToolsPatch } from './SceneCanvas/toolRegistry';
import { contributionEntries } from './SceneCanvas/useContributionRoles';
import { useDispatcherOverlayLayer } from './SceneCanvas/useDispatcherOverlayLayer';
import { usePreviewGhostLayer } from './SceneCanvas/usePreviewGhostLayer';
import { useSceneSlotLayers } from './SceneCanvas/useSceneSlotLayers';
import { useSelectionOverlayLayer } from './SceneCanvas/useSelectionOverlayLayer';
import type { PickView } from './SceneCanvas/useSceneSelectTool';
import { useSceneSelectTool } from './SceneCanvas/useSceneSelectTool';
import type { CanvasExtensionApi, CanvasViewHandle, SceneCanvasApi } from './canvasExtension';
import { makeGetNodeAtPoint } from './getNodeAtPoint';
import { useSceneAdapter } from './sceneAdapter';
import { createSceneLayerGate, type ViewLayerPaint } from './sceneLayerPaint';
import { composeAlphaFor } from './sceneSlotWiring';
import { createSlopsDebugLayer } from './slopsDebugLayer';
import { useHitObserver } from './useHitObserver';
import { ViewInputsProvider, type SurfaceViewInputs } from './viewInputs';
import { ViewRegistryProvider, useOptionalViewRegistry } from './viewRegistry';
export { SCENE_CANVAS_FEATURES } from './SceneCanvas/features';
export type { Feature } from './SceneCanvas/features';
export type { BuiltinToolOptions } from './SceneCanvas/useBuiltinShapeTools';
export { defaultDrawOne } from './defaultDrawOne';
export { rotateAroundAABBCenter } from './poseRotation';

/** `<SceneCanvas debug>` minus the flag only SceneCanvas reads. */
function canvasDebug(debug: (DebugConfig & { slops?: boolean }) | false): DebugConfig | false {
  if (debug === false) return false;
  const { slops: _slops, ...rest } = debug;
  return rest;
}

/** Discriminate the polymorphic `tools` prop: `ToolsApi` has `setActive`
 *  / `active` / `registry`; the patch record shape has none of those. */
function isToolsApi(
  tools: ToolsApi | ToolsPatch,
): tools is ToolsApi {
  return typeof (tools as ToolsApi).setActive === 'function';
}

function SceneCanvasInner<TData, TLayer extends string, TPose>(
  props: SceneCanvasProps<TData, TLayer, TPose>,
  ref: React.ForwardedRef<SceneCanvasApi>,
) {
  const {
    scene: sceneInput,
    geometry,
    poseDescriptor,
    selectTool: selectToolOpts,
    insertNodeFactories,
    insertPaint,
    ingestion,
    layouts,
    layoutDropTarget,
    reflowTransition,
    geometryProjection,
    routing,
    selection: selectionProp,
    selectionOptions,
    selectable = true,
    tools: toolsProp,
    features,
    enableKeybindings = true,
    claimKeys = false,
    enableGestureDispatcher = true,
    onToolsCreated,
    defaultTools,
    toolOptions,
    initialActiveTool,
    ambient,
    versionCheck,
    longPress,
    viewport,
    layers,
    actions,
    describeKind,
    animator,
    views: viewDescriptors,
    children,
    debug,
    alphaFor,
    layerVisibility,
    layerOrder,
    isPointerInteractive,
    onDoubleClick,
    onClick,
    chromeVisibility,
    modes,
    pathEdit,
    getFocused: getFocusedProp,
    cursorCoordsHud, pickHud, modalityHud,
    ...rest
  } = props;

  const descriptor = (poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<unknown>;

  const deviceProfile = useDeviceProfile();

  // `scene` accepts either a live `Scene` or a `SerializedScene` JSON object. JSON is baked
  // once; later prop changes are ignored (use a `key` on `<SceneCanvas>` to force a fresh canvas).
  const [bakedScene] = useState<Scene<TData, TLayer, TPose> | null>(
    () => (isSerializedScene<TData, TLayer, TPose>(sceneInput) ? sceneFromJSON(sceneInput, {}) : null),
  );
  const scene = bakedScene ?? (sceneInput as Scene<TData, TLayer, TPose>);

  const { view, onViewChange, defaultView, viewBounds, redrawOn: redrawOnProp, ...restProps } = rest;
  const getActiveMode = useMemo(() => (modes ? getActiveModeFor(modes) : undefined), [modes]);
  const heldModifiers = useHeldModifiers();
  // Neither a scene write nor an override write renders this component, and
  // an override write does not bump the scene version either. An animator
  // frame repaints for a `drawOne` reading `animator.colorOverrides`.
  const redrawOn = useMemo((): readonly RedrawSource[] => [
    ...(redrawOnProp ?? []),
    scene,
    scene.overrides,
    heldModifiers,
    ...(animator ? [{ subscribe: (repaint: () => void) => animator.onTick(repaint) }] : []),
    ...(modes ? [modes] : []),
  ], [scene, heldModifiers, animator, modes, redrawOnProp]);

  // Internal canvas ref so the dispatcher can attach its input listeners
  // even when the consumer passes their own forwarded ref.
  const internalCanvasRef = useRef<HTMLElement | null>(null);
  // Holds the full `CanvasExtensionApi` so dispatcher-side gesture pumps can call
  // `requestRedraw`.
  const canvasApiRef = useRef<CanvasExtensionApi | null>(null);
  // Set from the merged ref callback, so effects needing the handle key off it
  // instead of assuming when React attaches it.
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    dlog('scene-canvas', 'mount');
    return () => dlog('scene-canvas', 'unmount');
  }, []);

  const { viewState, viewAnimation, camera } = useCanvasCamera({
    view, defaultView, onViewChange, viewBounds,
    width: restProps.width,
    height: restProps.height,
    requestRedraw: () => { canvasApiRef.current?.requestRedraw(); },
  });
  const { viewRef } = viewState;

  // `animatedZoom` is the SceneCanvas-level spelling of the zoom action's
  // `animate` option, the way `pinchZoom` is of the pinch tool's clamp.
  const animatedZoom = viewport?.animatedZoom;
  const viewportZoomProp = viewport?.zoom ?? true;
  const resolvedViewportZoom = useMemo<boolean | ViewportZoomOptions>(() => {
    if (viewportZoomProp === false) return false;
    const base = typeof viewportZoomProp === 'object' ? viewportZoomProp : {};
    if (!animatedZoom) return base;
    return { ...base, animate: animatedZoom === true ? {} : animatedZoom };
  }, [viewportZoomProp, animatedZoom]);

  // Caller-supplied selection wins; the internally-built one is then unused. Bound to the
  // scene, so the selection an edit was made under rides on the scene's history entries and
  // undo can put it back.
  const derivedSelectionOptions = useMemo<UseSelectionOptions>(
    () => ({ scene, ...(selectionOptions ?? {}) }),
    [scene, selectionOptions],
  );
  const internalSelection = useSelection(derivedSelectionOptions);
  const baseSelection = selectionProp ?? internalSelection;

  // Everything the kit writes selection through — the `selection` dep, the
  // adapter's `setSelection`, ops committed through either — reads this api,
  // so on an unselectable canvas every write path here is closed. The
  // consumer's own api is not wrapped and still writes.
  const selection = selectable ? baseSelection : readOnlySelection(baseSelection);

  usePublishSceneSelection(scene, selection.current, describeKind);

  // `isAllowed` is absent, not a predicate, when no mode registry is wired:
  // see `PathEditSource.isAllowed`.
  const pathEditState = usePathEditState({
    host: pathEdit,
    isAllowed: getActiveMode
      ? () => getActiveMode().allowedCapabilities.has('edits-anchors')
      : undefined,
    isSelectedNode: (id) => isSelectedNode(scene, selection, id),
  });

  const selectToolWithDefaults = useMemo(() => ({
    // Shift-click belongs to the anchor selection while a path is being
    // anchor-edited; see `UseSelectToolOptions.extendClickLocked`.
    extendClickLocked: () => pathEditState.getEditingId() !== '',
    ...selectToolOpts,
  }), [selectToolOpts, pathEditState]);

  // The affordanceAt and classifyTarget thunks live in an effect closure and read the latest
  // selection through this.
  const selectionRef = useLatest(selection);

  // Per-instance NodeRouting registry. Unset `routing` falls back to `inferredNodeRouting`;
  // an explicit `routing={[]}` opts out — the classifier becomes undefined and every hit
  // comes back as `kind: 'unknown'`.
  const kindClassifier = useMemo(() => {
    const effective = routing === undefined ? inferredNodeRouting : routing;
    if (effective.length === 0) return undefined;
    const registry = createNodeRouting();
    for (const k of effective) registry.register(k);
    return (data: TData) => registry.classify(data);
  }, [routing]);

  // Node id → routing-trait kind, for the body classifier, so `target: 'kind:text'` on a
  // binding speaks the same vocabulary as `Hit.kind` and the routing tables. Undefined when
  // `routing={[]}` opts out, which leaves every `kind:` target form unmatchable.
  const kindOfNode = useMemo(() => {
    if (!kindClassifier) return undefined;
    return (id: string): string | undefined => {
      const node = scene.get(id as NodeId);
      return node ? kindClassifier(node.data) : undefined;
    };
  }, [kindClassifier, scene]);

  // The painted alpha of a node in this view: the caller's `alphaFor` times any per-node
  // override alpha. The pick path reads the same number the painter does, or a node faded
  // to nothing stays clickable.
  const composedAlphaFor = useMemo(
    () => composeAlphaFor(scene, alphaFor),
    [scene, alphaFor],
  );

  // What this view paints of each scene layer, judged against the stack
  // `<Canvas>` composed and read at pick time — so a consumer slot anchored
  // between scene layers is weighed the way paint weighs it.
  const surfaceViewRegistry = useOptionalViewRegistry();
  const layerPaintRef = useLatest<ViewLayerPaint>({ layerVisibility, layerOrder });
  const [sceneLayerGate] = useState(createSceneLayerGate);
  const layerIsPainted = useCallback((layerId: string): boolean => (
    sceneLayerGate(surfaceViewRegistry?.surface()?.layers() ?? [], layerPaintRef.current)(layerId)
  ), [surfaceViewRegistry, sceneLayerGate, layerPaintRef]);
  // Absent when this view hides nothing, so the walk skips the gate.
  const viewLayerGate = layerVisibility !== undefined || layerOrder !== undefined
    ? layerIsPainted
    : undefined;

  const adapter = useSceneAdapter(scene, {
    // `adapterMethods` is memoized; `selection` itself is a fresh object each render.
    selection: selection.adapterMethods,
    poseDescriptor: descriptor as PoseDescriptor<TPose>,
    layouts,
  });

  const {
    selectTool: internalSelect, pickEvery: internalPickEvery, pickBest: internalPickBest,
    boundsOf: internalBoundsOf, boundsOfPose: internalBoundsOfPose, planeOfNode: internalPlaneOfNode,
    moveOptions: internalMoveOptions,
  } = useSceneSelectTool({
    scene,
    adapter,
    poseDescriptor: descriptor as PoseDescriptor<TPose>,
    geometry,
    // The pick tolerance is declared in screen pixels; this is what converts it.
    getView: () => viewRef.current,
    // Only when the consumer actually fades something. Without a prop the
    // composed function is just the override lookup, and the source resolves
    // that once per walk instead of once per candidate.
    ...(alphaFor ? { alphaOf: composedAlphaFor } : {}),
    ...(viewLayerGate ? { layerIsPainted: viewLayerGate } : {}),
    selectTool: selectToolWithDefaults,
  });

  // Resolved through the select tool's own single-hit picker, so `onClick`, `onDoubleClick`,
  // hover, and tool routing all name the node a click selects. A hit whose id
  // `isPointerInteractive` rejects comes back null.
  const getNodeAtPoint = useMemo(() => {
    if (!internalPickBest) return undefined;
    const nodeResolver = (id: string) => {
      // A caller's `geometry.pickEvery` can answer an id the scene does not hold.
      const node = adapter.getNode(id);
      if (!node) return null;
      const kind = kindClassifier ? kindClassifier(node.data) : 'unknown';
      return { kind };
    };
    const base = makeGetNodeAtPoint(internalPickBest, nodeResolver);
    if (!isPointerInteractive) return base;
    return (wx: number, wy: number, view?: PickView | null) => {
      const hit = base(wx, wy, view);
      if (hit == null) return null;
      if (isPointerInteractive(hit.id) === false) return null;
      return hit;
    };
  }, [adapter, internalPickBest, isPointerInteractive, kindClassifier]);

  // The presets this canvas runs with. Keyed on the ids, not the array, so an
  // inline `features={['draw']}` does not re-derive every render.
  const featuresKey = (features ?? []).join('|');
  const hasViewport = viewport !== undefined;
  const enabled = useMemo(
    () => resolveFeatures(features, { viewport: hasViewport }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [featuresKey, hasViewport],
  );

  // Takeover form: only when toolsProp is the full ToolsApi shape.
  const toolsTakeover = toolsProp && isToolsApi(toolsProp) ? toolsProp : null;
  const internalRegistry = useBuiltinTools({
    select: internalSelect,
    enabled,
    defaultTools,
    patch: toolsProp && !isToolsApi(toolsProp) ? toolsProp : null,
    toolOptions,
    inertia: viewport?.inertia,
  });

  const defaultLongPressFeedback = useMemo(() => createLongPressFeedbackContribution(), []);
  const feedbackOpt = longPress?.feedback ?? true;
  const pressFeedback = feedbackOpt === true ? defaultLongPressFeedback : feedbackOpt || null;
  const mergedAmbient = useMemo(
    () => (pressFeedback ? [...(ambient ?? []), pressFeedback] : (ambient ?? [])),
    [ambient, pressFeedback],
  );

  const internalTools = useTools({
    active: initialActiveTool ?? ('select' in internalRegistry ? 'select' : null),
    registry: internalRegistry,
    ...(mergedAmbient.length ? { ambient: mergedAmbient } : {}),
    ...(modes ? { modes } : {}),
  });

  const tools = toolsTakeover ?? internalTools;
  const liveToolsRef = useLatest<ToolsApi | null>(tools);

  // The presets' ambient bindings. They are not tools and sit outside `tools`,
  // so they apply under a takeover too.
  const rotateOptions = selectToolOpts?.rotate || undefined;
  const featureContributions = useMemo<Contribution[]>(
    () => featureAmbient(enabled, {
      move: internalMoveOptions as FeatureBindingOptions['move'],
      rotate: rotateOptions as FeatureBindingOptions['rotate'],
    }),
    [enabled, internalMoveOptions, rotateOptions],
  );

  // Kit-standard actions to register: every preset's own, plus whichever a
  // tool or contribution on this canvas binds — a tool brings the actions it
  // routes to, so `defaultTools={['rect']}` works under any preset.
  const standardActionsExclude = useMemo(() => {
    const include = featureActionIds(enabled);
    const bound = [
      ...Object.values(tools.registry),
      ...tools.ambient,
      ...featureContributions,
    ];
    for (const entry of bound) {
      for (const b of entry.bindings ?? []) include.add(b.actionId);
    }
    return KIT_STANDARD_ACTION_IDS.filter((id) => !include.has(id));
  }, [enabled, tools, featureContributions]);

  // Surface the resolved ToolsApi to the introspection callback whenever the `tools`
  // identity changes.
  const onToolsCreatedRef = useLatest(onToolsCreated);
  useEffect(() => { onToolsCreatedRef.current?.(tools); }, [tools, onToolsCreatedRef]);

  // Rides the gesture dispatcher as an OBSERVER rather than an Action binding because the
  // prop is a notification, not a behavior: as a binding it would lose first-match-wins to
  // `enterPathEdit` on every body hit and silently stop firing.
  const getNodeAtPointRef = useLatest(getNodeAtPoint);
  const onDoubleClickObserver = useHitObserver(onDoubleClick, getNodeAtPointRef);
  const onClickObserver = useHitObserver(onClick, getNodeAtPointRef);

  // When `layers` is omitted the result is the full default set (scene + selectionOverlay).
  // Partial configs deep-merge; `null` slot values suppress a default explicitly.
  const mergedLayers = useMemo(
    () => mergeLayersWithDefaults(layers, deviceProfile.targetScale),
    [layers, deviceProfile.targetScale],
  );

  // `selectTool.rotate === false` disables rotation: drop the `rotate` action. A
  // consumer-supplied `rotate` override still wins; `actions === null` (all defaults
  // disabled) is left untouched.
  const resolvedActions = useMemo<ActionsProp | undefined>(() => {
    if (selectToolOpts?.rotate !== false) return actions;
    if (actions === null) return null;
    const merged = { ...(actions ?? {}) } as Record<string, unknown>;
    if (!('rotate' in merged)) merged.rotate = null;
    return merged as ActionsProp;
  }, [actions, selectToolOpts?.rotate]);

  // Stable action-lookup getter threaded into the dispatcher so
  // beginUiOngoing can resolve action ids at call time. Populated by
  // StandardActionsRegistrar once it has the registry in scope.
  const getActionRef = useRef<((id: string) => Action | undefined) | null>(null);

  // One `Dispatcher` per `<SceneCanvas>`, shared by the gesture-dispatcher mounter (which
  // pumps input events into it) and the preview-ghost layer (which walks its in-flight
  // handles).
  const dispatcherRef = useRef<Dispatcher | null>(null);
  if (!dispatcherRef.current) {
    dispatcherRef.current = createDispatcher({
      getAction: (id) => getActionRef.current?.(id),
    });
  }
  const dispatcher = dispatcherRef.current;

  // The dispatcher's contribution to `helpersRef` — in-flight preview ids,
  // nascent-insert bounds, and the pump signal. Reads through the ref so one
  // stable object keeps pointing at the live dispatcher.
  const [gestureSource] = useState(() => createGestureSource(() => dispatcherRef.current));

  // The dispatcher's half of this view's overlay-aware lookups: whose
  // committed paint a ghost hides, and the pose a handle proposes for an id.
  const [{ previewIdsExtra, previewPoseExtra }] = useState(
    () => createDispatcherPreviewSources(() => dispatcherRef.current),
  );

  const { config: sceneSlot, layers: sceneLayers } = useSceneSlotLayers({
    slot: mergedLayers.scene,
    scene,
    adapter,
    alphaFor,
    colorOverrides: animator?.colorOverrides,
    boundsOf: internalBoundsOf,
    previewIds: previewIdsExtra,
  });

  // Renders in-flight gesture poses on top of the committed scene using the scene slot's
  // `drawOne`. It takes the scene-wired slot, so a ghosted derived node still resolves its path.
  const previewLayer = usePreviewGhostLayer<TData, TLayer, TPose>({
    scene,
    sceneSlot,
    dispatcher,
  });

  // Marquee rect, lasso polyline, and any other `OngoingHandle.overlay()` shapes. Slotted
  // after the preview-ghost so chrome paints on top of displaced ghost silhouettes.
  const dispatcherOverlay = useDispatcherOverlayLayer({ dispatcher });

  // Chrome-caps hover tracking: the last-hovered NodeId fed into `RuleCtx.hover`, cached
  // on a ref with no re-renders.
  const { getHover, canvasRef: trackHoverOn } = useHoverTracking({
    // One lookup, not a client→world thunk beside a picker: the point and the
    // camera its tolerance converts against have to come from the same view.
    // Hover has no pointer to capture, so it resolves fresh — whichever view
    // is under the cursor right now owns the point.
    nodeAtClientPoint: (clientX, clientY) => {
      const api = canvasApiRef.current;
      if (!api) return null;
      const target = surfaceViewRegistry?.resolver.at(null, clientX, clientY);
      const view = target?.view ?? viewRef.current;
      const [x, y] = worldPointAt(api, target, clientX, clientY);
      // A view judges its own layers; the surface's gate is the picker's default.
      const reg = target?.id != null
        ? surfaceViewRegistry?.list().find((r) => r.id === target.id)
        : undefined;
      const hit = getNodeAtPointRef.current?.(
        x, y, reg ? { scale: view.scale, layerIsPainted: reg.layerIsPainted } : view,
      );
      return hit ? { id: hit.id as NodeId } : null;
    },
    enabled: chromeVisibility !== undefined,
  });

  // `selectable={false}` suppresses the marquee / lasso chrome by default:
  // every selection write no-ops then, so the select tool's
  // empty-drag binding still CLAIMS the gesture (keeping it from falling
  // through to other ambient drag actions like insert) but paints nothing.
  // An explicit consumer rule for either id still wins.
  const chromeRules = useMemo(() => {
    // Kit defaults first; consumer `chromeVisibility` spread last so it wins.
    const defaults = featureChromeRules(enabled);
    if (!selectable) {
      defaults['action.marquee'] = never;
      defaults['action.lasso'] = never;
    }
    // `selectTool.rotate === false` hides the rotation handle (`resolvedActions`
    // drops its action) so a non-rotatable consumer fully opts out.
    if (selectToolOpts?.rotate === false) defaults['selection.rotation-handle'] = never;
    return { ...defaults, ...chromeVisibility };
  }, [chromeVisibility, selectable, selectToolOpts?.rotate, enabled]);

  const chromeCaps = useChromeCaps({
    rules: chromeRules,
    getMode: getActiveMode,
    getFocused: getFocusedProp,
    getHover,
    getModifiers: heldModifiers.get,
    resizable: selectToolOpts?.resize?.resizable,
    editingAnchors: () => pathEditState.getEditingId() !== '',
    device: deviceProfile,
  });

  // The selection as of the last commit, which is what the painted chrome was
  // built from; `selection.current` can be a live getter that is ahead of it.
  const committedSelectionRef = useLatest(selection.current as readonly NodeId[]);
  /** The surface's own view zero. */
  const currentRuleInputs = useCallback((): ViewRuleInputs => ({
    selection: committedSelectionRef.current,
    view: viewRef.current,
    action: dispatcher.getActiveAction(),
  }), [dispatcher, committedSelectionRef, viewRef]);
  const getIsVisibleForCanvas = useCallback(
    (): ((id: string) => boolean) => chromeCaps.isVisible(currentRuleInputs()),
    [chromeCaps, currentRuleInputs],
  );
  const getRuleCtxForCanvas = useCallback(
    () => chromeCaps.ruleCtx(currentRuleInputs()),
    [chromeCaps, currentRuleInputs],
  );

  const sceneRef = useLatest(scene);
  const slopsOn = debug !== undefined && debug !== false && debug.slops === true;
  // Debug: slops viz layer (off by default). Draws the affordances the
  // gesture mounter hit-tests, which it publishes here, so the halos are the
  // hit regions rather than a copy of them.
  const chromeAffordancesRef = useRef<readonly Affordance[]>([]);
  const slopsLayer = useMemo(
    () => createSlopsDebugLayer({ getAffordances: () => chromeAffordancesRef.current }),
    [],
  );

  const pathEditingOverlayLayer = usePathEditOverlayLayer(pathEditState, {
    nodeOf: (id) => scene.get(id as NodeId),
    planeOfNode: internalPlaneOfNode,
  });

  const { layer: selectionOverlayLayer, rotationBadge } = useSelectionOverlayLayer<TPose>(
    mergedLayers.selectionOverlay,
    pathEditState.getEditingIds, descriptor as PoseDescriptor<TPose>,
  );

  const wiredLayers = useMemo<CanvasLayers>(() => ({
    ...builtLayersOf(mergedLayers),
    scene: sceneLayers,
    selectionOverlay: selectionOverlayLayer ? { layer: selectionOverlayLayer } : null,
    previewGhost: { layer: previewLayer, after: 'scene' },
    dispatcherOverlay: { layer: dispatcherOverlay, after: 'previewGhost' },
    pathEditingOverlay: { layer: pathEditingOverlayLayer, after: 'selectionOverlay' },
    ...(slopsOn ? { slopsDebug: { layer: slopsLayer, after: 'pathEditingOverlay' } } : {}),
  }), [mergedLayers, sceneLayers, selectionOverlayLayer, previewLayer, dispatcherOverlay, pathEditingOverlayLayer, slopsOn, slopsLayer]);

  // `StandardActionsRegistrar` stashes the registry into this ref.
  const actionsRegistryRef = useRef<ActionsRegistry | null>(null);

  const { ingest, clipboard: ingestionClipboard } = useCanvasIngestion(
    adapter, () => actionsRegistryRef.current, ingestion,
  );

  // Views added through the handle rather than declared as props or children.
  const [addedViews, setAddedViews] = useState<readonly CanvasViewProps[]>([]);
  const addView = useCallback((props: CanvasViewProps): CanvasViewHandle => {
    setAddedViews((list) => [...list.filter((v) => v.id !== props.id), props]);
    return {
      id: props.id,
      draw: (data, outer, dims) =>
        surfaceViewRegistry?.list().find((r) => r.id === props.id)?.layer.draw(data, outer, dims) ?? [],
      remove: () => setAddedViews((list) => list.filter((v) => v !== props)),
    };
  }, [surfaceViewRegistry]);

  // Merge the forwarded ref with our internalCanvasRef so the dispatcher can read the canvas
  // element. The consumer's handle extends the primitive's with `ingest`, which needs the
  // action stack.
  const mergedRef = useCallback(
    (node: CanvasExtensionApi | null) => {
      internalCanvasRef.current = node?.element ?? null;
      trackHoverOn(internalCanvasRef.current);
      const extended: SceneCanvasApi | null = node
        ? {
            ...node,
            ingest,
            animateView: viewAnimation.animate,
            stopViewAnimation: viewAnimation.stop,
            isViewAnimating: viewAnimation.isAnimating,
            camera,
            addView,
          }
        : null;
      canvasApiRef.current = extended;
      setCanvasReady(extended !== null);
      assignRef(ref, extended);
    },
    [ref, ingest, viewAnimation, camera, addView, trackHoverOn],
  );

  // What a view needs to build its own overlay-aware state. `geometry` is the
  // same descriptor handed to `<Canvas>`, so the two cannot diverge.
  const viewInputs = useMemo<SurfaceViewInputs>(() => ({
    adapter: adapter as unknown as { getPose(id: string): unknown },
    geometry: descriptor,
    boundsOf: internalBoundsOf,
    boundsOfPose: internalBoundsOfPose as SurfaceViewInputs['boundsOfPose'],
    planeOfNode: internalPlaneOfNode,
    pickEvery: internalPickEvery,
    pickBest: internalPickBest,
    kindOfNode,
    chromeCaps,
    selectionApi: selection,
    rotationBadge,
  }), [adapter, descriptor, internalBoundsOf, internalBoundsOfPose, internalPlaneOfNode,
       internalPickEvery, internalPickBest, kindOfNode, chromeCaps, selection, rotationBadge]);

  const canvas = (
    <Canvas<Node<TData, TLayer, TPose>, TPose>
      ref={mergedRef}
      adapter={adapter}
      selection={selection}
      poseDescriptor={descriptor as PoseDescriptor<TPose>}
      tools={tools}
      layers={wiredLayers}
      // The chrome's bounds are the picker's: a node on a parallax plane is
      // boxed where the plane draws it, and a `geometry.boundsOf` reaches both.
      boundsOf={internalBoundsOf}
      boundsOfPose={internalBoundsOfPose}
      getIsVisible={getIsVisibleForCanvas}
      // The gesture surface behind `helpersRef.getGestureBounds()` /
      // `subscribeGestures()` — Canvas has no dispatcher of its own.
      gestureSource={gestureSource}
      previewPoseExtra={previewPoseExtra}
      {...(debug !== undefined ? { debug: canvasDebug(debug) } : {})}
      contentVersion={scene.getVersion}
      layerVisibility={layerVisibility}
      layerOrder={layerOrder}
      viewState={viewState}
      {...(redrawOn ? { redrawOn } : {})}
      {...restProps}
    />
  );

  // Test hook: opt-in via ?test=1, never in production builds. See src/test-hook.
  useEffect(() => {
    // The gate must sit at the call site: a consumer's production build constant-folds
    // `process.env.NODE_ENV` and drops this block, but a called function can't be
    // tree-shaken even if its body is dead.
    if (process.env.NODE_ENV !== 'production') {
      const hook = installTestHookIfRequested({
        getScene: () => sceneRef.current as never,
        getSelectionIds: () =>
          (selectionRef.current?.current as readonly string[] | undefined) ?? [],
        getView: () => viewRef.current,
        getActiveToolId: () => liveToolsRef.current?.active ?? null,
      });
      if (hook) {
        hook._markReady();
        return () => releaseTestHook(hook);
      }
    }
    return undefined;
  }, [sceneRef, selectionRef, liveToolsRef, viewRef]);

  return (
    <ViewInputsProvider value={viewInputs}>
      <PointerProviderIfRoot>
        {canvas}
        <DevHuds
          cursorCoords={cursorCoordsHud}
          pick={pickHud}
          modality={modalityHud}
          canvasRef={internalCanvasRef}
          canvasApiRef={canvasApiRef}
          detachedInput={restProps.paintInto ? restProps.inputElement ?? null : undefined}
          viewRef={viewRef}
          pickEvery={internalPickEvery}
          pickBest={internalPickBest}
        />
        <PointerPublisher canvasRef={internalCanvasRef} canvasApiRef={canvasApiRef} />
        <StandardActionsRegistrar
          selection={selection}
          scene={scene}
          adapter={adapter as unknown as BridgeAdapter}
          actions={resolvedActions}
          excludeActions={standardActionsExclude}
          currentViewRef={viewRef}
          onViewChange={viewState.setViewFromInput}
          resizeOptions={selectToolOpts?.resize as UseResizeOptions<unknown> | undefined}
          poseDescriptor={descriptor}
          geometryProjection={geometryProjection}
          dispatcher={dispatcher}
          getActionRef={getActionRef}
          pickEvery={internalPickEvery}
          layerIsPainted={viewLayerGate}
          alphaOf={alphaFor ? composedAlphaFor : undefined}
          viewportPanEnabled={enabled.has('view') ? (viewport?.pan ?? true) : false}
          viewportZoom={enabled.has('view') ? resolvedViewportZoom : false}
          viewportPinchZoom={enabled.has('view') ? (viewport?.pinchZoom ?? true) : false}
          viewportRecenter={viewport?.recenter}
          viewAnimation={viewAnimation}
          editAnchorsExternalState={pathEditState}
          layouts={layouts as SceneCanvasProps<unknown, string, unknown>['layouts']}
          layoutDropTarget={layoutDropTarget}
          reflowTransition={reflowTransition as ReflowTransition<unknown> | null | undefined}
          insertNodeFactories={insertNodeFactories}
          insertPaint={insertPaint}
          snapPoint={toolOptions?.snapPoint}
          canvasRef={internalCanvasRef}
          canvasApiRef={canvasApiRef}
          ingestionResolveSrc={ingestion?.resolveSrc}
          ingestionSvg={ingestion?.svg}
          ingestionClipboard={ingestionClipboard}
          actionsRegistryRef={actionsRegistryRef}
        />
        <GestureDispatcherMounter
          canvasRef={internalCanvasRef}
          canvasApiRef={canvasApiRef}
          tools={tools}
          contributions={featureContributions}
          enabled={enableGestureDispatcher}
          keyboard={enableKeybindings}
          claimKeys={claimKeys}
          selectionRef={selectionRef}
          boundsOf={internalBoundsOf}
          planeOfNode={internalPlaneOfNode}
          pickEvery={internalPickEvery}
          pickBest={internalPickBest}
          kindOfNode={kindOfNode}
          viewRef={viewRef}
          dispatcher={dispatcher}
          getIsVisibleForCanvas={getIsVisibleForCanvas}
          getRuleCtx={getRuleCtxForCanvas}
          targetScale={deviceProfile.targetScale}
          handleHitRadius={selectToolOpts?.handleHitRadius}
          rotationBadge={rotationBadge}
          chromeAffordancesRef={chromeAffordancesRef}
          onDoubleClick={onDoubleClickObserver}
          onClick={onClickObserver}
          longPress={longPress}
        />
        <ToolKeybindingsMounter
          internalTools={internalTools}
          toolsTakeover={toolsTakeover ?? undefined}
          enableKeybindings={enableKeybindings}
          modes={modes}
          canvasApi={canvasReady ? canvasApiRef.current : null}
          versionCheck={versionCheck}
        />
        {viewDescriptors?.map((v, i) => (
          <CanvasView key={v.id} {...v} order={v.order ?? i} />
        ))}
        {contributionEntries(tools).flatMap((e) => e.views ?? []).map((v) => (
          <CanvasView key={`contribution:${v.id}`} {...v} />
        ))}
        {addedViews.map((v) => <CanvasView key={`added:${v.id}`} {...v} />)}
        {children}
      </PointerProviderIfRoot>
    </ViewInputsProvider>
  );
}

const SceneCanvasInnerForwardRef = forwardRef(SceneCanvasInner);

// The canvas's input scope sits above `SceneCanvasInner`, whose own hooks
// (`useTools` among them) must already read this canvas's tool and registries.
// Its device profile too, so the canvas and everything under it share one.
function SceneCanvasWrapper<TData, TLayer extends string, TPose>(
  { device, ...props }: SceneCanvasProps<TData, TLayer, TPose>,
  ref: React.ForwardedRef<SceneCanvasApi>,
) {
  return (
    <InputScope yoke={props.yoke}>
      <DeviceProfileProvider value={device}>
        <ViewRegistryProvider>
          <SceneCanvasInnerForwardRef {...(props as SceneCanvasProps<unknown, string, unknown>)} ref={ref} />
        </ViewRegistryProvider>
      </DeviceProfileProvider>
    </InputScope>
  );
}

/**
 * The canvas component: renders a `Scene` and wires the interaction stack
 * around it.
 *
 * Mounted bare it renders the scene, keeps a selection no input sets, and
 * runs a gesture dispatcher for whatever bindings the consumer adds. The
 * `features` presets turn the kit's behavior on — `features={['draw']}` is the
 * whole editor: tools, standard actions and their keys, selection chrome,
 * undo. This is the intended entry point; the lower-level primitives it
 * composes are not part of the public surface.
 *
 * Its ref exposes a `SceneCanvasApi` for the imperative operations that do not
 * fit a prop (view control, hit queries, redraw requests).
 */
export const SceneCanvas = forwardRef(SceneCanvasWrapper) as <
  TData, TLayer extends string, TPose,
>(
  props: SceneCanvasProps<TData, TLayer, TPose> & { ref?: React.Ref<SceneCanvasApi> },
) => ReturnType<typeof SceneCanvasInner>;

export { DEFAULT_HANDLE_SIZE, mergeLayersWithDefaults, BUILTIN_TOOL_IDS } from './SceneCanvas/props';
export type {
  SceneCanvasProps,
  SceneCanvasHit,
  SceneCanvasLayers,
  SceneCanvasLongPress,
  BuiltinToolId,
} from './SceneCanvas/props';
export type { CoordTraceEntry } from './SceneCanvas/coordTrace';
