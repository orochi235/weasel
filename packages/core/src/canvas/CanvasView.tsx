/**
 * `<CanvasView>` — a second view on an existing canvas: its own camera over a
 * rect of the surface, with input routed to it.
 *
 * Mount one inside `<SceneCanvas>`, or declare the same thing through the
 * surface's `views` prop, which renders one of these per descriptor.
 */
import {
  useCallback, useEffect, useImperativeHandle, useInsertionEffect, useLayoutEffect, useMemo,
} from 'react';
import type { Dims, RenderLayer } from 'core/layers/render';
import type { View } from 'core/viewport/view';
import { createViewportLayer } from 'domains/viewports/viewportLayer';
import { NO_SELECTION } from 'core/selection/viewerSelection';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import type { PoseDescriptor } from 'core/geometry/poseDescriptor';
import { useViewHelpers } from './useViewHelpers';
import { useViewAim } from './useViewAim';
import { hitAtOf } from './deps/dispatchSources';
import { useViewPicking } from './useViewPicking';
import { useViewOwnDeps } from './useViewOwnDeps';
import { useViewDispatcher } from './useViewDispatcher';
import { useOptionalDepRegistry } from '@weasel-js/routing/react';
import { useLatest } from '@weasel-js/react';
import { useOptionalViewInputs, type SurfaceViewInputs } from './viewInputs';
import type { CanvasViewProps, ViewRect } from './canvasViewProps';
export type { CanvasViewProps, ViewRect } from './canvasViewProps';
import { NO_RECT, useViewNesting } from './useViewNesting';
import { useViewClientMaps } from './useViewClientMaps';
import {
  useOptionalViewRegistry,
  IDENTITY_VIEW,
  UNMEASURED_DIMS,
  type ViewRegistration,
  type ViewRegistry,
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


/** The surface's bounds resolvers, asked for this view's camera. */
function useCameraBounds(inputs: SurfaceViewInputs | null, camera: () => View) {
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
  return { boundsOf, boundsOfPose };
}

/** The viewport node that paints a view: what it draws, through its camera, in its rect. */
function viewLayer({
  id, label, parent, background, registry, drawnLayers, cameraAt, rectAt, frameIn, helpersRef,
}: {
  id: string;
  label: string | undefined;
  parent: string | undefined;
  background: CanvasViewProps['background'];
  registry: ViewRegistry | null;
  drawnLayers: () => readonly RenderLayer<unknown>[];
  cameraAt: (outer: View, dims: Dims) => View;
  rectAt: (outer: View, dims: Dims) => ViewRect;
  frameIn: (outer: View, dims: Dims) => { clip?: ViewRect } | null;
  helpersRef: { readonly current: object };
}) {
  return createViewportLayer<unknown, unknown>({
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
  });
}

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
    id, parent, follows, bounds,
    layers = ALL_LAYERS, layerVisibility, layerOrder, background, order = Infinity, label, cameraRef,
    interactive = true, paint = true, deps,
  } = props;

  const registry = useOptionalViewRegistry();
  const depRegistry = useOptionalDepRegistry();
  const depRegistryRef = useLatest(depRegistry);

  // A view acts on its surface's session; one outside a surface has no selection.
  const inputs = useOptionalViewInputs();
  const shared = inputs?.selectionApi ?? NO_SELECTION;

  // Everything the registration reads is behind a ref: the registration object
  // is registered once and must not churn, but what it answers with has to be
  // the last committed render's.
  const live = useLatest({
    parent, follows, bounds, layers, layerVisibility, layerOrder, shared, deps,
  });

  const {
    frameIn, rectAt, derivedAt, drawnLayers, layerIsPainted, selectionNow,
  } = useViewNesting(registry, live);

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

  const { viewApi, ingestionApi } = useViewOwnDeps(camera, setViewFromInput, rectNow, layerIsPainted, depRegistryRef);

  const { dispatcher, own, ruleInputs } = useViewDispatcher(selectionNow, camera);
  const inputsRef = useLatest(inputs);
  const { boundsOf, boundsOfPose } = useCameraBounds(inputs, camera);

  const { helpers } = useViewHelpers<unknown>({
    ...(inputs ?? NO_INPUTS),
    boundsOf,
    boundsOfPose,
    ...own,
    selection: () => selectionNow().current,
    layerIsPainted,
    getIsVisible: () => inputsRef.current?.chromeCaps?.isVisible(ruleInputs()) ?? ALWAYS_VISIBLE,
  });
  const helpersRef = useLatest(helpers);

  const { toWorld: clientToWorldHere, toLocal: clientToLocalHere } = useViewClientMaps(registry, rectNow, camera);

  const { affordanceAt, classifyTarget } = useViewPicking({
    id, registry, inputs, camera, rectNow, drawnLayers, layerIsPainted, selectionNow, helpersRef, depRegistryRef,
  });

  const registration = useMemo<ViewRegistration>(() => ({
    id,
    ...(parent !== undefined ? { parent } : {}),
    order,
    interactive,
    paint,
    held,
    aim,
    setAim,
    layer: viewLayer({
      id, label, parent, background, registry, drawnLayers, cameraAt, rectAt, frameIn, helpersRef,
    }),
    layerIsPainted,
    drawnLayers,
    target: {
      dispatcher,
      affordanceAt,
      classifyTarget,
      clientToWorld: clientToWorldHere,
      clientToLocal: clientToLocalHere,
      deps: () => ({
        ...live.current.deps, view: viewApi, ingestion: ingestionApi, hitAt: hitAtOf(classifyTarget),
        // An Escape here cancels what is in flight here.
        dispatcher: { cancelAll: (reason) => dispatcher.cancelAll(reason) },
      }),
      // Action eligibility is chrome-caps evaluated against this view, so a
      // rule that hides an action in one panel cannot decline a gesture in
      // another.
      getRuleCtx: () => inputsRef.current?.chromeCaps?.ruleCtx(ruleInputs()),
    },
  }), [id, parent, order, interactive, paint, held, aim, setAim, label, background, rectAt, cameraAt, viewApi,
       affordanceAt, classifyTarget, clientToWorldHere, clientToLocalHere, ruleInputs, ingestionApi, drawnLayers,
       layerIsPainted, inputsRef, helpersRef, frameIn, registry, live, dispatcher]);

  useEffect(() => {
    if (!registry) return;
    return registry.register(registration);
  }, [registry, registration]);

  // Apart from the registration, which is replaced whenever a prop it reads
  // changes: only the view going away ends what is in flight over it.
  useEffect(() => () => dispatcher.cancelAll('cancel'), [dispatcher]);

  // The surface paints this view from `live`, so any committed render of it —
  // a controlled camera, its bounds, its layer gate — needs a frame.
  useEffect(() => {
    registry?.surface()?.requestRedraw();
  });

  return null;
}
