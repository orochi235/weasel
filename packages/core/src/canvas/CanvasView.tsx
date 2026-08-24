/**
 * `<CanvasView>` — a second view on an existing canvas: its own camera over a
 * rect of the surface, with input routed to it.
 *
 * Mount one inside `<SceneCanvas>`, or declare the same thing through the
 * surface's `views` prop, which renders one of these per descriptor.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Dims, RenderLayer } from 'core/layers/render';
import type { View } from 'core/viewport/view';
import { clientToWorld } from 'core/viewport/clientToWorld';
import { clampView } from 'core/viewport/clampView';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { createViewportLayer } from 'features/viewports/viewportLayer';
import { createDispatcher } from 'interactions/dispatcher/dispatcher';
import type { ViewApi } from 'interactions/actions/depSchema';
import { useSelection, type SelectionApi, type UseSelectionOptions } from 'core/selection/useSelection';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';
import type { PoseProjection } from 'interactions/actions/resize/geometry';
import { useViewHelpers } from './useViewHelpers';
import { anchorStateFrom, buildAffordanceAt, buildClassifyTarget } from './affordanceAt';
import { useOptionalDepRegistry } from 'interactions/actions/depRegistry';
import {
  createGestureSource,
  createDispatcherPreviewSources,
} from './SceneCanvas/dispatcherGestureBounds';
import { useOptionalViewInputs, type SurfaceViewInputs } from './viewInputs';
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
   *  seeded from `defaultView`. `onViewChange` fires either way. */
  view?: View;
  defaultView?: View;
  onViewChange?: (v: View) => void;
  /** Pan limits, applied to every camera change the same way `<Canvas>`
   *  applies its own. */
  viewBounds?: Bounds;
  /** Which of the surface's layers this view paints. Defaults to all of them —
   *  the same content through a second camera. */
  layers?: (surface: readonly RenderLayer<unknown>[]) => readonly RenderLayer<unknown>[];
  /** Opaque ground painted before the source layers, so the surface does not
   *  show through where the inner camera sees nothing. */
  background?: string;
  /** Paint and hit order. Defaults to `Infinity` — after every view the
   *  surface declared as a prop. */
  order?: number;
  /** Label for debug overlays. Defaults to the id. */
  label?: string;
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
  geometry: AUTO_POSE_DESCRIPTOR as unknown as PoseProjection<unknown>,
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
    layers = ALL_LAYERS, background, order = Infinity, label,
    selection: selectionProp, selectionOptions,
  } = props;

  const registry = useOptionalViewRegistry();
  const depRegistry = useOptionalDepRegistry();
  const depRegistryRef = useRef(depRegistry);
  depRegistryRef.current = depRegistry;

  // Hooks run unconditionally; the owned selection goes unused unless this
  // view asked for one.
  const ownSelection = useSelection(selectionOptions);
  const viewSelection = selectionProp ?? (selectionOptions ? ownSelection : undefined);

  const [internalView, setInternalView] = useState<View>(defaultView ?? IDENTITY_VIEW);
  const effectiveView = viewProp ?? internalView;

  // Everything the registration reads is behind a ref: the registration object
  // is registered once and must not churn, but what it answers with has to be
  // this render's.
  const live = useRef({
    view: effectiveView, bounds, layers, onViewChange, viewBounds, viewProp,
    viewSelection,
    // The selection this view acts on: its own when it has one, the
    // surface's otherwise. Filled in below, once the surface's is in hand.
    selection: viewSelection ?? ownSelection,
  });
  live.current = {
    ...live.current,
    view: effectiveView, bounds, layers, onViewChange, viewBounds, viewProp, viewSelection,
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

  const setView = useCallback((next: View) => {
    const { viewBounds: vb, onViewChange: cb, viewProp: controlled } = live.current;
    const rect = rectNow();
    const clamped = vb ? clampView(next, vb, { width: rect.w, height: rect.h }) : next;
    if (controlled === undefined) setInternalView(clamped);
    cb?.(clamped);
    registry?.surface()?.requestRedraw();
  }, [registry, rectNow]);

  const viewApi = useMemo<ViewApi>(() => ({
    get: () => live.current.view,
    set: setView,
    hostSize: () => {
      const rect = rectNow();
      return { width: rect.w, height: rect.h };
    },
  }), [rectNow, setView]);

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
  const { helpers } = useViewHelpers<unknown>({
    ...(inputs ?? NO_INPUTS),
    ...own,
    selection: selection.current,
  });
  const helpersRef = useRef(helpers);
  helpersRef.current = helpers;

  const inputsRef = useRef(inputs);
  inputsRef.current = inputs;

  /** A client point in this view's world. The rect moves with the outer
   *  camera, so it is read per call rather than closed over. */
  const clientToWorldHere = useCallback((cx: number, cy: number): { x: number; y: number } => {
    const canvas = registry?.surface()?.origin() ?? { left: 0, top: 0 };
    const rect = rectNow();
    const [x, y] = clientToWorld(
      cx, cy,
      { left: canvas.left + rect.x, top: canvas.top + rect.y },
      live.current.view,
    );
    return { x, y };
  }, [registry, rectNow]);

  const getAnchorState = useMemo(() => anchorStateFrom(() => depRegistryRef.current), []);

  // Selection chrome hit-testing for this view: same construction the surface
  // does for its own, against this view's chrome and camera.
  const affordanceAt = useMemo(() => {
    const inner = buildAffordanceAt({
      getChromeState: () => helpersRef.current.getChromeState(),
      getView: () => live.current.view,
      getAnchorState,
      getIsVisible: () => inputsRef.current?.getIsVisible?.() ?? ALWAYS_VISIBLE,
    });
    return (screenPoint: { x: number; y: number }) => {
      const world = clientToWorldHere(screenPoint.x, screenPoint.y);
      // Registered layers draw over the kit's chrome, so they get first
      // refusal — hit-tested against this view's frame and envelope, not the
      // canvas's.
      const rect = rectNow();
      const extra = registry?.surface()?.hitTestExtras(
        world.x, world.y, live.current.view, { width: rect.w, height: rect.h },
        helpersRef.current,
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
  }, [getAnchorState, clientToWorldHere, rectNow, registry]);

  const classifyTarget = useMemo(() => {
    const inner = buildClassifyTarget(
      () => live.current.selection.get(),
      (wx, wy) => {
        const i = inputsRef.current;
        if (i?.pickBest) return i.pickBest(wx, wy);
        const ids = i?.pickEvery?.(wx, wy) ?? [];
        return ids.length > 0 ? ids[ids.length - 1]! : null;
      },
      (id) => inputsRef.current?.kindOfNode?.(id),
    );
    return (screenPoint: { x: number; y: number }) =>
      inner(clientToWorldHere(screenPoint.x, screenPoint.y));
  }, [clientToWorldHere]);

  const registration = useMemo<ViewRegistration>(() => ({
    id,
    order,
    layer: createViewportLayer<unknown, unknown>({
      id,
      label: label ?? id,
      source: () => live.current.layers(registry?.surface()?.layers() ?? []),
      view: () => live.current.view,
      bounds: (outer, dims) => rectAt(outer, dims),
      // The surface half of the envelope passes through; the view half is
      // this view's, so its layers paint its chrome rather than the
      // surface's.
      data: (outer) => ({ ...(outer as object), ...helpersRef.current }),
      ...(background !== undefined ? { background } : {}),
    }),
    target: {
      dispatcher: dispatcherRef.current!,
      affordanceAt,
      classifyTarget,
      clientToWorld: clientToWorldHere,
      // Only a view with its own selection overlays the dep; otherwise the
      // surface's answer stands, wrappers (`selectionMode`) included.
      deps: () => (live.current.viewSelection
        ? { view: viewApi, selection: live.current.viewSelection }
        : { view: viewApi }),
    },
  }), [id, order, label, background, registry, rectAt, viewApi,
       affordanceAt, classifyTarget, clientToWorldHere]);

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
