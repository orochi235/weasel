/**
 * `<CanvasView>` — a second view on an existing canvas: its own camera over a
 * rect of the surface, with input routed to it.
 *
 * Mount one inside `<SceneCanvas>`, or declare the same thing through the
 * surface's `views` prop, which renders one of these per descriptor.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dims, RenderLayer } from 'core/layers/render';
import { normalizeView, type View } from 'core/viewport/view';
import { clientToWorld } from 'core/viewport/clientToWorld';
import { clampView } from 'core/viewport/clampView';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { createViewportLayer } from 'features/viewports/viewportLayer';
import { createDispatcher } from 'interactions/dispatcher/dispatcher';
import type { IngestionDep, ViewApi } from 'interactions/actions/depSchema';
import { viewportWorldRect } from 'core/viewport/viewportWorldRect';
import { useSelection, type SelectionApi, type UseSelectionOptions } from 'core/selection/useSelection';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { useViewHelpers } from './useViewHelpers';
import { anchorStateFrom, buildAffordanceAt, buildClassifyTarget } from './affordanceAt';
import { useOptionalDepRegistry } from 'interactions/actions/depRegistry';
import { useDeviceProfile } from 'core/device/useDeviceProfile';
import {
  createGestureSource,
  createDispatcherPreviewSources,
} from './SceneCanvas/dispatcherGestureBounds';
import { useOptionalViewInputs, type SurfaceViewInputs, type ViewRuleInputs } from './viewInputs';
import { createSceneLayerGate, paintedLayers } from './sceneLayerPaint';
import {
  useOptionalViewRegistry,
  IDENTITY_VIEW,
  UNMEASURED_DIMS,
  type ViewRegistration,
} from './viewRegistry';

/** A rect on the surface, in CSS pixels from the canvas top-left. */
export interface ViewRect { x: number; y: number; w: number; h: number }

/** Props for `<CanvasView>`. @experimental */
export interface CanvasViewProps {
  /** Identifies the view to the surface and to input routing. Must be unique
   *  among the views on one canvas. */
  id: string;
  /** Where this view paints, recomputed every frame so the rect can track the
   *  outer camera. A plain rect is accepted for a fixed panel. */
  bounds: ViewRect | ((outer: View, dims: Dims) => ViewRect);
  /** Camera. Supply this to control it; otherwise the view keeps its own,
   *  seeded from `defaultView`. `onViewChange` fires either way.
   *
   *  A thunk is a camera derived from the canvas's — a loupe following the
   *  pointer — read fresh at every paint and every event, so the two cannot
   *  disagree mid-gesture. It is controlled: a pan inside the view reaches
   *  only `onViewChange`. */
  view?: View | ((outer: View, dims: Dims) => View);
  defaultView?: View;
  onViewChange?: (v: View) => void;
  /** Pan limits, applied to every camera change the same way `<Canvas>`
   *  applies its own. */
  viewBounds?: Bounds;
  /** Which of the surface's layers this view paints. Defaults to all of them —
   *  the same content through a second camera. */
  layers?: (surface: readonly RenderLayer<unknown>[]) => readonly RenderLayer<unknown>[];
  /**
   * Show or hide layers in this view only, by id — the map `<Canvas>` takes,
   * applied after `layers` narrows the stack. A scene layer paints as
   * `scene:<layerId>`; one hidden here neither paints nor picks in this view,
   * and a marquee or Cmd+A routed here passes over it. The surface and every
   * other view are unaffected.
   */
  layerVisibility?: Record<string, boolean>;
  /** Draw order for this view, by layer id, bottom first. A listed order is
   *  the whole list, so a layer left out of it is neither painted nor picked
   *  here. */
  layerOrder?: string[];
  /** Opaque ground painted before the source layers, so the surface does not
   *  show through where the inner camera sees nothing. */
  background?: string;
  /** Paint and hit order. Defaults to `Infinity` — after every view the
   *  surface declared as a prop. */
  order?: number;
  /** Label for debug overlays. Defaults to the id. */
  label?: string;
  /**
   * Whether input over the view resolves through its camera. Default `true`:
   * a press selects what the view shows, and a drag moves it in the view's
   * world units. `false` paints only, and input over it reaches the canvas
   * beneath as though the view were not there.
   *
   * Views do not nest. A view paints and routes the surface's own stack,
   * never another view; overlapping views are hit in paint order.
   */
  interactive?: boolean;
  /**
   * Whether the surface paints the view. Default `true`. `false` is for a
   * host that draws the view inside chrome of its own — a HUD window's
   * interior — through `SceneCanvasApi.addView`'s `draw`, so it lands in
   * that chrome's z-order rather than the surface's.
   */
  paint?: boolean;
  /** A selection of this view's own, which actions dispatched inside it read
   *  and write instead of the surface's. Omit both this and
   *  `selectionOptions` and the view shares the surface's selection — the
   *  default, so undo restores one selection rather than N. */
  selection?: SelectionApi;
  /** Opts this view into owning a selection, configured thus. Ignored when
   *  `selection` is supplied. */
  selectionOptions?: UseSelectionOptions;
}

/** What a view builds its helpers from outside a surface: nothing but the
 *  default geometry, which answers `null` for every lookup. */
// A view outside a surface has no inputs to inherit — including a selection,
// so it falls back to owning one.
const NO_INPUTS: Omit<SurfaceViewInputs, 'selectionApi'> = {
  adapter: undefined,
  geometry: AUTO_POSE_DESCRIPTOR as unknown as PoseDescriptor<unknown>,
  boundsOf: undefined,
  tools: undefined,
};

const ALWAYS_VISIBLE = (): boolean => true;

const ALL_LAYERS = (s: readonly RenderLayer<unknown>[]): readonly RenderLayer<unknown>[] => s;

/**
 * @experimental
 *
 * One view on a shared canvas. Owns a camera, contributes the viewport node
 * that paints it, and registers the dispatch record that sends gestures inside
 * its rect to that camera rather than to the canvas's.
 *
 * Renders nothing itself — it is a declaration, and the surface does the
 * drawing. Outside a surface that mounts a view registry it is inert.
 */
export function CanvasView(props: CanvasViewProps): null {
  const {
    id, bounds, view: viewProp, defaultView, onViewChange, viewBounds,
    layers = ALL_LAYERS, layerVisibility, layerOrder, background, order = Infinity, label,
    selection: selectionProp, selectionOptions, interactive = true, paint = true,
  } = props;

  const registry = useOptionalViewRegistry();
  const depRegistry = useOptionalDepRegistry();
  const depRegistryRef = useRef(depRegistry);
  depRegistryRef.current = depRegistry;

  // Hooks run unconditionally; the owned selection goes unused unless this
  // view asked for one.
  const ownSelection = useSelection(selectionOptions);
  const viewSelection = selectionProp ?? (selectionOptions ? ownSelection : undefined);

  const [internalView, setInternalView] = useState<View>(() => normalizeView(defaultView ?? IDENTITY_VIEW));
  const effectiveView = viewProp ?? internalView;

  // Everything the registration reads is behind a ref: the registration object
  // is registered once and must not churn, but what it answers with has to be
  // this render's.
  const live = useRef({
    view: effectiveView, bounds, layers, layerVisibility, layerOrder, onViewChange, viewBounds, viewProp,
    viewSelection,
    // The selection this view acts on: its own when it has one, the
    // surface's otherwise. Filled in below, once the surface's is in hand.
    selection: viewSelection ?? ownSelection,
  });
  live.current = {
    ...live.current,
    view: effectiveView, bounds, layers, layerVisibility, layerOrder, onViewChange, viewBounds, viewProp,
    viewSelection,
  };

  const rectAt = useCallback((outer: View, dims: Dims): ViewRect => {
    const b = live.current.bounds;
    return typeof b === 'function' ? b(outer, dims) : b;
  }, []);

  /** The rect for the surface's current frame — what a client point and a
   *  clamp are measured against outside a draw call. */
  const rectNow = useCallback((): ViewRect => {
    const surface = registry?.surface();
    return rectAt(surface?.view() ?? IDENTITY_VIEW, surface?.dims() ?? UNMEASURED_DIMS);
  }, [registry, rectAt]);

  const cameraAt = useCallback((outer: View, dims: Dims): View => {
    const v = live.current.view;
    return normalizeView(typeof v === 'function' ? v(outer, dims) : v);
  }, []);

  /** The camera for the surface's current frame. */
  const camera = useCallback((): View => {
    const surface = registry?.surface();
    return cameraAt(surface?.view() ?? IDENTITY_VIEW, surface?.dims() ?? UNMEASURED_DIMS);
  }, [registry, cameraAt]);

  /** The surface's layers this view draws, in the order it draws them. */
  const drawnLayers = useCallback((): readonly RenderLayer<unknown>[] => (
    paintedLayers(registry?.surface()?.layers() ?? [], live.current)
  ), [registry]);

  const [sceneLayerGate] = useState(createSceneLayerGate);
  /** What this view's picks, marquees and select-alls ask of a scene layer. */
  const layerIsPainted = useCallback((layerId: string): boolean => (
    sceneLayerGate(registry?.surface()?.layers() ?? [], live.current)(layerId)
  ), [registry, sceneLayerGate]);

  const setView = useCallback((next: View) => {
    const { viewBounds: vb, onViewChange: cb, viewProp: controlled } = live.current;
    const rect = rectNow();
    const valid = normalizeView(next);
    const clamped = vb ? clampView(valid, vb, { width: rect.w, height: rect.h }) : valid;
    if (controlled === undefined) setInternalView(clamped);
    cb?.(clamped);
    registry?.surface()?.requestRedraw();
  }, [registry, rectNow]);

  const viewApi = useMemo<ViewApi>(() => ({
    get: camera,
    set: setView,
    hostSize: () => {
      const rect = rectNow();
      return { width: rect.w, height: rect.h };
    },
    layerIsPainted,
  }), [camera, rectNow, setView, layerIsPainted]);

  // Paste placement is a camera question, so it is this view's when the paste
  // routed here. The rest of the dep — `resolveSrc`, `svg`, `clipboard` — is
  // the surface's one wiring, read live off the canvas registry.
  const ingestionApi = useMemo<IngestionDep>(() => {
    const base = (): IngestionDep | undefined => depRegistryRef.current?.get('ingestion');
    return {
      viewportWorldRect: () => {
        const rect = rectNow();
        return viewportWorldRect(camera(), { width: rect.w, height: rect.h });
      },
      get resolveSrc() { return base()?.resolveSrc; },
      get svg() { return base()?.svg; },
      get clipboard() { return base()?.clipboard; },
    };
  }, [camera, rectNow]);

  // One dispatcher per view: in-flight handles are per-view state, and two
  // views must not be able to see each other's.
  const dispatcherRef = useRef<ReturnType<typeof createDispatcher> | null>(null);
  if (!dispatcherRef.current) dispatcherRef.current = createDispatcher();

  // This view's overlay-aware state. The scene half comes from the surface —
  // same adapter, same tools — but everything gesture-shaped is read off this
  // view's own dispatcher, which is where a gesture inside this view lands.
  const inputs = useOptionalViewInputs();
  const own = useMemo(() => ({
    gestureSource: createGestureSource(() => dispatcherRef.current),
    ...createDispatcherPreviewSources(() => dispatcherRef.current),
  }), []);
  const selection = viewSelection ?? inputs?.selectionApi ?? ownSelection;
  live.current.selection = selection;

  const inputsRef = useRef(inputs);
  inputsRef.current = inputs;

  /** The chrome-caps context this view answers for: its selection, its camera,
   *  its dispatcher's in-flight action. */
  const ruleInputs = useCallback((): ViewRuleInputs => ({
    selection: live.current.selection.get(),
    view: camera(),
    action: dispatcherRef.current!.getActiveAction(),
  }), [camera]);

  const { helpers } = useViewHelpers<unknown>({
    ...(inputs ?? NO_INPUTS),
    ...own,
    selection: selection.current,
    getIsVisible: () =>
      inputsRef.current?.chromeCaps?.isVisible(ruleInputs()) ?? ALWAYS_VISIBLE,
  });
  const helpersRef = useRef(helpers);
  helpersRef.current = helpers;

  /** A client point in this view's world. The rect moves with the outer
   *  camera, so it is read per call rather than closed over. */
  const clientToWorldHere = useCallback((cx: number, cy: number): { x: number; y: number } => {
    const canvas = registry?.surface()?.origin() ?? { left: 0, top: 0 };
    const rect = rectNow();
    const [x, y] = clientToWorld(
      cx, cy,
      { left: canvas.left + rect.x, top: canvas.top + rect.y },
      camera(),
    );
    return { x, y };
  }, [registry, rectNow, camera]);

  const getAnchorState = useMemo(() => anchorStateFrom(() => depRegistryRef.current), []);

  const { targetScale } = useDeviceProfile();

  // Selection chrome hit-testing for this view: same construction the surface
  // does for its own, against this view's chrome and camera.
  const affordanceAt = useMemo(() => {
    const inner = buildAffordanceAt({
      getChromeState: () => helpersRef.current.getChromeState(),
      getView: camera,
      targetScale,
      getAnchorState,
      getIsVisible: () => helpersRef.current.getIsVisible(),
    });
    return (world: { x: number; y: number }) => {
      // A registered layer this view paints gets first refusal, on this
      // view's frame and envelope. One painted over the surface already had
      // its chance: it occludes the view before routing reaches here.
      const rect = rectNow();
      const surface = registry?.surface();
      const extra = surface?.hitTestExtras(
        world.x, world.y, camera(), { width: rect.w, height: rect.h },
        helpersRef.current, drawnLayers(),
      );
      if (extra) {
        const claim = extra.hit;
        return {
          kind: `layer:${extra.layerId}`,
          owner: extra.layerId,
          strength: claim.strength ?? 'shared',
          ...(claim.claimedKinds !== undefined ? { claimedKinds: claim.claimedKinds } : {}),
          ...(claim.cursor !== undefined ? { cursor: claim.cursor } : {}),
          ...(claim.initialScratch !== undefined ? { payload: claim.initialScratch } : {}),
        };
      }
      return inner(world);
    };
  }, [getAnchorState, rectNow, registry, targetScale, camera, drawnLayers]);

  const classifyTarget = useMemo(() => {
    const inner = buildClassifyTarget(
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
    );
    return (world: { x: number; y: number }) => inner(world);
  }, [camera, layerIsPainted]);

  const registration = useMemo<ViewRegistration>(() => ({
    id,
    order,
    interactive,
    paint,
    layer: createViewportLayer<unknown, unknown>({
      id,
      label: label ?? id,
      source: drawnLayers,
      view: cameraAt,
      bounds: (outer, dims) => rectAt(outer, dims),
      // The surface half of the envelope passes through; the view half is
      // this view's, so its layers paint its chrome rather than the
      // surface's.
      data: (outer) => ({ ...(outer as object), ...helpersRef.current }),
      ...(background !== undefined ? { background } : {}),
    }),
    layerIsPainted,
    target: {
      dispatcher: dispatcherRef.current!,
      affordanceAt,
      classifyTarget,
      clientToWorld: clientToWorldHere,
      deps: () => ({
        view: viewApi,
        ingestion: ingestionApi,
        // An Escape here cancels what is in flight here.
        dispatcher: { cancelAll: (reason) => dispatcherRef.current!.cancelAll(reason) },
        // Only a view with its own selection overlays that one; otherwise the
        // surface's answer stands, wrappers (`selectionMode`) included.
        ...(live.current.viewSelection ? { selection: live.current.viewSelection } : {}),
      }),
      // Action eligibility is chrome-caps evaluated against this view, so a
      // rule that hides an action in one panel cannot decline a gesture in
      // another.
      getRuleCtx: () => inputsRef.current?.chromeCaps?.ruleCtx(ruleInputs()),
    },
  }), [id, order, interactive, paint, label, background, rectAt, cameraAt, viewApi,
       affordanceAt, classifyTarget, clientToWorldHere, ruleInputs, ingestionApi, drawnLayers,
       layerIsPainted]);

  useEffect(() => {
    if (!registry) return;
    return registry.register(registration);
  }, [registry, registration]);

  // A camera change is invisible until the surface repaints, and nothing else
  // observes this component's state.
  useEffect(() => {
    registry?.surface()?.requestRedraw();
  }, [registry, effectiveView]);

  return null;
}
