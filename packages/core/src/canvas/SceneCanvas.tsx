/**
 * `<SceneCanvas>` — `<Canvas>` wired to a `Scene` primitive. Bare, it only renders: behavior
 * comes from the `features` presets (`canvas/SceneCanvas/features.ts`), each of which turns on
 * its own actions, tools, ambient bindings, and chrome.
 *
 * A consumer needing custom tools can pass `tools={useTools(...)}` and SceneCanvas forwards it
 * as-is — the internal tool registry is ignored in that case.
 */
import type { PolygonPath } from '@weasel-js/geom';
import { getActiveModeFor } from '@weasel-js/modes';
import { assignRef, useLatest } from '@weasel-js/react';
import type { Action, ActionsProp, ActionsRegistry } from '@weasel-js/routing';
import { createDispatcher, type Dispatcher } from '@weasel-js/routing';
import { InputScope, usePublishSelection } from '@weasel-js/routing/react';
import type { Affordance } from 'affordances/types';
import type { InsertAdapter } from 'core/adapters/types';
import { sceneFromJSON } from 'core/scene/scene';
import type { Node, NodeId, Scene, SerializedScene } from 'core/scene/types';
import { useSelection, type SelectionApi, type UseSelectionOptions } from 'core/selection/useSelection';
import { clientToWorld as clientToWorldHelper } from 'core/viewport/clientToWorld';
import { rectFromPlane } from 'core/viewport/parallax';
import { useCanvasCamera } from './SceneCanvas/useCanvasCamera';
import { normalizeView, viewZoom, type View } from 'core/viewport/view';
import type { RuleCtx } from 'features/chrome-caps';
import {
  DEFAULT_ALLOWED_CAPABILITIES,
  buildChromeCtx,
  never,
  resolveVisibility,
  useHoverTracking,
} from 'features/chrome-caps';
import {
  acquireKitContentHandlers,
  itemsFromFiles,
  registerContentHandler,
  type IngestItem
} from 'features/ingestion';
import { createPathEditingOverlayLayer } from 'features/paths/pathEditingOverlayLayer';
import {
  createSelectionOverlayLayer,
  rotationBadgeOf,
} from 'features/selection/overlay';
import type { ViewportZoomOptions } from 'interactions/actions/defaults/viewportZoom';
import type { ClipboardIngestCtx } from 'interactions/actions/depSchema';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import type { UseResizeOptions } from 'interactions/actions/resize/options';
import { KIT_STANDARD_ACTION_IDS } from 'interactions/actions/useStandardActions';
import type React from 'react';
import { forwardRef, useCallback, useEffect, useInsertionEffect, useMemo, useRef, useState } from 'react';
import {
  selectionMoveContribution,
  selectionResizeContribution,
  selectionRotateContribution,
} from 'tools/builtin/select';
import { DeviceProfileProvider, useDeviceProfile } from '../core/device/useDeviceProfile';
import { createNodeRouting } from '../core/scene/NodeRouting';
import { dwarn } from '../debug';
import { dlog } from '../debug/flag';
import type { DebugConfig } from '../debug/types';
import { createLongPressFeedbackContribution } from '../features/longPress/longPressFeedback';
import type { ReflowTransition } from '../layout/types';
import { installTestHookIfRequested, releaseTestHook } from '../test-hook/install';
import type { Contribution } from '../tools/overlayBinding';
import { useTools, type ToolsApi } from '../tools/overlayBinding';
import type { LayersMap, SceneSlotConfig, SelectionOverlaySlotConfig } from './Canvas';
import { Canvas } from './Canvas';
import { CanvasView, type CanvasViewProps } from './CanvasView';
import { GestureDispatcherMounter } from './SceneCanvas/GestureDispatcherMounter';
import { PointerProviderIfRoot, PointerPublisher } from './SceneCanvas/PointerProviderIfRoot';
import { StandardActionsRegistrar } from './SceneCanvas/StandardActionsRegistrar';
import { ToolKeybindingsMounter } from './SceneCanvas/ToolKeybindingsMounter';
import { inferredNodeRouting } from './SceneCanvas/defaultNodeRouting';
import { createDispatcherPreviewSources, createGestureSource } from './SceneCanvas/dispatcherGestureBounds';
import {
  featureActionIds,
  resolveFeatures
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
import type { PickView } from './SceneCanvas/useSceneSelectTool';
import { useSceneSelectTool } from './SceneCanvas/useSceneSelectTool';
import type { CanvasExtensionApi, CanvasViewHandle, SceneCanvasApi } from './canvasExtension';
import { resolveEditablePathOf } from './deps/editAnchors';
import type { GesturePreviewSource } from './gestureBounds';
import { makeGetNodeAtPoint } from './getNodeAtPoint';
import { pathFromPlane } from './planeClips';
import { useSceneAdapter } from './sceneAdapter';
import { createSceneLayerGate, type ViewLayerPaint } from './sceneLayerPaint';
import { composeAlphaFor, wireSceneSlotToScene } from './sceneSlotWiring';
import { createSlopsDebugLayer } from './slopsDebugLayer';
import { useHitObserver } from './useHitObserver';
import { useLateContentRedraw } from './useLateContentRedraw';
import { ViewInputsProvider, type SurfaceViewInputs, type ViewRuleInputs } from './viewInputs';
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

/** Stable empty `Set`: selection-overlay's `draw` reads `getSuppressedSelectionIds` every
 *  frame. */
const EMPTY_ID_SET: ReadonlySet<string> = new Set();
const EMPTY_ANCHOR_SELECTION: ReadonlySet<number> = new Set();

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
    actionDefaults: _actionDefaults,
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
    device,
    ...rest
  } = props;

  const descriptor = (poseDescriptor ?? AUTO_POSE_DESCRIPTOR) as PoseDescriptor<unknown>;

  const deviceProfile = useDeviceProfile(device);

  // `scene` accepts either a live `Scene` or a `SerializedScene` JSON object. JSON is baked
  // once; later prop changes are ignored (use a `key` on `<SceneCanvas>` to force a fresh canvas).
  const isSerialized = (s: unknown): boolean =>
    typeof s === 'object' && s != null && (s as { version?: unknown }).version === 1
      && Array.isArray((s as { nodes?: unknown }).nodes);
  const [bakedScene] = useState<Scene<TData, TLayer, TPose> | null>(
    () => isSerialized(sceneInput)
      ? sceneFromJSON(sceneInput as SerializedScene<TData, TLayer, TPose>, {})
      : null,
  );
  const scene = bakedScene ?? (sceneInput as Scene<TData, TLayer, TPose>);

  // Extract view-related props from rest so we can intercept them for the
  // controlled/uncontrolled pattern Canvas exposes without breaking it.
  const { view: viewProp, onViewChange: onViewChangeProp, defaultView, redrawOn: redrawOnProp, ...restProps } = rest;
  const getActiveMode = useMemo(() => (modes ? getActiveModeFor(modes) : undefined), [modes]);
  const redrawOn = useMemo(
    () => (modes ? [...(redrawOnProp ?? []), modes] : redrawOnProp),
    [modes, redrawOnProp],
  );

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

  // The kit's default content handlers are refcounted across mounted SceneCanvases; consumer
  // handlers from the `ingestion` prop live for this canvas's lifetime.
  const consumerHandlers = ingestion?.handlers;
  useEffect(() => {
    const disposers = [acquireKitContentHandlers()];
    for (const h of consumerHandlers ?? []) disposers.push(registerContentHandler(h));
    return () => disposers.forEach((d) => d());
  }, [consumerHandlers]);

  // Redraw on every active animator frame so `drawOne` functions reading
  // `animator.colorOverrides` (or any other non-scene channel) reflect the latest values.
  // The animator only ticks while animations are active.
  useEffect(() => {
    if (!animator) return;
    const unsubscribe = animator.onTick(() => {
      canvasApiRef.current?.requestRedraw?.();
    });
    return unsubscribe;
  }, [animator]);

  // Late decodes, deferred glyph bakes and late paint kinds each drew nothing
  // on the frame that asked for them.
  useLateContentRedraw(useCallback(() => { canvasApiRef.current?.requestRedraw?.(); }, []));

  // Override writes deliberately don't bump the scene version — that fanout is
  // what a frame loop is trying to avoid — so the repaint has to come from
  // here instead.
  useEffect(() => scene.overrides.subscribe(() => {
    canvasApiRef.current?.requestRedraw?.();
  }), [scene]);

  // A scene write repaints; it does not re-render this component. The layers read the scene
  // at paint time and `contentVersion` is a getter. Chrome rendering node data as DOM
  // subscribes for itself, which is what lets a host driving poses from a frame loop take
  // `useScene(…, { subscribe: false })`.
  useEffect(() => scene.subscribe(() => {
    canvasApiRef.current?.requestRedraw?.();
  }), [scene]);

  // The mirror every HUD, pick and pinch path reads synchronously. Seeded here
  // because those reads start before the canvas's subscription lands.
  const currentViewRef = useRef<View>(
    normalizeView(viewProp ?? defaultView ?? { x: 0, y: 0, scale: { x: 1, y: 1 } }),
  );
  // Committed renders only, so an abandoned transition's view never reaches
  // the `view` dep, picks or the camera animator.
  useInsertionEffect(() => {
    if (viewProp !== undefined) currentViewRef.current = normalizeView(viewProp);
  });

  useEffect(() => {
    const api = canvasApiRef.current;
    if (!api) return;
    currentViewRef.current = api.getView();
    return api.subscribeView((v) => { currentViewRef.current = v; });
  }, [canvasReady]);

  // The dep registry's `view.set`. Uncontrolled it must not also call
  // `onViewChangeProp` — the canvas reports the write through `notifyViewChange`.
  const handleViewChange = useCallback((v: View) => {
    const api = canvasApiRef.current;
    if (viewProp === undefined && api) { api.setView(v); return; }
    onViewChangeProp?.(normalizeView(v));
  }, [viewProp, onViewChangeProp]);

  const viewChannel = useMemo(
    () => ({ get: () => currentViewRef.current, set: handleViewChange }),
    [handleViewChange],
  );
  const { viewAnimation, camera } = useCanvasCamera(viewChannel);

  // Never writes back to the canvas — `handleViewChange` would recurse. Every
  // `Canvas.setView` lands here on both branches, so it is also the runner's
  // one interrupt feed.
  const notifyViewChange = useCallback((v: View) => {
    viewAnimation.stopIfExternal();
    onViewChangeProp?.(v);
  }, [onViewChangeProp, viewAnimation]);

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
  const baseAdapterMethods = baseSelection.adapterMethods;
  const readOnlyAdapterMethods = useMemo(() => ({
    getSelection: () => baseAdapterMethods.getSelection(),
    setSelection: () => {},
  }), [baseAdapterMethods]);
  const selection: SelectionApi = useMemo(() => {
    if (selectable) return baseSelection;
    const noopSet = () => {};
    return {
      get current() { return baseSelection.current; },
      get: baseSelection.get,
      contains: baseSelection.contains,
      set: noopSet,
      add: noopSet,
      remove: noopSet,
      toggle: noopSet,
      clear: noopSet,
      applyClick: noopSet,
      adapterMethods: readOnlyAdapterMethods,
    };
  }, [baseSelection, selectable, readOnlyAdapterMethods]);

  // Publish the current selection (with optional per-id kind labels) into any surrounding
  // `<SelectionContextProvider>`. No-op when no provider is in scope.
  const currentSelection = selection.current;
  const selectionKinds = useMemo<readonly (string | undefined)[] | undefined>(() => {
    if (currentSelection.length === 0) return undefined;
    const out: (string | undefined)[] = [];
    for (const id of currentSelection) {
      const node = scene.get(id);
      if (!node) { out.push(undefined); continue; }
      if (describeKind) { out.push(describeKind(node)); continue; }
      // Default heuristic: containers -> 'group', poses with .kind -> 'path',
      // everything else unlabelled (consumer can supply describeKind to fill in).
      if (node.kind === 'container') { out.push('group'); continue; }
      const pose = node.pose as unknown as { kind?: unknown } | null;
      if (pose && typeof pose === 'object' && 'kind' in pose && typeof pose.kind === 'string') {
        out.push('path');
        continue;
      }
      out.push(undefined);
    }
    return out;
  }, [currentSelection, scene, describeKind]);
  usePublishSelection(currentSelection, selectionKinds);

  // Path-editing edit-mode state. Stays empty until `enterPathEditAction` sets it, and clears
  // on `exitPathEditAction`; the chrome and `editAnchorsAction` both gate on `editingId !== ''`.
  const [pathEditingId, setPathEditingId] = useState<string>('');
  const pathEditingIdRef = useLatest(pathEditingId);
  const pathEditRef = useLatest(pathEdit);
  // `anchorEditingAllowed` is declared below (it needs `getActiveModeRef`);
  // hold it in a ref so `effectivePathEditingId` — used by consumers
  // declared both above and below that point — can read it lazily.
  const anchorEditingAllowedRef = useRef<(() => boolean) | undefined>(undefined);
  /**
   * The edit target, masked by whether the host still permits anchor editing. Every surface
   * that cares reads this rather than the raw state, so leaving path-edit mode tears all of
   * them down at once, by any route — a host's own mode machine can leave the mode without
   * running `exitPathEditAction`.
   *
   * Masking rather than clearing on purpose: the mode can change without re-rendering this
   * component, so there is no reliable moment to write state.
   */
  const effectivePathEditingId = useCallback((): string => {
    if (pathEditRef.current) return pathEditRef.current.editingId() ?? '';
    const allowed = anchorEditingAllowedRef.current;
    if (allowed && !allowed()) return '';
    return pathEditingIdRef.current;
  }, [pathEditingIdRef, pathEditRef]);
  // Anchor selection + in-flight marquee are per-frame inputs to the overlay's draw(), never
  // to a React render, so they live in refs and request a repaint directly.
  const selectedAnchorsRef = useRef<ReadonlySet<number>>(EMPTY_ANCHOR_SELECTION);
  const anchorMarqueeRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const editAnchorsExternalState = useMemo(() => ({
    getEditingId: () => effectivePathEditingId(),
    setEditingId: (id: string | null) => (pathEditRef.current ? pathEditRef.current.setEditingId(id) : setPathEditingId(id ?? '')),
    getSelectedAnchors: () => selectedAnchorsRef.current,
    setSelectedAnchors: (next: ReadonlySet<number>) => {
      selectedAnchorsRef.current = next;
      canvasApiRef.current?.requestRedraw?.();
    },
    getMarquee: () => anchorMarqueeRef.current,
    setMarquee: (rect: { x: number; y: number; width: number; height: number } | null) => {
      anchorMarqueeRef.current = rect;
      canvasApiRef.current?.requestRedraw?.();
    },
  }), [effectivePathEditingId, pathEditRef]);

  const selectToolWithDefaults = useMemo(() => ({
    // Shift-click belongs to the anchor selection while a path is being
    // anchor-edited; see `UseSelectToolOptions.extendClickLocked`.
    extendClickLocked: () => effectivePathEditingId() !== '',
    ...selectToolOpts,
  }), [selectToolOpts, effectivePathEditingId]);

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
    getView: () => currentViewRef.current,
    // Only when the consumer actually fades something. Without a prop the
    // composed function is just the override lookup, and the source resolves
    // that once per walk instead of once per candidate.
    ...(alphaFor ? { alphaOf: composedAlphaFor } : {}),
    ...(viewLayerGate ? { layerIsPainted: viewLayerGate } : {}),
    selectTool: selectToolWithDefaults,
  });
  // Read through a ref by the chrome layers, which are built once.
  const planeOfNodeRef = useLatest(internalPlaneOfNode);

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
  const getActiveModeRef = useLatest(getActiveMode);

  // The selection's own ambient bindings: `move`, `resize` and `rotate`. They
  // are not tools and sit outside `tools`, so they apply under a takeover too.
  const selectionMoveOptions = useMemo(
    () => ({ move: internalMoveOptions }),
    [internalMoveOptions],
  );
  const rotateOptions = selectToolOpts?.rotate || undefined;
  // Handles first: a handle sits over the selected body, so the move binding
  // matches a handle drag too, and a tie goes to whichever is first.
  const featureContributions = useMemo<Contribution[]>(() => [
    ...(enabled.has('resize') ? [selectionResizeContribution()] : []),
    ...(enabled.has('rotate') ? [selectionRotateContribution({ rotate: rotateOptions })] : []),
    ...(enabled.has('move') ? [selectionMoveContribution(selectionMoveOptions)] : []),
  ], [enabled, selectionMoveOptions, rotateOptions]);

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
  const gestureSource = useMemo(() => createGestureSource(() => dispatcherRef.current), []);

  // The dispatcher's half of this view's overlay-aware lookups: whose
  // committed paint a ghost hides, and the pose a handle proposes for an id.
  const { previewIdsExtra, previewPoseExtra } = useMemo(
    () => createDispatcherPreviewSources(() => dispatcherRef.current),
    [],
  );

  const sceneSlot = useMemo(() => {
    const slot = mergedLayers.scene;
    if (!slot || 'layer' in slot) return slot; // null or CustomLayerEntry — leave alone
    return wireSceneSlotToScene(
      slot as SceneSlotConfig<Node<TData, TLayer, TPose>, TPose>,
      scene,
      alphaFor,
      animator?.colorOverrides,
    );
  }, [mergedLayers.scene, alphaFor, scene, animator]);

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

  // Chrome-caps hover tracking: the last-hovered NodeId fed into `ChromeCtx.hover`, cached
  // on a ref with no re-renders.
  const { getHover, canvasRef: trackHoverOn } = useHoverTracking({
    // One lookup, not a client→world thunk beside a picker: the point and the
    // camera its tolerance converts against have to come from the same view.
    // Hover has no pointer to capture, so it resolves fresh — whichever view
    // is under the cursor right now owns the point.
    nodeAtClientPoint: (clientX, clientY) => {
      const canvas = internalCanvasRef.current;
      if (!canvas) return null;
      const target = surfaceViewRegistry?.resolver.at(null, clientX, clientY);
      const origin = target?.origin ?? canvas.getBoundingClientRect();
      const view = target?.view ?? currentViewRef.current;
      const [x, y] = clientToWorldHelper(clientX, clientY, origin, view);
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

  // Live sources for `buildChromeCtx`; the resolver below is called per draw / per hitTest
  // from Canvas.
  const selectionForCapsRef = useLatest(selection.current as readonly NodeId[]);
  const getFocusedPropRef = useLatest(getFocusedProp);
  // Selection chrome belongs to the presets that turn it on: the outline to
  // `outline`, each handle to the preset that binds it. `never` also takes a handle out of
  // hit-testing, so a hidden handle cannot be grabbed.
  //
  // `selectable={false}` suppresses the marquee / lasso chrome by default:
  // every selection write no-ops then, so the select tool's
  // empty-drag binding still CLAIMS the gesture (keeping it from falling
  // through to other ambient drag actions like insert) but paints nothing.
  // An explicit consumer rule for either id still wins.
  const effectiveChromeVisibility = useMemo(() => {
    // Kit defaults first; consumer `chromeVisibility` spread last so it wins.
    const defaults: import('features/chrome-caps').VisibilityRules = {};
    if (!enabled.has('outline')) defaults['selection.outline'] = never;
    if (!enabled.has('resize')) defaults['selection.resize-handles'] = never;
    if (!enabled.has('rotate')) defaults['selection.rotation-handle'] = never;
    if (!selectable) {
      defaults['action.marquee'] = never;
      defaults['action.lasso'] = never;
    }
    // `selectTool.rotate === false` hides the rotation handle (`resolvedActions`
    // drops its action) so a non-rotatable consumer fully opts out.
    if (selectToolOpts?.rotate === false) defaults['selection.rotation-handle'] = never;
    if (Object.keys(defaults).length === 0) return chromeVisibility;
    return { ...defaults, ...chromeVisibility };
  }, [chromeVisibility, selectable, selectToolOpts?.rotate, enabled]);
  const chromeVisibilityRef = useLatest(effectiveChromeVisibility);
  // Read through a ref for the same reason as the others here:
  // `buildCurrentRuleCtx` is a stable `useCallback`, and adding the profile to
  // its deps would rebuild it whenever a media query changes.
  const deviceProfileRef = useLatest(deviceProfile);
  // Per-node resizability predicate from `selectTool.resize.resizable`, folded
  // over the live selection into the `selectionResizable` rule-ctx flag below.
  const resizablePredRef = useLatest(selectToolOpts?.resize?.resizable);

  /** Build the live RuleCtx — selection + view + modifiers + mode + capabilities
   *  + active action. Consumed by chrome-caps' resolver and the dispatcher's
   *  eligibility filter so both see the same view of the world. */
  const buildRuleCtxFor = useCallback((inputs: ViewRuleInputs) => {
    const sel = inputs.selection;
    // No mode registry wired → behave as normal mode, capabilities included.
    // An empty set here would make every `capability:` rule false and hide
    // the chrome those rules gate. See DEFAULT_ALLOWED_CAPABILITIES.
    const modeInfo = getActiveModeRef.current?.()
      ?? { id: 'normal', allowedCapabilities: DEFAULT_ALLOWED_CAPABILITIES };
    const ctx = buildChromeCtx({
      focused: getFocusedPropRef.current ? getFocusedPropRef.current() : true,
      selection: sel,
      multiActive: sel.length > 1,
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      action: inputs.action,
      hover: getHover(),
      view: inputs.view,
    });
    // `mode` and `allowedCapabilities` are attached below so the mode-gated default rules
    // can read them. `selectionResizable` is true only when every selected node is resizable
    // (per `selectTool.resize.resizable`), and undefined when no predicate is supplied, which
    // the `resizable:` selector treats as resizable.
    const resizablePred = resizablePredRef.current;
    const selectionResizable = resizablePred
      ? sel.every((id) => resizablePred(id as string))
      : undefined;
    return {
      ...ctx,
      zoom: viewZoom(inputs.view),
      mode: modeInfo.id,
      allowedCapabilities: modeInfo.allowedCapabilities,
      selectionResizable,
      editingAnchors: effectivePathEditingId() !== '',
      device: deviceProfileRef.current,
    };
  }, [getHover, effectivePathEditingId, getActiveModeRef, getFocusedPropRef, resizablePredRef, deviceProfileRef]);

  /** The surface's own view zero. */
  const currentRuleInputs = useCallback((): ViewRuleInputs => ({
    selection: selectionForCapsRef.current,
    view: currentViewRef.current,
    action: dispatcher.getActiveAction(),
  }), [dispatcher, selectionForCapsRef]);
  const buildCurrentRuleCtx = useCallback(
    () => buildRuleCtxFor(currentRuleInputs()),
    [buildRuleCtxFor, currentRuleInputs],
  );

  // Anchor editing survives only as long as the active mode permits it.
  // Deliberately undefined when no mode registry is wired: "no modality"
  // means nothing revokes edit mode, whereas a predicate built from the
  // fallback capability set would revoke it immediately (the default set
  // is NORMAL's, which doesn't include `edits-anchors`).
  const anchorEditingAllowed = useMemo(
    () =>
      getActiveMode
        ? () => getActiveModeRef.current!().allowedCapabilities.has('edits-anchors')
        : undefined,
    [getActiveMode, getActiveModeRef],
  );
  useInsertionEffect(() => {
    anchorEditingAllowedRef.current = anchorEditingAllowed;
  });

  /** The chrome-caps answers for one view: the surface's rule table evaluated
   *  against that view's selection, camera and in-flight action. */
  const chromeCaps = useMemo(() => ({
    ruleCtx: (inputs: ViewRuleInputs) =>
      (getActiveModeRef.current ? buildRuleCtxFor(inputs) as RuleCtx : undefined),
    isVisible: (inputs: ViewRuleInputs) => resolveVisibility(
      chromeVisibilityRef.current,
      buildRuleCtxFor(inputs) as Parameters<typeof resolveVisibility>[1],
    ),
  }), [buildRuleCtxFor, getActiveModeRef, chromeVisibilityRef]);

  const getIsVisibleForCanvas = useCallback(
    (): ((id: string) => boolean) => chromeCaps.isVisible(currentRuleInputs()),
    [chromeCaps, currentRuleInputs],
  );

  // The chrome layer reads `editingId` via a ref, so an edit-mode change needs an explicit
  // redraw.
  useEffect(() => {
    canvasApiRef.current?.requestRedraw?.();
  }, [pathEditingId]);

  const sceneRef = useLatest(scene);
  const slopsOn = debug !== undefined && debug !== false && debug.slops === true;
  const selectionOverlayCfg = mergedLayers.selectionOverlay as
    | SelectionOverlaySlotConfig<TPose> | null | undefined;
  const badgeOf = selectionOverlayCfg ? rotationBadgeOf(selectionOverlayCfg) : null;
  // Kept by value so the layers and hit-testers keyed on it don't rebuild
  // every render.
  const rotationBadge = useMemo(
    () => badgeOf,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [badgeOf?.distancePx, badgeOf?.sizePx],
  );
  // Debug: slops viz layer (off by default). Draws the affordances the
  // gesture mounter hit-tests, which it publishes here, so the halos are the
  // hit regions rather than a copy of them.
  const chromeAffordancesRef = useRef<readonly Affordance[]>([]);
  const slopsLayer = useMemo(
    () => createSlopsDebugLayer({ getAffordances: () => chromeAffordancesRef.current }),
    [],
  );

  // The live (preview-aware) world polygon for `id`: whichever in-flight handle previews
  // state for the id contributes its previewPose / previewData, so chrome and slops viz
  // follow any in-flight gesture.
  const livePathFor = (
    id: string,
    previews: readonly GesturePreviewSource[],
    view: View,
  ): PolygonPath | null => {
    const node = sceneRef.current?.get(id as never);
    if (!node) return null;
    let pose = node.pose as unknown;
    let data = node.data as unknown;
    let touched = false;
    for (const source of previews) {
      const previewIds = source.previewIds?.();
      if (!previewIds) continue;
      let owns = false;
      for (const pid of previewIds) {
        if (pid === id) { owns = true; break; }
      }
      if (!owns) continue;
      const p = source.previewPose?.(id);
      if (p != null && !touched) { pose = p; touched = true; }
      const d = source.previewData?.(id);
      if (d != null) { data = d; touched = true; }
    }
    // In the drawing camera's world: a path on a parallax plane is stored in
    // the plane's.
    return pathFromPlane(
      resolveEditablePathOf({ pose, data } as { pose: unknown; data: unknown }),
      planeOfNodeRef.current(id, view),
    );
  };

  const pathEditingOverlayLayer = useMemo(
    () => createPathEditingOverlayLayer({
      getEditingId: () => effectivePathEditingId() || null,
      getPose: (id, previews, view) => livePathFor(id, previews, view) as never,
      getSelectedAnchors: () => selectedAnchorsRef.current,
      // Drawn by an action that ran in the edited path's plane.
      getMarquee: (view) => {
        const rect = anchorMarqueeRef.current;
        const plane = rect ? planeOfNodeRef.current(effectivePathEditingId(), view) : null;
        return rect && plane ? rectFromPlane(plane, rect) : rect;
      },
    }),
    // Stable identity — closure reads live state through refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Suppress the standard selection overlay (outline + corner/rotate
  // handles) on the node currently in path-edit mode — the per-anchor
  // chrome takes over.
  const getSuppressedSelectionIds = useCallback((): ReadonlySet<string> => {
    const id = effectivePathEditingId();
    return id ? new Set([id]) : EMPTY_ID_SET;
  }, [effectivePathEditingId]);

  const selectionOverlayLayer = useMemo(() => {
    const selCfg = mergedLayers.selectionOverlay as
      | SelectionOverlaySlotConfig<TPose>
      | null
      | undefined;
    if (selCfg === null) return null;
    const cfg = (selCfg ?? {}) as SelectionOverlaySlotConfig<TPose>;

    const callerSuppress = cfg.getSuppressedIds;
    const getSuppressedIds = (): ReadonlySet<string> => {
      const own = getSuppressedSelectionIds();
      const caller = callerSuppress?.();
      if (!caller || caller.size === 0) return own;
      if (own.size === 0) return caller;
      const merged = new Set<string>(caller);
      for (const id of own) merged.add(id);
      return merged;
    };

    return createSelectionOverlayLayer<TPose>({
      ...cfg,
      getSuppressedIds,
      ...(cfg.poseById
        ? {
            getPose: cfg.poseById,
            poseDescriptor: cfg.poseDescriptor ?? (descriptor as PoseDescriptor<TPose>),
          }
        : {}),
    });
  }, [mergedLayers.selectionOverlay, getSuppressedSelectionIds, descriptor]);

  const wiredLayers = useMemo<LayersMap<Node<TData, TLayer, TPose>, TPose>>(() => ({
    ...mergedLayers,
    ...(sceneSlot ? { scene: sceneSlot } : {}),
    // Pass the pre-built selection overlay layer so Canvas receives a
    // CustomLayerEntry and skips its own factory construction for this slot.
    selectionOverlay: selectionOverlayLayer
      ? { layer: selectionOverlayLayer }
      : mergedLayers.selectionOverlay === null ? null : undefined,
    previewGhost: { layer: previewLayer, after: 'scene' },
    dispatcherOverlay: { layer: dispatcherOverlay, after: 'previewGhost' },
    pathEditingOverlay: { layer: pathEditingOverlayLayer, after: 'selectionOverlay' },
    ...(slopsOn ? { slopsDebug: { layer: slopsLayer, after: 'pathEditingOverlay' } } : {}),
  }), [mergedLayers, sceneSlot, selectionOverlayLayer, previewLayer, dispatcherOverlay, pathEditingOverlayLayer, slopsOn, slopsLayer]);

  // `CanvasExtensionApi.ingest` is routed through `registry.trigger('ingest', …)` so the
  // action's `requires` deps are resolved exactly as on the dispatcher path.
  // `StandardActionsRegistrar` stashes the registry into this ref.
  const actionsRegistryRef = useRef<ActionsRegistry | null>(null);

  // Clipboard-paste ctx for the kit weasel-JSON content handler, built from THIS canvas's
  // adapter so OS-arriving pastes re-materialize through the same `commitPaste` path
  // `useClipboardOps` uses. Absent (⇒ the handler declines) when the consumer set
  // `ingestion.clipboard.enabled: false` or the adapter lacks `commitPaste`.
  const ingestionClipboardReviver = ingestion?.clipboard?.reviver;
  const ingestionClipboardEnabled = ingestion?.clipboard?.enabled !== false;
  const ingestionClipboardOmitted = useLatest(ingestion?.clipboard?.onOmitted);
  const ingestionClipboard = useMemo<ClipboardIngestCtx | undefined>(() => {
    if (!ingestionClipboardEnabled || !adapter?.commitPaste) return undefined;
    return {
      adapter: adapter as unknown as InsertAdapter<{ id: string }>,
      ...(ingestionClipboardReviver ? { reviver: ingestionClipboardReviver } : {}),
      onOmitted: (omitted) => ingestionClipboardOmitted.current?.(omitted),
    };
  }, [adapter, ingestionClipboardEnabled, ingestionClipboardReviver, ingestionClipboardOmitted]);
  const ingestImpl = useCallback(
    (input: File[] | IngestItem[], point?: { x: number; y: number }) => {
      const items: IngestItem[] = (input as (File | IngestItem)[]).map((entry) =>
        entry instanceof File ? itemsFromFiles([entry])[0] : entry,
      );
      if (items.length === 0) return false;
      if (!actionsRegistryRef.current) {
        // The registry is stashed by a descendant effect — a consumer calling
        // ingest() from its own ref callback / layout effect lands here.
        dwarn('ingest', 'CanvasExtensionApi.ingest called before the action registry mounted — call ignored. Defer to an effect or event handler.');
        return false;
      }
      const params = { items, ...(point ? { worldX: point.x, worldY: point.y } : {}) };
      const ran = actionsRegistryRef.current.trigger('ingest', params);
      if (!ran) dwarn('ingest', 'CanvasExtensionApi.ingest ran nothing: this canvas has no `ingest` action. Add `ingest` to `features`.');
      return ran;
    },
    [],
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
            ingest: ingestImpl,
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
    [ref, ingestImpl, viewAnimation, camera, addView, trackHoverOn],
  );

  // What a view needs to build its own overlay-aware state. `geometry` is the
  // same descriptor handed to `<Canvas>`, so the two cannot diverge.
  const viewInputs = useMemo<SurfaceViewInputs>(() => ({
    adapter: adapter as unknown as { getPose(id: string): unknown },
    geometry: descriptor,
    boundsOf: internalBoundsOf,
    boundsOfPose: internalBoundsOfPose as SurfaceViewInputs['boundsOfPose'],
    planeOfNode: internalPlaneOfNode,
    tools,
    pickEvery: internalPickEvery,
    pickBest: internalPickBest,
    kindOfNode,
    chromeCaps,
    selectionApi: selection,
    rotationBadge,
  }), [adapter, descriptor, internalBoundsOf, internalBoundsOfPose, internalPlaneOfNode, tools,
       internalPickEvery, internalPickBest, kindOfNode, chromeCaps, selection, rotationBadge]);

  const canvas = (
    <Canvas<Node<TData, TLayer, TPose>, TPose>
      ref={mergedRef}
      adapter={adapter}
      selection={selection}
      poseDescriptor={descriptor as PoseDescriptor<TPose>}
      tools={tools}
      layers={wiredLayers}
      pickEvery={internalPickEvery}
      // The chrome's bounds are the picker's: a node on a parallax plane is
      // boxed where the plane draws it, and a `geometry.boundsOf` reaches both.
      boundsOf={internalBoundsOf}
      boundsOfPose={internalBoundsOfPose}
      getIsVisible={getIsVisibleForCanvas}
      previewIdsExtra={previewIdsExtra}
      // The gesture surface behind `helpersRef.getGestureBounds()` /
      // `subscribeGestures()` — Canvas has no dispatcher of its own.
      gestureSource={gestureSource}
      previewPoseExtra={previewPoseExtra}
      {...(debug !== undefined ? { debug: canvasDebug(debug) } : {})}
      pickBest={internalPickBest}
      contentVersion={scene.getVersion}
      layerVisibility={layerVisibility}
      layerOrder={layerOrder}
      {...(viewProp !== undefined ? { view: viewProp } : { defaultView })}
      onViewChange={notifyViewChange}
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
        getView: () => currentViewRef.current,
        getActiveToolId: () => liveToolsRef.current?.active ?? null,
      });
      if (hook) {
        hook._markReady();
        return () => releaseTestHook(hook);
      }
    }
    return undefined;
  }, [sceneRef, selectionRef, liveToolsRef]);

  return (
    <DeviceProfileProvider value={device}>
      <ViewInputsProvider value={viewInputs}>
        <PointerProviderIfRoot>
          <>
            {canvas}
            <PointerPublisher canvasRef={internalCanvasRef} />
            <StandardActionsRegistrar
              selection={selection}
              scene={scene}
              adapter={adapter as unknown as BridgeAdapter}
              actions={resolvedActions}
              excludeActions={standardActionsExclude}
              currentViewRef={currentViewRef}
              onViewChange={handleViewChange}
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
              editAnchorsExternalState={editAnchorsExternalState}
              anchorEditingAllowed={anchorEditingAllowed}
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
              viewRef={currentViewRef}
              dispatcher={dispatcher}
              getIsVisibleForCanvas={getIsVisibleForCanvas}
              getRuleCtx={getActiveMode ? buildCurrentRuleCtx : undefined}
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
          </>
        </PointerProviderIfRoot>
      </ViewInputsProvider>
    </DeviceProfileProvider>
  );
}

const SceneCanvasInnerForwardRef = forwardRef(SceneCanvasInner);

// The canvas's input scope sits above `SceneCanvasInner`, whose own hooks
// (`useTools` among them) must already read this canvas's tool and registries.
function SceneCanvasWrapper<TData, TLayer extends string, TPose>(
  props: SceneCanvasProps<TData, TLayer, TPose>,
  ref: React.ForwardedRef<SceneCanvasApi>,
) {
  return (
    <InputScope yoke={props.yoke}>
      <ViewRegistryProvider>
        <SceneCanvasInnerForwardRef {...(props as SceneCanvasProps<unknown, string, unknown>)} ref={ref} />
      </ViewRegistryProvider>
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
