/**
 * `<SceneCanvas>` — `<Canvas>` wired to a `Scene` primitive.
 *
 * Synthesizes a `MoveAdapter & ResizeAdapter & RotateAdapter & AreaSelectAdapter`
 * from the passed `scene` (via `sceneToAdapter`) and an internal `useTools`.
 * Bare, it only renders: behavior comes from the `features` presets
 * (`canvas/SceneCanvas/features.ts`), each of which registers its own actions,
 * tools, ambient bindings and chrome.
 *
 * If a consumer needs custom tools (e.g. `select` + `insert`), they can pass
 * `tools={useTools(...)}` directly and SceneCanvas forwards it as-is — the
 * internal tool registry is ignored in that case.
 *
 * Cascade: `Scene` stores absolute poses, so dragging a container has to
 * translate its descendants in the live overlay and again at commit. The move
 * action walks `scene.childrenOf` for both — see `cascadeIds` in
 * `interactions/actions/move/action.ts`.
 */
import type { PolygonPath } from '@weasel-js/geom';
import { capabilitiesAllowed, getActiveModeFor } from '@weasel-js/modes';
import { assignRef, useLatest } from '@weasel-js/react';
import type { Action, ActionsProp, ActionsRegistry } from '@weasel-js/routing';
import { createDispatcher, type Dispatcher } from '@weasel-js/routing';
import { InputScope, usePublishSelection } from '@weasel-js/routing/react';
import type { Affordance } from 'affordances/types';
import type { InsertAdapter } from 'core/adapters/types';
import { sceneFromJSON } from 'core/scene/scene';
import type { Node, NodeId, Scene, SerializedScene } from 'core/scene/types';
import { useSelection, type SelectionApi, type UseSelectionOptions } from 'core/selection/useSelection';
import { KIT_SHAPE_KINDS } from 'core/shapeKinds';
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
import { createPenPreviewLayer } from 'features/paths/penPreviewLayer';
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
import { useHandTool } from 'tools/builtin/hand';
import type { PenScratch } from 'tools/builtin/pen';
import {
  selectionMoveContribution,
  selectionResizeContribution,
  selectionRotateContribution,
} from 'tools/builtin/select';
import { targetSizesPx } from '../core/device/targets';
import { DeviceProfileProvider, useDeviceProfile } from '../core/device/useDeviceProfile';
import { createNodeRouting } from '../core/scene/NodeRouting';
import { dwarn } from '../debug';
import { dlog } from '../debug/flag';
import type { DebugConfig } from '../debug/types';
import { createLongPressFeedbackContribution } from '../features/longPress/longPressFeedback';
import type { ReflowTransition } from '../layout/types';
import { installTestHookIfRequested, releaseTestHook } from '../test-hook/install';
import type { AnyTool, Contribution, Tool } from '../tools/overlayBinding';
import { useTools, type ToolsApi } from '../tools/overlayBinding';
import type { LayersMap, SceneSlotConfig, SelectionOverlaySlotConfig } from './Canvas';
import { Canvas } from './Canvas';
import { CanvasView, type CanvasViewProps } from './CanvasView';
import { GestureDispatcherMounter } from './SceneCanvas/GestureDispatcherMounter';
import { PointerProviderIfRoot, PointerPublisher } from './SceneCanvas/PointerProviderIfRoot';
import { StandardActionsRegistrar } from './SceneCanvas/StandardActionsRegistrar';
import { ToolKeybindingsMounter } from './SceneCanvas/ToolKeybindingsMounter';
import { COORD_DEV, coordTrace, type CoordTraceEntry } from './SceneCanvas/coordTrace';
import { inferredNodeRouting } from './SceneCanvas/defaultNodeRouting';
import { createDispatcherPreviewSources, createGestureSource } from './SceneCanvas/dispatcherGestureBounds';
import {
  featureActionIds,
  resolveFeatures
} from './SceneCanvas/features';
import { IS_DEV } from './SceneCanvas/isDev';
import {
  NON_SHAPE_BUILTIN_TOOLS,
  mergeLayersWithDefaults,
  type BridgeAdapter,
  type BuiltinToolId,
  type SceneCanvasProps,
} from './SceneCanvas/props';
import { useBuiltinShapeTools } from './SceneCanvas/useBuiltinShapeTools';
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
// ---------------------------------------------------------------------------
// Dev-only coord trace
// ---------------------------------------------------------------------------
if (COORD_DEV && typeof window !== 'undefined') {
  (window as unknown as { __weaselCoordLog__: CoordTraceEntry[] }).__weaselCoordLog__ = coordTrace;
}

/** `<SceneCanvas debug>` minus the flag only SceneCanvas reads. */
function canvasDebug(debug: (DebugConfig & { slops?: boolean }) | false): DebugConfig | false {
  if (debug === false) return false;
  const { slops: _slops, ...rest } = debug;
  return rest;
}

/** Discriminate the polymorphic `tools` prop: `ToolsApi` has `setActive`
 *  / `active` / `registry`; the patch record shape has none of those. */
/** Stable empty `Set` so `getSuppressedSelectionIds` doesn't allocate
 *  a fresh empty Set on every read — selection-overlay's `draw` runs
 *  every frame. */
const EMPTY_ID_SET: ReadonlySet<string> = new Set();
const EMPTY_ANCHOR_SELECTION: ReadonlySet<number> = new Set();

function isToolsApi(
  tools: ToolsApi | Record<string, AnyTool | true | false>,
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
    insertTool,
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
    actionDefaults,
    describeKind,
    animator,
    views: viewDescriptors,
    children,
    shaders,
    flattenTolerance,
    backgroundFill,
    cursorCoordsHud,
    pickHud,
    debug,
    modalityHud,
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

  // Resolved once here and provided to the subtree, so overlays, affordances
  // and consumer chrome all read the same object rather than each running
  // their own media queries.
  const deviceProfile = useDeviceProfile(device);

  // How big grabbable chrome is for this pointer type. Paint (the selection
  // overlay), hit-test (`buildAffordanceAt`) and the slops debug overlay all
  // resolve from this one object — a size read from the base constants
  // directly is unscaled, and a coarse pointer then paints chrome it cannot
  // grab.
  const chromeSizes = useMemo(
    () => targetSizesPx(deviceProfile.targetScale),
    [deviceProfile.targetScale],
  );

  // `scene` accepts either a live `Scene` or a `SerializedScene` JSON
  // object. JSON is baked once via useState init; subsequent renders
  // ignore prop changes (use a `key` prop on `<SceneCanvas>` to force a
  // fresh canvas).
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
  // Holds the full `CanvasExtensionApi` so we can call `requestRedraw` after
  // dispatcher-side gesture pumps. Without this, dispatcher-only actions
  // (marquee, lasso, anything driven solely by `useGestureDispatcher`) never
  // trigger a re-paint between pointerdown and pointerup — the legacy tools
  // dispatcher's `onGestureChange` only fires for legacy `tool.drag.*` hooks,
  // which the migrated actions don't provide.
  const canvasApiRef = useRef<CanvasExtensionApi | null>(null);
  // Set from the merged ref callback, so effects needing the handle key off it
  // instead of assuming when React attaches it.
  const [canvasReady, setCanvasReady] = useState(false);

  useEffect(() => {
    dlog('scene-canvas', 'mount');
    return () => dlog('scene-canvas', 'unmount');
  }, []);

  // Content-handler registration: the kit's defaults are refcounted (they
  // stay registered while ANY SceneCanvas is mounted — see
  // `acquireKitContentHandlers`); consumer handlers from the `ingestion`
  // prop live for this canvas's lifetime.
  const consumerHandlers = ingestion?.handlers;
  useEffect(() => {
    const disposers = [acquireKitContentHandlers()];
    for (const h of consumerHandlers ?? []) disposers.push(registerContentHandler(h));
    return () => disposers.forEach((d) => d());
  }, [consumerHandlers]);

  // Animator subscription: when an animator is provided, request a redraw
  // on every active frame so consumer `drawOne` functions reading
  // `animator.colorOverrides` (or any other non-scene channel the
  // animator may mutate) reflect the latest values. The animator only
  // ticks while animations are active, so idle frames don't repaint.
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

  // A scene write repaints; it does not re-render this component. The layers
  // read the scene at paint time and `contentVersion` is a getter, so nothing
  // here needs a commit to draw the new content. Chrome rendering node data as
  // DOM subscribes for itself — `useScene`'s default, `SelectionPanel`, the
  // panels an app hangs beside the canvas — which is what lets a host driving
  // poses from a frame loop take `useScene(…, { subscribe: false })` and
  // actually get it.
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

  // Selection: caller-supplied wins; otherwise build from selectionOptions.
  // Hooks always run unconditionally — when a caller supplies `selection`,
  // the internally-built one is unused but the hook still fires.
  // Bound to the scene, so the selection an edit was made under rides on the
  // scene's history entries and undo can put it back.
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

  // Publish the current selection (with optional per-id kind labels) into any
  // surrounding `<SelectionContextProvider>` so non-canvas UI can read it.
  // No-op when no provider is in scope.
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

  // Path-editing edit-mode state. Owned here so it's reachable from both:
  //   - the `pathEditingOverlay` chrome layer wired below
  //   - `useEditAnchorsDepSource`, mounted in the child StandardActionsRegistrar
  // The state stays empty until `enterPathEditAction` (double-click on a
  // selected polygon) sets it, and clears on `exitPathEditAction` (Escape).
  // Until then, the chrome doesn't draw and the gesture doesn't route to
  // `editAnchorsAction` — both gate on `editingId !== ''`.
  const [pathEditingId, setPathEditingId] = useState<string>('');
  const pathEditingIdRef = useLatest(pathEditingId);
  const pathEditRef = useLatest(pathEdit);
  // `anchorEditingAllowed` is declared below (it needs `getActiveModeRef`);
  // hold it in a ref so `effectivePathEditingId` — used by consumers
  // declared both above and below that point — can read it lazily.
  const anchorEditingAllowedRef = useRef<(() => boolean) | undefined>(undefined);
  /**
   * The edit target, masked by whether the host still permits anchor
   * editing.
   *
   * Every surface that cares — the overlay layer, the `editingAnchors`
   * rule input, the selection-overlay suppression set, the select tool's
   * extend-click lock — reads this rather than the raw state. Leaving
   * path-edit mode therefore tears all of them down at once, by any route.
   * That matters because `exitPathEditAction` is not the only way out:
   * a host's own mode machine can leave the mode without running it
   * (`apps/draw` binds Escape to one), and before this the raw id stayed
   * set — inert anchor squares kept drawing over the shape and the
   * selection outline stayed suppressed.
   *
   * Masking rather than clearing on purpose: the mode can change without
   * re-rendering this component, so there is no reliable moment to write
   * state. Read-time masking cannot go stale.
   */
  const effectivePathEditingId = useCallback((): string => {
    if (pathEditRef.current) return pathEditRef.current.editingId() ?? '';
    const allowed = anchorEditingAllowedRef.current;
    if (allowed && !allowed()) return '';
    return pathEditingIdRef.current;
  }, [pathEditingIdRef, pathEditRef]);
  // Anchor selection + in-flight marquee. Both are per-frame inputs to
  // the overlay's draw(), never to a React render, so they live in refs
  // and request a repaint directly. Holding them in state would re-render
  // the whole SceneCanvas subtree on every pointermove of a marquee drag.
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

  // Apply the handle-size fallback here so useSceneSelectTool always receives
  // a concrete radius even when the caller omits selectTool entirely.
  const selectToolWithDefaults = useMemo(() => ({
    handleHitRadius: chromeSizes.handle,
    // Shift-click belongs to the anchor selection while a path is being
    // anchor-edited; see `UseSelectToolOptions.extendClickLocked`.
    extendClickLocked: () => effectivePathEditingId() !== '',
    // `selectionAllowed` used to sit here, hand-checking the active mode for
    // `creates-selection` because the tool's pointerDown classifier was a
    // phase-table route and `Action.eligible` was never evaluated on that
    // pipeline (audit 3.4). The classifier is now `select.pick`, which
    // declares that capability itself — one rule, evaluated in one place.
    ...selectToolOpts,
  }), [selectToolOpts, chromeSizes.handle, effectivePathEditingId]);

  // Stable ref to the live selection; updated every render so the affordanceAt
  // and classifyTarget thunks (which live in an effect closure) always read
  // the latest selection without causing re-renders.
  const selectionRef = useLatest(selection);

  // Build a per-instance NodeRouting registry. When `routing` is unset, fall
  // back to `inferredNodeRouting` (data-shape inference: `data.text` →
  // `'text'`, `data.path` → `'path'`, `data.image` → `'image'`). Pass an
  // explicit `routing={[]}` to opt out entirely — the classifier becomes
  // undefined and every hit comes back as `kind: 'unknown'`.
  const kindClassifier = useMemo(() => {
    const effective = routing === undefined ? inferredNodeRouting : routing;
    if (effective.length === 0) return undefined;
    const registry = createNodeRouting();
    for (const k of effective) registry.register(k);
    return (data: TData) => registry.classify(data);
  }, [routing]);

  // Node id → routing-trait kind, for the body classifier. Reusing the routing
  // registry here is what makes `target: 'kind:text'` on a binding speak the
  // same vocabulary as `Hit.kind` and the routing tables, rather than a second
  // one invented for bindings. Undefined when `routing={[]}` opts out, which
  // leaves every `kind:` target form unmatchable.
  const kindOfNode = useMemo(() => {
    if (!kindClassifier) return undefined;
    return (id: string): string | undefined => {
      const node = scene.get(id as NodeId);
      return node ? kindClassifier(node.data) : undefined;
    };
  }, [kindClassifier, scene]);

  // The painted alpha of a node in this view: the caller's `alphaFor`
  // (scoping-dim, and anything else a consumer fades) times any per-node
  // override alpha. `<Canvas>` has no scene, so the override half is folded
  // in here — and the pick path reads the same number the painter does, or a
  // node faded to nothing stays clickable.
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
    commitInsert: insertTool?.create,
    insertLayer: insertTool?.layer,
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

  // Resolved through the select tool's own single-hit picker, so `onClick`,
  // `onDoubleClick`, hover, and tool routing all name the node a click selects.
  //
  // When isPointerInteractive is supplied, the result is filtered: ids for
  // which the predicate returns false cause getNodeAtPoint to return null,
  // suppressing pointer events for non-interactive nodes (e.g. scoping-dim).
  const getNodeAtPoint = useMemo(() => {
    if (!internalPickBest) return undefined;
    const nodeResolver = (id: string) => {
      // A caller's `geometry.pickEvery` can answer an id the scene does not hold.
      const node = adapter.getNode(id);
      if (!node) return null;
      const kind = kindClassifier ? kindClassifier(node.data) : 'unknown';
      return { kind, pose: adapter.getWorldPose(id), data: node };
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

  const inertiaEnabled = !!viewport?.inertia;
  const inertiaObj = typeof viewport?.inertia === 'object' ? viewport.inertia : undefined;
  // `inertia: true` means "on with kit defaults", so an enabled-but-objectless
  // config still has to reach the tool — an empty object, not `undefined`,
  // which the tool reads as off.
  const handToolInertia = inertiaEnabled
    ? {
        friction: inertiaObj?.friction,
        minSpeed: inertiaObj?.minSpeed,
        boundary: inertiaObj?.boundary,
        bounds: inertiaObj?.bounds,
      }
    : undefined;
  // useHandTool must always be called (rules of hooks); it is a no-op when
  // viewport is absent — the tool is simply not added to the registry.
  const handTool = useHandTool(handToolInertia ? { inertia: handToolInertia } : {});

  // Built-ins to mount: what `defaultTools` lists, plus the tool each preset
  // brings — `select` the select tool, `view` the hand.
  const baseRequestedTools: readonly BuiltinToolId[] = [
    ...(defaultTools ?? []),
    ...(enabled.has('select') ? ['select' as const] : []),
    ...(enabled.has('view') ? ['hand' as const] : []),
  ];

  // Patch-form `tools` extras with value `true` widen the requested set
  // ("pull in this built-in"). Computed here so the rest of the if-ladder
  // treats them identically to ids that came in via `defaultTools`.
  const KNOWN_BUILTIN_IDS: ReadonlySet<BuiltinToolId> = new Set<BuiltinToolId>([
    ...NON_SHAPE_BUILTIN_TOOLS, ...KIT_SHAPE_KINDS,
  ]);
  const toolsPatchExtras = (() => {
    if (!toolsProp || isToolsApi(toolsProp)) return null;
    return toolsProp;
  })();
  const trueIds = new Set<BuiltinToolId>();
  if (toolsPatchExtras) {
    for (const [id, value] of Object.entries(toolsPatchExtras)) {
      if (value !== true) continue;
      if (!KNOWN_BUILTIN_IDS.has(id as BuiltinToolId)) {
        if (IS_DEV) {
          console.warn(`[SceneCanvas] tools.${id}=true is not a known built-in id; ignoring`);
        }
        continue;
      }
      trueIds.add(id as BuiltinToolId);
    }
  }
  const wants = (id: BuiltinToolId): boolean =>
    baseRequestedTools.includes(id) || trueIds.has(id);

  // Synthesize the shape/lasso/text/clone tools — always called per React
  // rules-of-hooks; only registered below when requested. Per-tool options
  // (lasso mode, clone-selection) thread through `toolOptions`.
  const shapeTools = useBuiltinShapeTools({ options: toolOptions });

  const defaultLongPressFeedback = useMemo(() => createLongPressFeedbackContribution(), []);
  const feedbackOpt = longPress?.feedback ?? true;
  const pressFeedback = feedbackOpt === true ? defaultLongPressFeedback : feedbackOpt || null;
  const mergedAmbient = useMemo(
    () => (pressFeedback ? [...(ambient ?? []), pressFeedback] : (ambient ?? [])),
    [ambient, pressFeedback],
  );

  const internalRegistry: Record<string, AnyTool> = {};
  if (wants('select')) internalRegistry.select = internalSelect;
  // `hand` stays in the registry (not ambient) so its H keybinding and its
  // Space hold both apply.
  if (wants('hand')) internalRegistry.hand = handTool;
  // Shape / lasso / text tools — registry entries with built-in
  // keybindings (R/E/G/N/L/T) routed via `useKeybindings`.
  if (wants('rect'))    internalRegistry.rect    = shapeTools.rect;
  if (wants('ellipse')) internalRegistry.ellipse = shapeTools.ellipse;
  if (wants('line'))    internalRegistry.line    = shapeTools.line;
  if (wants('polygon')) internalRegistry.polygon = shapeTools.polygon;
  if (wants('star'))    internalRegistry.star    = shapeTools.star;
  if (wants('pen'))     internalRegistry.pen     = shapeTools.pen;
  if (wants('pencil'))  internalRegistry.pencil  = shapeTools.pencil;
  if (wants('lasso'))   internalRegistry.lasso   = shapeTools.lasso;
  if (wants('text'))    internalRegistry.text    = shapeTools.text;

  // Patch-form `tools` prop: merge extras / overrides / omissions into the
  // internal registry. `false` drops a bundled tool; `true` is already
  // accounted for above via the `wants()` expansion; `AnyTool` adds or
  // replaces (dev-only warning on replace). Takeover form (full `ToolsApi`)
  // is handled below via `toolsProp ?? internalTools`.
  const toolsPatch = toolsPatchExtras;
  if (toolsPatch) {
    for (const [id, value] of Object.entries(toolsPatch)) {
      if (value === false) {
        delete internalRegistry[id];
      } else if (value === true) {
        // Already pulled in via the `wants()`-driven if-ladder above.
        continue;
      } else {
        if (IS_DEV && id in internalRegistry) {
          console.warn(`[SceneCanvas] tools prop overrides bundled "${id}" tool`);
        }
        internalRegistry[id] = value;
      }
    }
  }

  // Takeover form: only when toolsProp is the full ToolsApi shape.
  const toolsTakeover = toolsProp && isToolsApi(toolsProp) ? toolsProp : null;

  const internalTools = useTools({
    active: initialActiveTool ?? ('select' in internalRegistry ? 'select' : null),
    registry: internalRegistry,
    ...(mergedAmbient.length ? { ambient: mergedAmbient } : {}),
    ...(modes ? { modes } : {}),
  });

  // Auto-wire keybindings against whichever registry is live.
  //
  // Both calls fire unconditionally (rules of hooks); the inactive one is
  // silenced via the hook's own `disable` option:
  //   - internal registry: disabled whenever the consumer passed `tools=`.
  //   - consumer registry: disabled when `tools=` was omitted (nothing to
  //     bind) or when the consumer opted out via `enableKeybindings={false}`.
  //
  // The `enableKeybindings` opt-out also silences the internal wiring, so
  // a consumer relying entirely on the internal tools can take over with
  // their own `useKeybindings(...)` call. The fallback `useTools` passed
  // to the second call when `toolsProp` is absent is a render-stable empty
  // stand-in just to keep the call site valid; it never actually fires
  // because `disable` is true on that branch.
  const liveToolsRef = useLatest<ToolsApi | null>(toolsTakeover ?? internalTools);
  const getActiveModeRef = useLatest(getActiveMode);
  //
  // Without a mode registry every tool stays activatable.
  const isToolEligible = useCallback((toolId: string): boolean => {
    const getMode = getActiveModeRef.current;
    if (!getMode) return true;
    const caps = liveToolsRef.current?.registry?.[toolId]?.eligibility.capabilities;
    return capabilitiesAllowed(getMode().allowedCapabilities, caps);
  }, [getActiveModeRef, liveToolsRef]);


  const tools = toolsTakeover ?? internalTools;

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

  // Surface the resolved ToolsApi to the introspection callback (the
  // toolkit-builder dev surface uses this to walk `tools.registry` for
  // its live route table). Fires whenever the `tools` identity changes,
  // which is stable across most renders thanks to useTools' useMemo.
  const onToolsCreatedRef = useLatest(onToolsCreated);
  useEffect(() => { onToolsCreatedRef.current?.(tools); }, [tools, onToolsCreatedRef]);

  // `onDoubleClick` used to be backed by a native `dblclick` listener on the
  // canvas, which made it a THIRD independent definition of "double click"
  // alongside the tool dispatcher's 300ms/8px `dblTap` and the gesture
  // dispatcher's 600ms/8px synthesized event — so which double-click
  // behaviors a consumer got depended on the millisecond gap between the two
  // clicks. The other two are gone; this now observes the gesture
  // dispatcher's single definition and resolves the hit with the same
  // `getNodeAtPoint` picker the rest of the canvas uses.
  //
  // It rides the dispatcher as an OBSERVER rather than an Action binding
  // because the prop is a notification, not a behavior: as a binding it would
  // lose first-match-wins to `enterPathEdit` on every body hit and silently
  // stop firing.
  const getNodeAtPointRef = useLatest(getNodeAtPoint);
  const onDoubleClickObserver = useHitObserver(onDoubleClick, getNodeAtPointRef);
  const onClickObserver = useHitObserver(onClick, getNodeAtPointRef);

  // (Legacy `gestures` prop removed alongside the consumer-facing action
  // hooks; undo/redo and friends now register via the Actions Registry.)

  // Merge caller-supplied layers with kit defaults. When `layers` is omitted
  // the result is the full default set (scene + selectionOverlay). Partial
  // configs deep-merge; `null` slot values suppress a default explicitly.
  const mergedLayers = useMemo(
    () => mergeLayersWithDefaults(layers, deviceProfile.targetScale),
    [layers, deviceProfile.targetScale],
  );

  // `selectTool.rotate === false` disables rotation: drop the `rotate` action
  // (its rotation-handle chrome is hidden via effectiveChromeVisibility above).
  // A consumer-supplied `rotate` override still wins; `actions === null`
  // (all defaults disabled) is left untouched.
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

  // Shared `Dispatcher` instance — created once per `<SceneCanvas>` and
  // threaded to both the gesture-dispatcher mounter (which pumps input
  // events into it) and the preview-ghost layer (which walks its
  // `getInFlightHandles()` for dispatcher-side gesture previews). Lazy
  // ref init keeps identity stable across renders without an effect.
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

  // Preview-ghost layer: renders in-flight gesture poses on top of the
  // committed scene using the scene slot's `drawOne`, from whichever view's
  // preview sources the draw envelope carries. It takes the scene-wired slot,
  // so a ghosted derived node still resolves its path.
  const previewLayer = usePreviewGhostLayer<TData, TLayer, TPose>({
    scene,
    sceneSlot,
    dispatcher,
  });

  // Dispatcher-driven chrome overlays — marquee rect + lasso polyline +
  // any other `OngoingHandle.overlay()` shapes the in-flight actions
  // publish. Screen-space; slotted after the preview-ghost so chrome
  // paints on top of any displaced ghost silhouettes.
  const dispatcherOverlay = useDispatcherOverlayLayer({ dispatcher });

  // Chrome-caps hover tracking: last-hovered NodeId fed into `ChromeCtx.hover`.
  // The hook attaches its own pointermove/leave listeners on the element
  // `mergedRef` hands it and
  // caches the topmost-id from `getNodeAtPoint` on a ref. No re-renders.

  const getNodeAtPointRefForHover = useLatest(getNodeAtPoint);
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
      const hit = getNodeAtPointRefForHover.current?.(
        x, y, reg ? { scale: view.scale, layerIsPainted: reg.layerIsPainted } : view,
      );
      return hit ? { id: hit.id as NodeId } : null;
    },
    enabled: chromeVisibility !== undefined,
  });

  // Stable refs for the live selection / view / focus / suppression sources
  // that feed `buildChromeCtx`. The resolver factory below closes over these
  // and is called per draw / per hitTest from Canvas.
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
    // `selectTool.rotate === false` hides the rotation handle (its action is
    // also dropped below) so a non-rotatable consumer fully opts out.
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

  // The visibility predicate factory passed to <Canvas>. Called fresh per
  // draw / hitTest; builds ChromeCtx from the live refs and resolves
  // against the merged rule table. Returns the universal predicate when
  // no consumer overrides are present AND no hover tracking is needed —
  // letting the kit's defaults still gate paint without forcing every
  // legacy consumer onto chrome-caps.
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
    // buildChromeCtx returns a ChromeCtx (legacy shape); resolveVisibility
    // accepts both ChromeCtx and RuleCtx and supplies defaults when mode/
    // allowedCapabilities are absent. We attach them inline so the
    // mode-gated default rules can read them.
    // `selectionResizable`: true only when every selected node is resizable
    // (per `selectTool.resize.resizable`); undefined when no predicate is
    // supplied → the `resizable:` selector treats it as resizable (back-compat).
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

  // Pen preview overlay — reads the pen tool's persistent scratch and draws
  // the in-progress path (anchors, handles, rubber-band, close hint). Only
  // wired when the pen tool is actually registered; otherwise null.
  const wantsPen = wants('pen');
  const penPreviewLayer = useMemo(
    () => (wantsPen
      ? createPenPreviewLayer({ penTool: shapeTools.pen as Tool<PenScratch> })
      : null),
    [shapeTools.pen, wantsPen],
  );

  // Bump the canvas's redraw whenever edit-mode changes — the chrome layer
  // reads `editingId` via a ref, so without an explicit redraw signal a
  // dirty-render canvas (no animation in flight) sits with stale frames
  // and the user sees no chrome until something else triggers a paint.
  useEffect(() => {
    canvasApiRef.current?.requestRedraw?.();
  }, [pathEditingId]);

  // Path-editing overlay — anchor squares, tangent lines, control-point
  // dots for the polygon currently in edit mode. Reads the same state the
  // dep does, so chrome appears exactly when (and only when) the gesture
  // path is also active.
  //
  // `getPose` walks the dispatcher's in-flight handles first so the chrome
  // tracks the live `previewPose` while editAnchorsAction is dragging; only
  // falls back to the committed scene pose between gestures. This is what
  // makes the dragged anchor / handle move under the cursor instead of
  // staying pinned to its committed position until the drag commits.
  const sceneRefForOverlay = useLatest(scene);
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

  // Resolve the live (preview-aware) world polygon for `id`. Reads from
  // the dispatcher's in-flight handles first — whichever handle owns
  // the gesture (editAnchors anchor-drag, move-the-whole-path, etc.)
  // contributes the previewPose / previewData that we'd otherwise
  // dispatch separately. Synthesizes a (pose, data) pair and routes it
  // through `resolveEditablePathOf` so chrome and slops viz follow
  // *any* in-flight gesture that previews state for the editing id.
  const livePathFor = (
    id: string,
    previews: readonly GesturePreviewSource[],
    view: View,
  ): PolygonPath | null => {
    const node = sceneRefForOverlay.current?.get(id as never);
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

  // Selection overlay — constructed here (scene-aware) per main's seam refactor.
  // Layered on top: path-edit suppression from HEAD's branch.
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
    ...(penPreviewLayer ? { penPreview: { layer: penPreviewLayer, after: 'dispatcherOverlay' } } : {}),
    pathEditingOverlay: { layer: pathEditingOverlayLayer, after: 'selectionOverlay' },
    ...(slopsOn ? { slopsDebug: { layer: slopsLayer, after: 'pathEditingOverlay' } } : {}),
  }), [mergedLayers, sceneSlot, selectionOverlayLayer, previewLayer, dispatcherOverlay, penPreviewLayer, pathEditingOverlayLayer, slopsOn, slopsLayer]);

  // Standard-action deps: closures over the live scene / selection / adapter
  // so the resolved actions always read current state. `useStandardActions`
  // stabilizes via refs internally — these closures are passed every render
  // but the registered Action descriptors are not re-registered.
  // `CanvasExtensionApi.ingest` — imperative entry into the same
  // content-handler pipeline OS drop / clipboard paste hit. Routed through
  // `registry.trigger('ingest', …)` so the action's `requires` deps
  // (insert, ingestion, …) are resolved exactly as on the dispatcher path.
  // `StandardActionsRegistrar` stashes the registry into this ref.
  const actionsRegistryRef = useRef<ActionsRegistry | null>(null);

  // Clipboard-paste ctx for the kit weasel-JSON content handler
  // (`IngestCtx.clipboard`). Built from THIS canvas's synthesized adapter so
  // OS-arriving pastes re-materialize through the same `commitPaste` path
  // `useClipboardOps` uses. Absent (⇒ the handler declines) when the
  // consumer set `ingestion.clipboard.enabled: false` or the adapter lacks
  // `commitPaste` (always present on the synthesized adapter; guarded for
  // future adapter overrides).
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

  // Merge the forwarded ref with our internalCanvasRef so the dispatcher can
  // read the canvas element even when the consumer also forwards a ref.
  // The handle exposed to consumers extends the primitive's with `ingest`
  // (SceneCanvas-only — it needs the action stack).
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
      backgroundFill={backgroundFill}
      cursorCoordsHud={cursorCoordsHud}
      pickHud={pickHud}
      modalityHud={modalityHud}
      {...(debug !== undefined ? { debug: canvasDebug(debug) } : {})}
      pickBest={internalPickBest}
      contentVersion={scene.getVersion}
      layerVisibility={layerVisibility}
      layerOrder={layerOrder}
      {...(viewProp !== undefined ? { view: viewProp } : { defaultView })}
      onViewChange={notifyViewChange}
      shaders={shaders}
      flattenTolerance={flattenTolerance}
      // onBackgroundClick is intentionally NOT wired here. The `clearSelection`
      // action binding in the select tool handles "click on empty background clears
      // selection" for all SceneCanvas consumers. Wiring a separate background-click
      // callback would interfere with the gesture dispatcher (which handles lasso,
      // marquee, etc.) since tools.dispatcher.hasActiveGesture() only covers the
      // legacy tool channel, not the gesture dispatcher channel.
      {...(redrawOn ? { redrawOn } : {})}
      {...restProps}
    />
  );

  // Test hook: opt-in via ?test=1, never in production builds. See src/test-hook.
  const testHookSceneRef = useLatest(scene);
  const testHookSelectionRef = useLatest(selection);

  useEffect(() => {
    // Call-site gate: in a consumer's production build, esbuild/webpack/Vite
    // constant-fold `process.env.NODE_ENV` to `"production"` and DCE this
    // block, dropping the test-hook references. Same dev-only pattern as
    // React's invariant warnings. Gating only inside `installTestHookIfRequested`
    // is not enough — a called function can't be tree-shaken even if its body
    // is dead, so the gate must sit at the call site too.
    if (process.env.NODE_ENV !== 'production') {
      const hook = installTestHookIfRequested({
        getScene: () => testHookSceneRef.current as never,
        getSelectionIds: () =>
          (testHookSelectionRef.current?.current as readonly string[] | undefined) ?? [],
        getView: () => currentViewRef.current,
        getActiveToolId: () => liveToolsRef.current?.active ?? null,
      });
      if (hook) {
        hook._markReady();
        return () => releaseTestHook(hook);
      }
    }
    return undefined;
  }, [testHookSceneRef, testHookSelectionRef, liveToolsRef]);

  return (
    <DeviceProfileProvider value={device}>
      <ViewInputsProvider value={viewInputs}>
        <>
          <PointerProviderIfRoot>
            <>
              {canvas}
              <PointerPublisher canvasRef={internalCanvasRef} />
              <StandardActionsRegistrar
                selection={selection}
                scene={scene}
                adapter={adapter as unknown as BridgeAdapter}
                actionDefaults={actionDefaults}
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
                isToolEligible={isToolEligible}
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
        </>
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
