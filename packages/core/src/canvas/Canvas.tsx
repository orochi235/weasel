/**
 * Low-level WebGL surface + viewport primitive. Composes layers into a single GL render pass,
 * applies a view transform, and delivers hover to the layers that ask for it. It routes no
 * gesture: `<SceneCanvas>` mounts the gesture dispatcher on this same element. Canvas owns NO
 * scene-shaped state — selection, picking, kind registry, scene-aware overlays all live in
 * `<SceneCanvas>`, which wraps it.
 *
 * The `layers` prop is a map keyed by slot name, every slot already a layer. Standard slots
 * render at a canonical position; custom entries (any other key, value carrying `.layer`) insert
 * at `after`/`before` an existing slot, defaulting to the top.
 *
 * @internal
 * @deprecated Bare `<Canvas>` is not a supported consumer surface.
 *   Use `<SceneCanvas>` instead.
 */

import { forwardRef, useCallback, useEffect, useImperativeHandle, useInsertionEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type React from 'react';
import { composeOrderedLayers, placeToolOverlays } from './layerOrder';
import { STANDARD_SLOTS, isCustomEntry } from './layerSlots';
import type { CanvasExtensionApi } from './canvasExtension';
import { registerMountedCanvas } from './mountedCanvases';
import { useViewHelpers } from './useViewHelpers';
import { useSurfaceInput } from './useSurfaceInput';
import { useOptionalViewRegistry } from './viewRegistry';
import { useCanvasSurface } from './useCanvasSurface';
import type { CanvasHelpers, CanvasSurfaceHelpers } from './useViewHelpers';
import type { CanvasProps } from './canvasProps';

import { useLatest } from '@weasel-js/react';
import type { View } from 'core/viewport/view';
import { clientToWorld as clientToWorldHelper } from 'core/viewport/clientToWorld';
import {
  drawLayers, isLayerPainted,
  type Dims, type LayerCommandCache, type RenderLayer,
} from 'core/layers/render';
import { viewToMat3 } from '@weasel-js/renderer';
import { createBackgroundFillLayer } from 'core/layers/backgroundFill';
import { SurfaceCanvas } from './SurfaceCanvas';
import {
  type SelectionApi,
} from 'core/selection/useSelection';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { beginDebugFrame, useDebugSink } from '../debug/useDebugSink';

const alwaysVisible = (_id: string): boolean => true;
import { createCursorSink, createPaintedCursorState } from '@weasel-js/cursor';
import type { PaintedCursorState } from '@weasel-js/cursor';
import { useToolCursor } from './useToolCursor';
import { createPaintedCursorLayer } from './paintedCursorLayer';

export type { CanvasProps } from './canvasProps';


const NO_SELECTION: SelectionApi['current'] = [];

const NO_LAYER_VISIBILITY: Record<string, boolean> = {};

function CanvasInner<TPose>(
  props: CanvasProps<TPose>,
  ref: React.ForwardedRef<CanvasExtensionApi>,
) {
  const {
    width,
    height,
    dpr: dprProp,
    flattenTolerance,
    contentVersion,
    syncPaint = false,
    redrawOn,
    adapter, nodes,
    layers: layersMap,
    selection,
    boundsOf, boundsOfPose,
    clientToWorld,
    paintInto,
    inputElement,
    poseDescriptor: geometry = AUTO_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>,
    className,
    style,
    tabIndex = 0,
    onFocus,
    onBlur,
    autoFocusOnPointerDown = true,
    helpersRef,
    tools,
    viewState,
    debug: debugProp,
    debugSinkRef,
    shaders,
    previewPoseExtra,
    gestureSource,
    backgroundFill,
    decorationLayer,
    getIsVisible,
    layerVisibility,
    layerOrder,
    layerGroups,
  } = props;

  const { sink: debugSink, overlay: debugOverlay, frameStats, getDebug } = useDebugSink(debugProp);

  // The element input comes from and every client→world conversion measures: the `<canvas>`
  // this component renders, or under `paintInto` the caller's `inputElement`.
  const canvasRef = useRef<HTMLElement | null>(null);
  // The `<canvas>` this component rendered, if it rendered one. `paint` is the
  // only thing that needs a real canvas, for `getContext`.
  const ownCanvasRef = useRef<HTMLCanvasElement | null>(null);
  // Stable, so a commit does not detach the element: an inline ref is nulled
  // until the layout phase reaches it, and a sync paint asked for before that
  // finds no canvas.
  const setOwnCanvas = useCallback((el: HTMLCanvasElement | null) => {
    ownCanvasRef.current = el;
    canvasRef.current = el;
  }, []);
  const detached = !!paintInto;
  // The detached input element reaches `canvasRef` at commit; the own canvas
  // arrives through `setOwnCanvas`, React's ref callback.
  useInsertionEffect(() => {
    if (detached) canvasRef.current = inputElement ?? null;
  });
  // Where pixels go. Split from `canvasRef` only when detached.
  const paintTarget = detached ? (paintInto.canvas ?? null) : null;
  const paintTargetRef = useLatest(paintTarget);
  const paintRect = detached ? { x: paintInto.x, y: paintInto.y } : null;
  const paintRectRef = useLatest(paintRect);

  // Read by `hitTestExtras`, which is built once and must see live values.
  const helpersForLayersRef = useRef<CanvasHelpers<TPose> | null>(null);
  const dimsRef = useLatest({ width, height });
  // Which layers reach the screen, and which chrome within them: asked by the
  // paint and by every hit-test.
  const gateRef = useLatest({ getIsVisible, layerVisibility, layerOrder });

  // The frame loop paints; a committed render only marks the surface dirty, so
  // no prop can reach the paint without repainting it. The thunk defers to
  // `paint` below, which needs inputs this render has not computed yet.
  const paintRef = useRef<() => boolean>(() => false);
  const { lease, requestRedraw, subscribeFrame, subscribeBeforePaint, subscribeResume } = useCanvasSurface(
    useCallback(() => paintRef.current(), []),
    { syncPaint, target: canvasRef, dpr: dprProp, redrawOn, shaders, onCommit: 'redraw' },
  );

  const contentVersionRef = useLatest(contentVersion);
  const paintedVersionRef = useRef(0);
  const getPaintedVersion = useCallback(() => paintedVersionRef.current, []);

  // The `layersWithDebug` memo reads `extrasRef.current`, so registration has
  // to bump state to re-run it. Rare (a HUD attaching, a loupe mounting).
  const [extrasVersion, setExtrasVersion] = useState(0);
  const extrasRef = useRef<Set<RenderLayer<unknown>>>(new Set());
  const registerLayer = useCallback((layer: RenderLayer<unknown>) => {
    extrasRef.current.add(layer);
    setExtrasVersion(n => n + 1);
    return () => {
      extrasRef.current.delete(layer);
      setExtrasVersion(n => n + 1);
    };
  }, []);

  // Hit-test registered layers topmost-first: registration order is draw order, so the
  // last-registered layer gets first refusal. `<SceneCanvas>` folds this into its
  // `affordanceAt` thunk; Canvas has the layers but not the dispatcher.
  const hitTestExtrasIn = useCallback((
    worldX: number,
    worldY: number,
    view: View,
    dims: Dims,
    data: unknown,
    only?: readonly RenderLayer<unknown>[],
  ) => {
    const layers = [...extrasRef.current].reverse();
    const gate = gateRef.current;
    const isVisible = gate.getIsVisible?.() ?? alwaysVisible;
    const visibility = gate.layerVisibility ?? NO_LAYER_VISIBILITY;
    const order = gate.layerOrder;
    for (const layer of layers) {
      if (!layer.hitTest) continue;
      if (only && !only.includes(layer)) continue;
      if (!isLayerPainted(layer, visibility, order)) continue;
      const hit = layer.hitTest(worldX, worldY, data, view, dims, isVisible);
      if (hit) return { layerId: layer.id, hit };
    }
    return null;
  }, [gateRef]);

  const {
    viewRef, setView, getView, subscribeView,
    adoptControlled, announceControlled, clearSubscribers,
  } = viewState;

  const hitTestExtras = useCallback((
    worldX: number,
    worldY: number,
    frame?: { view: View; dims: Dims },
  ) => hitTestExtrasIn(
    worldX,
    worldY,
    frame?.view ?? viewRef.current,
    frame?.dims ?? dimsRef.current,
    helpersForLayersRef.current,
  ), [hitTestExtrasIn, dimsRef, viewRef]);

  // The one client→world conversion: hover, the view registry and both
  // handles answer with it, so a `clientToWorld` override reaches all of them
  // or none.
  const clientToWorldRef = useLatest(clientToWorld);
  const toWorld = useCallback((clientX: number, clientY: number): [number, number] => {
    const el = canvasRef.current;
    if (!el) return [clientX, clientY];
    const override = clientToWorldRef.current;
    if (override) return override(el, clientX, clientY);
    return clientToWorldHelper(clientX, clientY, el.getBoundingClientRect(), viewRef.current);
  }, [clientToWorldRef, viewRef]);

  useLayoutEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    return registerMountedCanvas({ element, getView });
  }, [detached, inputElement, getView]);

  // The painted tier's channel. `<Canvas>` owns it because it owns both ends:
  // the tool cursor that feeds it and the frame loop that has to repaint when
  // it changes. The hover pump reaches it through the ref handle below.
  const paintedCursor = useMemo<PaintedCursorState>(() => createPaintedCursorState(), []);
  const paintedCursorLayer = useMemo(
    () => createPaintedCursorLayer(paintedCursor),
    [paintedCursor],
  );
  // An idle pointermove repaints nothing on its own, so a cursor the compositor
  // is not drawing needs its own pump. The store stays quiet unless something
  // painted is actually on screen.
  useEffect(() => paintedCursor.subscribe(() => { requestRedraw(); }), [paintedCursor, requestRedraw]);
  // The one writer of the input element's `cursor` style: the tool's cursor
  // from here, a hover cursor from the pump, which reaches it through the handle.
  const cursorSink = useMemo(
    () => createCursorSink({ element: () => canvasRef.current, painted: () => paintedCursor }),
    [paintedCursor],
  );

  const getSurfaceRect = useCallback(() => {
    const origin = paintRectRef.current;
    const { width: w, height: h } = dimsRef.current;
    return { x: origin?.x ?? 0, y: origin?.y ?? 0, width: w, height: h };
  }, [dimsRef, paintRectRef]);

  useImperativeHandle(ref, () => ({
    // Named rather than read off `canvasRef` so the handle rebuilds when a
    // detached surface's input element arrives, which is a render later.
    element: detached ? inputElement ?? null : canvasRef.current,
    surface: detached ? paintInto?.canvas ?? null : ownCanvasRef.current,
    getSurfaceRect,
    clientToWorld: toWorld,
    requestRedraw,
    subscribeFrame,
    subscribeBeforePaint,
    subscribeResume,
    registerLayer,
    hitTestExtras,
    getView,
    setView,
    subscribeView,
    getPaintedVersion,
    paintedCursor,
    cursorSink,
    getDebug,
  }), [canvasRef, ownCanvasRef, detached, inputElement, paintInto?.canvas,
       getSurfaceRect, toWorld, requestRedraw, subscribeFrame, subscribeBeforePaint, subscribeResume,
       registerLayer,
       hitTestExtras, getView, setView, subscribeView, getPaintedVersion,
       paintedCursor, cursorSink, getDebug]);

  const layerCacheRef = useRef<LayerCommandCache>(new Map());

  // Views registered on this surface — declared as `views` descriptors or
  // mounted as `<CanvasView>` children. Null outside a surface that mounts a
  // registry, which is the single-view case.
  const viewRegistry = useOptionalViewRegistry();

  const selectedIdsForWiring = selection?.current ?? NO_SELECTION;

  // One view's overlay-aware state. A hook, so N views are N components each
  // calling it once — not a loop in this body.
  const { helpers: viewHelpers } = useViewHelpers<TPose>({
    adapter, geometry, boundsOf, boundsOfPose, nodes,
    getScale: () => viewRef.current.scale,
    selection: selectedIdsForWiring,
    gestureSource,
    previewPoseExtra,
    getIsVisible: () => gateRef.current.getIsVisible?.() ?? alwaysVisible,
  });

  const surfaceHelpers: CanvasSurfaceHelpers = {
    getDebug: () => debugSink,
  };
  const helpersForLayers: CanvasHelpers<TPose> = { ...viewHelpers, ...surfaceHelpers, viewId: null };

  const backgroundLayer = useMemo(
    () => (backgroundFill ? createBackgroundFillLayer(backgroundFill) : undefined),
    [backgroundFill],
  );

  const layers = useMemo<RenderLayer<unknown>[]>(() => {
    const standardLayers: Partial<
      Record<(typeof STANDARD_SLOTS)[number], RenderLayer<unknown>>
    > = {};
    for (const slot of ['grid', 'cellHighlight', 'selectionOverlay'] as const) {
      const entry = layersMap[slot];
      if (isCustomEntry(entry)) standardLayers[slot] = entry.layer;
    }
    const out: RenderLayer<unknown>[] = composeOrderedLayers(
      decorationLayer ? { ...layersMap, decorationLayer: { layer: decorationLayer } } : layersMap,
      standardLayers, layersMap.scene?.layers, backgroundLayer,
    );
    if (tools) {
      placeToolOverlays(out, standardLayers.selectionOverlay, tools.getActiveOverlays);
    }
    return out;
  }, [layersMap, tools, backgroundLayer, decorationLayer]);

  const viewRegistryVersion = useSyncExternalStore(
    useCallback((cb: () => void) => viewRegistry?.subscribe(cb) ?? (() => {}), [viewRegistry]),
    () => viewRegistry?.getVersion() ?? 0,
    () => 0,
  );

  // The stack a view paints through its own camera is this canvas's, before
  // the views themselves are folded in — otherwise a view would contain
  // itself. Published by reference and read at draw time.
  const surfaceLayersRef = useLatest<readonly RenderLayer<unknown>[]>(layers);
  useEffect(() => {
    return viewRegistry?.attachSurface({
      view: () => viewRef.current,
      dims: () => dimsRef.current,
      layers: () => surfaceLayersRef.current,
      requestRedraw,
      chromeState: () => helpersForLayersRef.current!.getChromeState(),
      hitTestExtras: hitTestExtrasIn,
      clientToWorld: toWorld,
      claimsAbove: (x, y) => {
        const view = viewRef.current;
        const worldX = x / view.scale.x + view.x;
        const worldY = y / view.scale.y + view.y;
        return hitTestExtrasIn(worldX, worldY, view, dimsRef.current, helpersForLayersRef.current) !== null;
      },
    });
  }, [viewRegistry, canvasRef, requestRedraw, hitTestExtrasIn, dimsRef, surfaceLayersRef, viewRef, toWorld]);

  const layersWithDebug = useMemo(() => {
    // Views paint through the surface's own stack, so they sit above it and
    // below both the debug overlay and externally-registered layers.
    const withViews = viewRegistry
      ? [...layers, ...viewRegistry.list().filter((r) => r.paint).map((r) => r.layer as RenderLayer<unknown>)]
      : layers;
    const base = debugOverlay ? [...withViews, debugOverlay] : withViews;
    // The cursor goes last: it is the one thing that is always in front of
    // everything, including a consumer's own registered layers.
    return [...base, ...extrasRef.current, paintedCursorLayer];
    // extrasVersion drives re-reads of extrasRef when layers are registered/detached;
    // viewRegistryVersion does the same for registered views.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers, debugOverlay, extrasVersion, viewRegistry, viewRegistryVersion,
      paintedCursorLayer]);

  useEffect(() => {
    const redraw = (): void => { requestRedraw(); };
    const offs: (() => void)[] = [];
    for (const layer of layersWithDebug) if (layer.subscribe) offs.push(layer.subscribe(redraw));
    return () => { for (const off of offs) off(); };
  }, [layersWithDebug, requestRedraw]);

  // Everything the paint, hit-testing and the view registry read that a React
  // render owns. `useLatest` and the insertion effect below publish committed
  // renders only, ahead of every layout effect in the commit, any of which may
  // ask for a sync paint.
  const paintInputs = {
    layers: layersWithDebug, width, height, debugSink, frameStats,
    dpr: dprProp, layerGroups, shaders,
    flattenTolerance,
  };
  const paintInputsRef = useLatest(paintInputs);
  useInsertionEffect(() => {
    adoptControlled();
    helpersForLayersRef.current = helpersForLayers;
    if (helpersRef) helpersRef.current = helpersForLayers;
    if (debugSinkRef) debugSinkRef.current = debugSink;
  });
  useLayoutEffect(() => {
    announceControlled();
  });

  const paint = useCallback((): boolean => {
    const c = paintTargetRef.current ?? ownCanvasRef.current;
    if (!c) return false;
    const rect = paintRectRef.current;
    const {
      layers: paintLayers, width: w, height: h, debugSink: sink, frameStats: timed,
      dpr: dprIn,
      flattenTolerance: paintFlattenTolerance,
      layerGroups: groups, shaders: paintShaders,
    } = paintInputsRef.current;

    const debugFrame = beginDebugFrame(sink, timed, paintLayers);

    const renderer = lease.bind(c, { width: w, height: h, dpr: dprIn }, {
      tile: rect,
      flattenTolerance: paintFlattenTolerance,
      shaders: paintShaders,
    });
    // No WebGL2 (jsdom), or a context that is lost for now: nothing to paint.
    if (!renderer) return false;

    const view = viewRef.current;
    const { layerVisibility: vis, layerOrder: order } = gateRef.current;
    const spans = debugFrame?.time();
    const commands = drawLayers(
      paintLayers,
      helpersForLayersRef.current,
      vis ?? NO_LAYER_VISIBILITY,
      order,
      view,
      { width: w, height: h },
      layerCacheRef.current,
      undefined,
      groups,
      spans,
    );
    renderer.render(commands, viewToMat3(view), spans ? { spans } : undefined);
    debugFrame?.end(renderer.lastFrameStats());
    paintedVersionRef.current = contentVersionRef.current?.() ?? 0;
    return true;
  }, [contentVersionRef, gateRef, lease, paintInputsRef, paintRectRef, paintTargetRef, viewRef]);
  useInsertionEffect(() => {
    paintRef.current = paint;
  });

  useEffect(() => {
    const layerCache = layerCacheRef.current;
    return () => {
      layerCache.clear();
      clearSubscribers();
    };
  }, [clearSubscribers]);

  useToolCursor(cursorSink, tools, detached ? inputElement : null, style?.cursor);

  useSurfaceInput(canvasRef, {
    focusOnPress: autoFocusOnPointerDown,
    onFocus,
    onBlur,
    onHover: (_el, e) => {
      const view = viewRef.current;
      const [worldX, worldY] = toWorld(e.clientX, e.clientY);
      const visibility = layerVisibility ?? NO_LAYER_VISIBILITY;
      // Same gate as `hitTestExtrasIn`: a layer nobody can see takes no input.
      for (const layer of layersWithDebug) {
        if (!layer.onUncapturedMove || !isLayerPainted(layer, visibility, layerOrder)) continue;
        layer.onUncapturedMove(worldX, worldY, e, view, { width, height });
      }
    },
    onLeave: () => {
      for (const layer of layersWithDebug) layer.onUncapturedLeave?.();
    },
  });

  if (detached) return null;

  return (
    <SurfaceCanvas
      ref={setOwnCanvas}
      width={width}
      height={height}
      tabIndex={tabIndex}
      className={className} style={style}
    />
  );
}

/** Forward-ref'd `<canvas>` wrapper. Generic over the pose type, inferred from the
 *  `adapter` prop. */
export const Canvas = forwardRef(CanvasInner) as <TPose = unknown>(
  props: CanvasProps<TPose> & { ref?: React.ForwardedRef<CanvasExtensionApi> },
) => ReturnType<typeof CanvasInner>;

