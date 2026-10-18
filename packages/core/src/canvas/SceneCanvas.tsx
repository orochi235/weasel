/**
 * `<SceneCanvas>` — `<Canvas>` wired to a `Scene` primitive. Bare, it only renders: behavior
 * comes from the `features` presets (`canvas/SceneCanvas/features.ts`), each of which turns on
 * its own actions, tools, ambient bindings, and chrome.
 *
 * A consumer needing custom tools can pass `tools={useTools(...)}` and SceneCanvas forwards it
 * as-is — the internal tool registry is ignored in that case.
 */
import { getActiveModeFor } from '@weasel-js/modes';
import { useLatest } from '@weasel-js/react';
import type { ActionsProp } from '@weasel-js/routing';
import { InputScope, useActionsRegistry } from '@weasel-js/routing/react';
import { sceneFromJSON } from 'core/scene/scene';
import { isSerializedScene } from 'core/scene/serialization';
import type { NodeId, Scene } from 'core/scene/types';
import { useCanvasCamera } from './SceneCanvas/useCanvasCamera';
import { useHeldModifiers } from './SceneCanvas/useHeldModifiers';
import { useCanvasIngestion } from 'features/ingestion/useCanvasIngestion';
import { isSelectedNode } from 'features/paths/pathEditState';
import { usePathEditState } from 'features/paths/usePathEdit';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { UseResizeOptions } from 'interactions/actions/resize/options';
import type React from 'react';
import { forwardRef, useEffect, useMemo, useRef, useState } from 'react';
import { DeviceProfileProvider, useDeviceProfile } from '../core/device/useDeviceProfile';
import { dlog } from '../debug/flag';
import type { ReflowTransition } from '../layout/types';
import { useTestHook } from '../test-hook/useTestHook';
import { Canvas } from './Canvas';
import { CanvasView } from './CanvasView';
import { canvasDebug, DevHuds } from './SceneCanvas/DevHuds';
import { GestureDispatcherMounter } from './SceneCanvas/GestureDispatcherMounter';
import { CanvasKitProviders } from './SceneCanvas/CanvasKitProviders';
import { PointerPublisher } from './SceneCanvas/PointerProviderIfRoot';
import { StandardActionsRegistrar } from './SceneCanvas/StandardActionsRegistrar';
import { ToolKeybindingsMounter } from './SceneCanvas/ToolKeybindingsMounter';
import type { FeatureBindingOptions, PresetSource } from './SceneCanvas/features';
import { CORE_PRESET_SOURCE } from './SceneCanvas/namedPresets';
import type { BridgeAdapter, SceneCanvasProps } from './SceneCanvas/props';
import { actionsMuting } from './SceneCanvas/useActionsPropResolver';
import { useCanvasDispatcher } from './SceneCanvas/useCanvasDispatcher';
import { useCanvasSelection } from './SceneCanvas/useCanvasSelection';
import { useCanvasTools, useEnabledFeatures, useFeatureBindings } from './SceneCanvas/useCanvasTools';
import { contributionEntries } from './SceneCanvas/useContributionRoles';
import { useNodeAtPoint } from './SceneCanvas/useNodeAtPoint';
import { useNodeKinds } from './SceneCanvas/useNodeKinds';
import { useAddedViews, useSceneCanvasHandle } from './SceneCanvas/useSceneCanvasHandle';
import { useSceneCanvasLayers } from './SceneCanvas/useSceneCanvasLayers';
import { useChromeRules, useSceneHover, useSurfaceChromeCaps } from './SceneCanvas/useSceneChrome';
import { useSceneRedrawSources } from './SceneCanvas/useSceneRedrawSources';
import { useSceneSelectTool } from './SceneCanvas/useSceneSelectTool';
import { useViewLayerGate } from './SceneCanvas/useViewLayerGate';
import { usePathSnapper } from './SceneCanvas/usePathSnapper';
import { viewportZoomOption } from './SceneCanvas/useViewportActions';
import type { CanvasExtensionApi, SceneCanvasApi } from './canvasExtension';
import { useSceneAdapter } from './useSceneAdapter';
import { composeAlphaFor } from './sceneSlotWiring';
import { useHitObserver } from './useHitObserver';
import type { SurfaceViewInputs } from './viewInputs';
import { ViewRegistryProvider } from './viewRegistry';
export { SCENE_CANVAS_FEATURES, type Feature } from './SceneCanvas/features';
export type { BuiltinToolOptions } from './SceneCanvas/useBuiltinShapeTools';
export { defaultDrawOne } from './defaultDrawOne';
export { rotateAroundAABBCenter } from './poseRotation';

function SceneCanvasInner<TData, TLayer extends string, TPose>(
  props: SceneCanvasProps<TData, TLayer, TPose> & { presetSource: PresetSource },
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
    layoutDropTarget,
    reflowTransition,
    geometryProjection,
    routing,
    selection: selectionProp,
    selectionOptions,
    selectable = true,
    tools: toolsProp,
    features, presetSource,
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
    actions, tune,
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
    pathEdit, defaultPathEdit, getFocused: getFocusedProp,
    cursorCoordsHud, pickHud, modalityHud,
    view, onViewChange, defaultView, viewBounds, redrawOn: redrawOnProp,
    ...restProps
  } = props;

  const descriptor = (poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<TPose>;
  const deviceProfile = useDeviceProfile();

  // `scene` accepts either a live `Scene` or a `SerializedScene` JSON object. JSON is baked
  // once; later prop changes are ignored (use a `key` on `<SceneCanvas>` to force a fresh canvas).
  const [bakedScene] = useState<Scene<TData, TLayer, TPose> | null>(
    () => (isSerializedScene<TData, TLayer, TPose>(sceneInput) ? sceneFromJSON(sceneInput, {}) : null),
  );
  const scene = bakedScene ?? (sceneInput as Scene<TData, TLayer, TPose>);

  const getActiveMode = useMemo(() => (modes ? getActiveModeFor(modes) : undefined), [modes]);
  const heldModifiers = useHeldModifiers();
  const redrawOn = useSceneRedrawSources({ supplied: redrawOnProp, scene, heldModifiers, animator, modes });

  // The canvas element, kept here so the dispatcher can attach its input listeners even when
  // the consumer passes their own forwarded ref, and the full handle, for `requestRedraw`.
  const internalCanvasRef = useRef<HTMLElement | null>(null);
  const canvasApiRef = useRef<CanvasExtensionApi | null>(null);

  useEffect(() => {
    dlog('scene-canvas', 'mount');
    return () => dlog('scene-canvas', 'unmount');
  }, []);

  const declaredSize = useLatest({ width: restProps.width ?? 0, height: restProps.height ?? 0 });
  const { viewState, viewAnimation, camera } = useCanvasCamera({
    view, defaultView, onViewChange, viewBounds,
    dims: () => canvasApiRef.current?.getSurfaceRect() ?? declaredSize.current,
    requestRedraw: () => { canvasApiRef.current?.requestRedraw(); },
  });
  const { viewRef } = viewState;

  const viewportZoomProp = viewport?.zoom;
  const animatedZoom = viewport?.animatedZoom;
  const resolvedViewportZoom = useMemo(
    () => viewportZoomOption(viewportZoomProp, animatedZoom),
    [viewportZoomProp, animatedZoom],
  );

  const selection = useCanvasSelection({
    scene, supplied: selectionProp, options: selectionOptions, selectable, describeKind,
  });

  const enabled = useEnabledFeatures(features, presetSource.named, viewport !== undefined);
  // `isAllowed` is absent, not a predicate, when no mode registry is wired: see `PathEditSource.isAllowed`.
  const pathEditState = usePathEditState({
    host: pathEdit, opening: defaultPathEdit,
    isAllowed: getActiveMode
      ? () => getActiveMode().allowedCapabilities.has('edits-anchors')
      : undefined,
    isSelectedNode: (id) => isSelectedNode(scene, selection, id),
    extensions: enabled.pathEdit,
  });

  const selectToolWithDefaults = useMemo(() => ({
    // Shift-click belongs to the anchor selection while a path is being
    // anchor-edited; see `UseSelectToolOptions.extendClickLocked`.
    extendClickLocked: () => pathEditState.getEditingId() !== '',
    ...selectToolOpts,
  }), [selectToolOpts, pathEditState]);

  const selectionRef = useLatest(selection);
  const { kindOfData, kindOfNode } = useNodeKinds(scene, routing);

  // The painted alpha of a node in this view: the caller's `alphaFor` times any per-node
  // override alpha. The pick path reads the same number the painter does, or a node faded
  // to nothing stays clickable.
  const composedAlphaFor = useMemo(
    () => composeAlphaFor(scene, alphaFor),
    [scene, alphaFor],
  );
  const viewLayerGate = useViewLayerGate(layerVisibility, layerOrder);

  const adapter = useSceneAdapter(scene, {
    // `adapterMethods` is memoized; `selection` itself is a fresh object each render.
    selection: selection.adapterMethods,
    poseDescriptor: descriptor,
  });

  const {
    selectTool: internalSelect, pickEvery: internalPickEvery, pickBest: internalPickBest,
    boundsOf: internalBoundsOf, boundsOfPose: internalBoundsOfPose, planeOfNode: internalPlaneOfNode,
    moveOptions: internalMoveOptions,
  } = useSceneSelectTool({
    scene,
    adapter,
    poseDescriptor: descriptor,
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

  const getNodeAtPoint = useNodeAtPoint({
    pickBest: internalPickBest, nodes: adapter, kindOfData, isPointerInteractive,
  });

  const { tools, internal: internalTools, takeover: toolsTakeover } = useCanvasTools({
    select: internalSelect,
    enabled,
    tools: toolsProp,
    defaultTools,
    toolOptions,
    inertia: viewport?.inertia,
    ambient,
    pressFeedback: longPress?.feedback,
    initialActiveTool,
    modes,
    onToolsCreated,
  });
  const { contributions: featureContributions, standardActions } = useFeatureBindings({
    enabled, pool: presetSource.pool,
    tools,
    move: internalMoveOptions as FeatureBindingOptions['move'],
    rotate: (selectToolOpts?.rotate || undefined) as FeatureBindingOptions['rotate'],
  });

  // Rides the gesture dispatcher as an OBSERVER rather than an Action binding because the
  // prop is a notification, not a behavior: as a binding it would lose first-match-wins to
  // `enterPathEdit` on every body hit and silently stop firing.
  const getNodeAtPointRef = useLatest(getNodeAtPoint);
  const onDoubleClickObserver = useHitObserver(onDoubleClick, getNodeAtPointRef);
  const onClickObserver = useHitObserver(onClick, getNodeAtPointRef);

  // `selectTool.rotate === false` disables rotation: its action is muted here and its
  // handle hidden by `useChromeRules`.
  const rotateOff = selectToolOpts?.rotate === false;
  const resolvedActions = useMemo<ActionsProp | undefined>(
    () => (rotateOff ? actionsMuting(actions, 'rotate') : actions),
    [actions, rotateOff],
  );

  // The wrapper's `<InputScope>` provides it.
  const actionsRegistry = useActionsRegistry();
  const { dispatcher, gestureSource, previewIdsExtra, previewPoseExtra } = useCanvasDispatcher(actionsRegistry);

  const pathSnapper = usePathSnapper(scene as Scene<unknown, string, unknown>, toolOptions?.pathSnap);
  const { layers: wiredLayers, rotationBadge, chromeAffordancesRef } = useSceneCanvasLayers({
    layers,
    targetScale: deviceProfile.targetScale,
    scene,
    adapter,
    poseDescriptor: descriptor,
    alphaFor,
    colorOverrides: animator?.colorOverrides,
    boundsOf: internalBoundsOf,
    planeOfNode: internalPlaneOfNode,
    previewIds: previewIdsExtra,
    dispatcher, pathSnapper,
    pathEditState,
    slops: debug !== undefined && debug !== false && debug.slops === true,
  });

  const { getHover, canvasRef: trackHoverOn } = useSceneHover({
    canvasApiRef, viewRef, nodeAtPointRef: getNodeAtPointRef, enabled: chromeVisibility !== undefined,
  });
  const chromeRules = useChromeRules({ enabled, selectable, rotateOff, chromeVisibility });
  const { chromeCaps, getIsVisible: getIsVisibleForCanvas, getRuleCtx: getRuleCtxForCanvas } = useSurfaceChromeCaps({
    source: {
      rules: chromeRules,
      getMode: getActiveMode,
      getFocused: getFocusedProp,
      getHover,
      getModifiers: heldModifiers.get,
      resizable: selectToolOpts?.resize?.resizable,
      editingAnchors: () => pathEditState.getEditingId() !== '',
      device: deviceProfile,
    },
    selection: selection.current as readonly NodeId[],
    viewRef,
    dispatcher,
  });

  const { ingest, clipboard: ingestionClipboard } = useCanvasIngestion(
    adapter, () => actionsRegistry, ingestion,
  );

  const { views: addedViews, addView } = useAddedViews();
  // The consumer's handle extends the primitive's with `ingest`, which needs the action stack.
  const { handleRef, ready: canvasReady } = useSceneCanvasHandle({
    ref, elementRef: internalCanvasRef, apiRef: canvasApiRef, onElement: trackHoverOn,
    ingest, viewAnimation, camera, addView,
  });

  // What a view needs to build its own overlay-aware state. `geometry` is the
  // same descriptor handed to `<Canvas>`, so the two cannot diverge.
  const viewInputs = useMemo<SurfaceViewInputs>(() => ({
    adapter: adapter as unknown as { getPose(id: string): unknown },
    geometry: descriptor as PoseDescriptor<unknown>,
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

  useTestHook({
    getScene: () => scene as never,
    getSelectionIds: () => (selection.current as readonly string[] | undefined) ?? [],
    getView: () => viewRef.current,
    getActiveToolId: () => tools.active ?? null,
  });

  return (
    <CanvasKitProviders viewInputs={viewInputs}>
      <Canvas<TPose>
        ref={handleRef}
        adapter={adapter}
        selection={selection}
        poseDescriptor={descriptor}
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
        redrawOn={redrawOn}
        {...restProps}
      />
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
        actions={resolvedActions} tune={tune}
        standardActions={standardActions}
        currentViewRef={viewRef}
        onViewChange={viewState.setViewFromInput}
        resizeOptions={selectToolOpts?.resize as UseResizeOptions<unknown> | undefined}
        poseDescriptor={descriptor as PoseDescriptor<unknown>} boundsIncludeStroke={geometry?.boundsIncludeStroke ?? true}
        geometryProjection={geometryProjection}
        dispatcher={dispatcher}
        pickEvery={internalPickEvery}
        layerIsPainted={viewLayerGate}
        alphaOf={alphaFor ? composedAlphaFor : undefined}
        viewportPanEnabled={enabled.has('view') ? (viewport?.pan ?? true) : false}
        viewportZoom={enabled.has('view') ? resolvedViewportZoom : false}
        viewportPinchZoom={enabled.has('view') ? (viewport?.pinchZoom ?? true) : false}
        viewportRecenter={viewport?.recenter}
        viewAnimation={viewAnimation}
        editAnchorsExternalState={pathEditState}
        layoutDropTarget={layoutDropTarget}
        reflowTransition={reflowTransition as ReflowTransition<unknown> | null | undefined}
        insertNodeFactories={insertNodeFactories}
        insertPaint={insertPaint}
        snap={{ snapPoint: toolOptions?.snapPoint, paths: pathSnapper }}
        canvasRef={internalCanvasRef}
        canvasApiRef={canvasApiRef}
        ingestionResolveSrc={ingestion?.resolveSrc}
        ingestionSvg={ingestion?.svg}
        ingestionClipboard={ingestionClipboard}
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
    </CanvasKitProviders>
  );
}

const SceneCanvasInnerForwardRef = forwardRef(SceneCanvasInner);

// The canvas's input scope sits above `SceneCanvasInner`, whose own hooks
// (`useTools` among them) must already read this canvas's tool and registries.
// Its device profile too, so the canvas and everything under it share one.
/** A scene canvas resolving its `features` through `source`. */
export function renderSceneCanvas<TData, TLayer extends string, TPose>(
  source: PresetSource,
  { device, ...props }: SceneCanvasProps<TData, TLayer, TPose>,
  ref: React.ForwardedRef<SceneCanvasApi>,
) {
  return (
    <InputScope yoke={props.yoke}>
      <DeviceProfileProvider value={device}>
        <ViewRegistryProvider>
          <SceneCanvasInnerForwardRef {...(props as SceneCanvasProps<unknown, string, unknown>)} presetSource={source} ref={ref} />
        </ViewRegistryProvider>
      </DeviceProfileProvider>
    </InputScope>
  );
}

function SceneCanvasWrapper<TData, TLayer extends string, TPose>(
  props: SceneCanvasProps<TData, TLayer, TPose>, ref: React.ForwardedRef<SceneCanvasApi>,
) {
  return renderSceneCanvas(CORE_PRESET_SOURCE, props, ref);
}

// Marked pure so a bundle using only `LeanSceneCanvas` drops it, and core's named presets with it.
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
export const SceneCanvas = /* @__PURE__ */ forwardRef(SceneCanvasWrapper) as <
  TData, TLayer extends string, TPose,
>(
  props: SceneCanvasProps<TData, TLayer, TPose> & { ref?: React.Ref<SceneCanvasApi> },
) => ReturnType<typeof SceneCanvasInner>;

export { DEFAULT_HANDLE_SIZE, mergeLayersWithDefaults, BUILTIN_TOOL_IDS } from './SceneCanvas/props';
export type {
  SceneCanvasProps, SceneCanvasHit, SceneCanvasLayers, SceneCanvasLongPress, BuiltinToolId,
} from './SceneCanvas/props';
export type { CoordTraceEntry } from './SceneCanvas/coordTrace';
