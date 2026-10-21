/**
 * `<CanvasView>` — a second view on an existing canvas: its own camera over a
 * rect of the surface, with input routed to it.
 *
 * Mount one inside `<SceneCanvas>`, or declare the same thing through the
 * surface's `views` prop, which renders one of these per descriptor.
 */
import {
  useCallback, useEffect, useImperativeHandle, useInsertionEffect, useLayoutEffect, useMemo, useRef,
} from 'react';
import type { Dims, RenderLayer } from 'core/layers/render';
import type { View } from 'core/viewport/view';
import { clientToWorld } from 'core/viewport/clientToWorld';
import { createViewportLayer } from 'features/viewports/viewportLayer';
import { createDispatcher } from '@weasel-js/routing';
import type { IngestionDep, ViewApi } from 'interactions/actions/depSchema';
import { viewportWorldRect } from 'core/viewport/viewportWorldRect';
import { useSelection } from 'core/selection/useSelection';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { useViewHelpers } from './useViewHelpers';
import { useViewAim } from './useViewAim';
import { hitAtOf } from './deps/dispatchSources';
import { anchorStateFrom, buildAffordanceAt, buildClassifyTarget, layerAffordance } from './affordanceAt';
import { pathFromPlane } from './planeClips';
import { useOptionalDepRegistry } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import { useDeviceProfile } from 'core/device/useDeviceProfile';
import {
  createGestureSource,
  createDispatcherPreviewSources,
} from './SceneCanvas/dispatcherGestureBounds';
import { useOptionalViewInputs, type SurfaceViewInputs, type ViewRuleInputs } from './viewInputs';
import type { CanvasViewProps, ViewRect } from './canvasViewProps';
export type { CanvasViewProps, ViewRect } from './canvasViewProps';
import { NO_RECT, sizeOf, useViewNesting } from './useViewNesting';
import {
  useOptionalViewRegistry,
  surfaceLocal,
  IDENTITY_VIEW,
  UNMEASURED_DIMS,
  type ViewRegistration,
} from './viewRegistry';

/** What a view builds its helpers from outside a surface: nothing but the
 *  default geometry, which answers `null` for every lookup. */
// A view outside a surface has no inputs to inherit — including a selection,
// so it falls back to owning one.
const NO_INPUTS: Omit<SurfaceViewInputs, 'selectionApi'> = {
  adapter: undefined,
  geometry: AUTO_POSE_DESCRIPTOR as unknown as PoseDescriptor<unknown>,
  boundsOf: undefined,
};

const ALWAYS_VISIBLE = (): boolean => true;

const ALL_LAYERS = (s: readonly RenderLayer<unknown>[]): readonly RenderLayer<unknown>[] => s;


/**
 * One view on a shared canvas. Owns a camera, contributes the viewport node
 * that paints it, and registers the dispatch record that sends gestures inside
 * its rect to that camera rather than to the canvas's.
 *
 * Renders nothing itself — it is a declaration, and the surface does the
 * drawing. Outside a surface that mounts a view registry it is inert.
 */
export function CanvasView(props: CanvasViewProps): null {
  const {
    id, parent, bounds,
    layers = ALL_LAYERS, layerVisibility, layerOrder, background, order = Infinity, label, cameraRef,
    selection: selectionProp, selectionOptions, interactive = true, paint = true,
  } = props;

  const registry = useOptionalViewRegistry();
  const depRegistry = useOptionalDepRegistry();
  const depRegistryRef = useLatest(depRegistry);

  // Hooks run unconditionally; the owned selection goes unused unless this
  // view asked for one.
  const ownSelection = useSelection(selectionOptions);
  const viewSelection = selectionProp ?? (selectionOptions ? ownSelection : undefined);

  const inputs = useOptionalViewInputs();
  // The selection this view acts on: its own when it has one, the surface's
  // otherwise.
  const selection = viewSelection ?? inputs?.selectionApi ?? ownSelection;

  // Everything the registration reads is behind a ref: the registration object
  // is registered once and must not churn, but what it answers with has to be
  // the last committed render's.
  const live = useLatest({
    parent, bounds, layers, layerVisibility, layerOrder, viewSelection, selection,
  });

  const { frameIn, rectAt, derivedAt, drawnLayers, layerIsPainted } = useViewNesting(registry, live);

  /** The rect for the surface's current frame — what a client point and a
   *  clamp are measured against outside a draw call. */
  const rectNow = useCallback((): ViewRect => {
    const surface = registry?.surface();
    return rectAt(surface?.view() ?? IDENTITY_VIEW, surface?.dims() ?? UNMEASURED_DIMS);
  }, [registry, rectAt]);

  const {
    getView: camera, setView, setViewFromInput, subscribeView,
    adoptControlled, announceControlled, clearSubscribers, held, aim, setAim, cameraAt,
  } = useViewAim({ props, id, registry, derivedAt, rectAt, rectNow });
  useInsertionEffect(adoptControlled);
  useLayoutEffect(announceControlled);
  useEffect(() => clearSubscribers, [clearSubscribers]);
  useImperativeHandle(cameraRef, () => ({ getView: camera, setView, subscribeView }), [camera, setView, subscribeView]);

  const viewApi = useMemo<ViewApi>(() => ({
    get: camera,
    set: setViewFromInput,
    hostSize: () => sizeOf(rectNow()),
    layerIsPainted,
  }), [camera, rectNow, setViewFromInput, layerIsPainted]);

  // Paste placement is a camera question, so it is this view's when the paste
  // routed here. The rest of the dep — `resolveSrc`, `svg`, `clipboard` — is
  // the surface's one wiring, read live off the canvas registry.
  const ingestionApi = useMemo<IngestionDep>(() => {
    const base = (): IngestionDep | undefined => depRegistryRef.current?.get('ingestion');
    return {
      viewportWorldRect: () => viewportWorldRect(camera(), sizeOf(rectNow())),
      get resolveSrc() { return base()?.resolveSrc; },
      get svg() { return base()?.svg; },
      get clipboard() { return base()?.clipboard; },
    };
  }, [camera, rectNow, depRegistryRef]);

  // One dispatcher per view: in-flight handles are per-view state, and two
  // views must not be able to see each other's.
  const dispatcherRef = useRef<ReturnType<typeof createDispatcher> | null>(null);
  if (!dispatcherRef.current) dispatcherRef.current = createDispatcher();

  // This view's overlay-aware state. The scene half comes from the surface —
  // same adapter, same tools — but everything gesture-shaped is read off this
  // view's own dispatcher, which is where a gesture inside this view lands.
  const rotationBadge = inputs?.rotationBadge ?? null;
  const own = useMemo(() => ({
    gestureSource: createGestureSource(() => dispatcherRef.current),
    ...createDispatcherPreviewSources(() => dispatcherRef.current),
  }), []);

  const inputsRef = useLatest(inputs);

  /** The chrome-caps context this view answers for: its selection, its camera,
   *  its dispatcher's in-flight action. */
  const ruleInputs = useCallback((): ViewRuleInputs => ({
    selection: live.current.selection.get(),
    view: camera(),
    action: dispatcherRef.current!.getActiveAction(),
  }), [camera, live]);

  // The surface's resolver, asked for this view's camera.
  const surfaceBoundsOf = inputs?.boundsOf;
  const boundsOf = useMemo(
    () => (surfaceBoundsOf ? (id: string) => surfaceBoundsOf(id, camera()) : undefined),
    [surfaceBoundsOf, camera],
  );
  const surfaceBoundsOfPose = inputs?.boundsOfPose;
  const boundsOfPose = useMemo(
    () => (surfaceBoundsOfPose
      ? (id: string, pose: unknown) => surfaceBoundsOfPose(id, pose, camera())
      : undefined),
    [surfaceBoundsOfPose, camera],
  );

  const { helpers } = useViewHelpers<unknown>({
    ...(inputs ?? NO_INPUTS),
    boundsOf,
    boundsOfPose,
    ...own,
    selection: selection.current,
    layerIsPainted,
    getIsVisible: () => inputsRef.current?.chromeCaps?.isVisible(ruleInputs()) ?? ALWAYS_VISIBLE,
  });
  const helpersRef = useLatest(helpers);

  /** A client point in this view's world. The rect moves with the outer
   *  camera, so it is read per call rather than closed over. */
  const clientToWorldHere = useCallback((cx: number, cy: number): { x: number; y: number } => {
    const local = surfaceLocal(registry?.surface() ?? null, cx, cy);
    const rect = rectNow();
    const [x, y] = clientToWorld(local.x, local.y, { left: rect.x, top: rect.y }, camera());
    return { x, y };
  }, [registry, rectNow, camera]);

  // Anchors are hit in this view's camera world, where its plane draws them.
  const getAnchorState = useMemo(() => anchorStateFrom(
    () => depRegistryRef.current,
    (id, path) => pathFromPlane(path, inputsRef.current?.planeOfNode?.(id, camera()) ?? null),
  ), [camera, depRegistryRef, inputsRef]);

  const { targetScale } = useDeviceProfile();

  // Selection chrome hit-testing for this view: same construction the surface
  // does for its own, against this view's chrome and camera.
  const affordanceAt = useMemo(() => {
    const inner = buildAffordanceAt({
      getChromeState: () => helpersRef.current.getChromeState(),
      getView: camera,
      targetScale,
      rotationBadge, handleHitRadius: inputs?.resizeHandles?.hitRadiusPx, edgeHandles: inputs?.resizeHandles?.edges,
      getAnchorState,
      getIsVisible: () => helpersRef.current.getIsVisible(),
    });
    return (world: { x: number; y: number }) => {
      // A registered layer this view paints gets first refusal, on this
      // view's frame and envelope. One painted over the surface already had
      // its chance: it occludes the view before routing reaches here.
      const extra = registry?.surface()?.hitTestExtras(
        world.x, world.y, camera(), sizeOf(rectNow()), helpersRef.current, drawnLayers(),
      );
      return extra ? layerAffordance(extra.layerId, extra.hit) : inner(world);
    };
  }, [getAnchorState, rectNow, registry, targetScale, camera, drawnLayers, rotationBadge, inputs?.resizeHandles, helpersRef]);

  const classifyTarget = useMemo(() => buildClassifyTarget(
    () => live.current.selection.get(),
    (wx, wy) => {
      const i = inputsRef.current;
      // This view's camera: the dispatcher converted with `clientToWorldHere`,
      // and a screen-pixel tolerance needs the scale that produced it. The
      // layer gate is this view's too, never the surface's.
      const frame = { ...camera(), layerIsPainted };
      if (i?.pickBest) return i.pickBest(wx, wy, frame);
      const ids = i?.pickEvery?.(wx, wy, frame) ?? [];
      return ids.length > 0 ? ids[ids.length - 1]! : null;
    },
    (id) => inputsRef.current?.kindOfNode?.(id),
    (id) => inputsRef.current?.doubleClickNames?.(id) ?? id,
  ), [camera, layerIsPainted, live, inputsRef]);

  const registration = useMemo<ViewRegistration>(() => ({
    id,
    ...(parent !== undefined ? { parent } : {}),
    order,
    interactive,
    paint,
    held,
    aim,
    setAim,
    layer: createViewportLayer<unknown, unknown>({
      id,
      label: label ?? id,
      source: () => [...drawnLayers(), ...(registry?.markerLayers(id) ?? [])],
      view: cameraAt,
      bounds: (outer, dims) => rectAt(outer, dims),
      ...(parent !== undefined ? { clip: (outer: View, dims: Dims) => frameIn(outer, dims)?.clip ?? NO_RECT } : {}),
      // The surface half of the envelope passes through; the view half is
      // this view's, so its layers paint its chrome rather than the
      // surface's.
      data: (outer) => ({ ...(outer as object), ...helpersRef.current, viewId: id }),
      ...(background !== undefined ? { background } : {}),
    }),
    layerIsPainted,
    drawnLayers,
    target: {
      dispatcher: dispatcherRef.current!,
      affordanceAt,
      classifyTarget,
      clientToWorld: clientToWorldHere,
      deps: () => ({
        view: viewApi, ingestion: ingestionApi, hitAt: hitAtOf(classifyTarget),
        // An Escape here cancels what is in flight here.
        dispatcher: { cancelAll: (reason) => dispatcherRef.current!.cancelAll(reason) },
        // Only a view with its own selection overlays that one; otherwise the
        // surface's answer stands, wrappers (`selectable`) included.
        ...(live.current.viewSelection ? { selection: live.current.viewSelection } : {}),
      }),
      // Action eligibility is chrome-caps evaluated against this view, so a
      // rule that hides an action in one panel cannot decline a gesture in
      // another.
      getRuleCtx: () => inputsRef.current?.chromeCaps?.ruleCtx(ruleInputs()),
    },
  }), [id, parent, order, interactive, paint, held, aim, setAim, label, background, rectAt, cameraAt, viewApi,
       affordanceAt, classifyTarget, clientToWorldHere, ruleInputs, ingestionApi, drawnLayers,
       layerIsPainted, live, inputsRef, helpersRef, frameIn, registry]);

  useEffect(() => {
    if (!registry) return;
    return registry.register(registration);
  }, [registry, registration]);

  // Apart from the registration, which is replaced whenever a prop it reads
  // changes: only the view going away ends what is in flight over it.
  useEffect(() => () => dispatcherRef.current?.cancelAll('cancel'), []);

  // The surface paints this view from `live`, so any committed render of it —
  // a controlled camera, its bounds, its layer gate — needs a frame.
  useEffect(() => {
    registry?.surface()?.requestRedraw();
  });

  return null;
}
