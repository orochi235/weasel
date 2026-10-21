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

import { forwardRef, useCallback, useEffect, useInsertionEffect, useLayoutEffect, useRef } from 'react';
import type React from 'react';
import type { CanvasExtensionApi } from './canvasExtension';
import { registerMountedCanvas } from './mountedCanvases';
import { useViewHelpers } from './useViewHelpers';
import { useViewLayerGate } from './useViewLayerGate';
import { useSurfaceInput } from './useSurfaceInput';
import { useOptionalViewRegistry } from './viewRegistry';
import { useCanvasSurface } from './useCanvasSurface';
import type { CanvasHelpers } from './useViewHelpers';
import type { CanvasProps } from './canvasProps';
import { useLatest } from '@weasel-js/react';
import { SurfaceCanvas } from './SurfaceCanvas';
import { useSurfaceSize } from './useSurfaceSize';
import type { SelectionApi } from 'core/selection/useSelection';
import { AUTO_POSE_DESCRIPTOR } from 'core/geometry/autoPoseDescriptor';
import type { PoseDescriptor } from 'interactions/actions/resize/geometry';
import { useDebugSink } from '../debug/useDebugSink';
import { useToolCursor } from './useToolCursor';
import { useCanvasElements } from './useCanvasElements';
import { alwaysVisible, useExtraLayers } from './useExtraLayers';
import { usePaintedCursor } from './usePaintedCursor';
import { useCanvasHandle } from './useCanvasHandle';
import { useComposedLayers, useSlotLayers } from './useLayerStack';
import { useViewRegistrySurface } from './useViewRegistrySurface';
import { useCanvasPaint, usePaintedVersion } from './useCanvasPaint';
import { layerHover } from './layerHover';
import { useClientToWorld } from './useClientToWorld';

export type { CanvasProps, CanvasRetainOptions } from './canvasProps';

const NO_SELECTION: SelectionApi['current'] = [];

function CanvasInner<TPose>(
  props: CanvasProps<TPose>,
  ref: React.ForwardedRef<CanvasExtensionApi>,
) {
  const {
    paintInto, inputElement, tools, viewState, style, getIsVisible, layerVisibility, layerOrder,
    helpersRef, debugSinkRef,
    poseDescriptor: geometry = AUTO_POSE_DESCRIPTOR as unknown as PoseDescriptor<TPose>,
  } = props;

  const { sink: debugSink, overlay: debugOverlay, frameStats, getDebug } = useDebugSink(props.debug);
  const elements = useCanvasElements(paintInto, inputElement);
  const { canvasRef, ownCanvasRef, detached } = elements;
  const { width, height } = useSurfaceSize(props, ownCanvasRef);

  // Read by `hitTestExtras`, which is built once and must see live values.
  const helpersForLayersRef = useRef<CanvasHelpers<TPose> | null>(null);
  const dimsRef = useLatest({ width, height });
  // Which layers reach the screen, and which chrome within them: asked by the
  // paint and by every hit-test.
  const gateRef = useLatest({ getIsVisible, layerVisibility, layerOrder });

  // The frame loop paints; a committed render only marks the surface dirty, so
  // no prop can reach the paint without repainting it. The thunk defers to
  // `useCanvasPaint` below, which needs inputs this render has not computed yet.
  const paintRef = useRef<() => boolean>(() => false);
  const { lease, requestRedraw, subscribeFrame, subscribeBeforePaint, subscribeResume } = useCanvasSurface(
    useCallback(() => paintRef.current(), []),
    { syncPaint: props.syncPaint ?? false, target: canvasRef, dpr: props.dpr, redrawOn: props.redrawOn, shaders: props.shaders, onCommit: 'redraw' },
  );
  const { getPaintedVersion, markPainted } = usePaintedVersion(props.contentVersion);
  const { extrasRef, extrasVersion, registerLayer, hitTestExtrasIn } = useExtraLayers(gateRef);

  const {
    viewRef, setView, getView, subscribeView,
    adoptControlled, announceControlled, clearSubscribers,
  } = viewState;

  const toWorld = useClientToWorld(canvasRef, props.clientToWorld, viewRef);

  useLayoutEffect(() => {
    const element = canvasRef.current;
    if (!element) return;
    return registerMountedCanvas({ element, getView });
  }, [canvasRef, detached, inputElement, getView]);

  const { paintedCursor, paintedCursorLayer, cursorSink } = usePaintedCursor(canvasRef, requestRedraw);

  const frame = { viewRef, dimsRef, helpersRef: helpersForLayersRef };
  useCanvasHandle(ref, { ...elements, inputElement, paintCanvas: paintInto?.canvas }, frame, {
    hitTestExtrasIn, clientToWorld: toWorld, requestRedraw, subscribeFrame, subscribeBeforePaint,
    subscribeResume, registerLayer, getView, setView, subscribeView,
    getPaintedVersion, paintedCursor, cursorSink, getDebug,
  });

  const viewRegistry = useOptionalViewRegistry();

  // One view's overlay-aware state. A hook, so N views are N components each
  // calling it once — not a loop in this body.
  const layers = useSlotLayers(props.layers, tools, props.backgroundFill, props.decorationLayer);
  const { helpers: viewHelpers } = useViewHelpers<TPose>({
    adapter: props.adapter, geometry, boundsOf: props.boundsOf, boundsOfPose: props.boundsOfPose,
    nodes: props.nodes, gestureSource: props.gestureSource, previewPoseExtra: props.previewPoseExtra,
    getScale: () => viewRef.current.scale,
    selection: props.selection?.current ?? NO_SELECTION,
    getIsVisible: () => gateRef.current.getIsVisible?.() ?? alwaysVisible,
    layerIsPainted: useViewLayerGate(layerVisibility, layerOrder, () => layers),
  });
  const helpersForLayers: CanvasHelpers<TPose> = { ...viewHelpers, getDebug: () => debugSink, viewId: null };

  useViewRegistrySurface(viewRegistry, layers, frame, { requestRedraw, hitTestExtrasIn, clientToWorld: toWorld });
  const layersWithDebug = useComposedLayers(layers, {
    viewRegistry, debugOverlay, extrasRef, extrasVersion, cursorLayer: paintedCursorLayer,
  }, requestRedraw);

  // Everything the paint, hit-testing and the view registry read that a React
  // render owns. `useLatest` and the insertion effect below publish committed
  // renders only, ahead of every layout effect in the commit, any of which may
  // ask for a sync paint.
  const paintInputsRef = useLatest({
    layers: layersWithDebug, width, height, debugSink, frameStats,
    dpr: props.dpr, layerGroups: props.layerGroups, shaders: props.shaders,
    flattenTolerance: props.flattenTolerance, retain: props.retain, imageMinification: props.imageMinification,
  });
  useInsertionEffect(() => {
    adoptControlled();
    helpersForLayersRef.current = helpersForLayers;
    if (helpersRef) helpersRef.current = helpersForLayers;
    if (debugSinkRef) debugSinkRef.current = debugSink;
  });
  useLayoutEffect(() => {
    announceControlled();
  });

  useCanvasPaint(paintRef, lease, elements, { ...frame, inputsRef: paintInputsRef, gateRef }, markPainted);
  useEffect(() => clearSubscribers, [clearSubscribers]);

  useToolCursor(cursorSink, tools, detached ? inputElement : null, style?.cursor);

  useSurfaceInput(canvasRef, {
    focusOnPress: props.autoFocusOnPointerDown ?? true,
    onFocus: props.onFocus,
    onBlur: props.onBlur,
    ...layerHover(layersWithDebug, {
      viewRef, toWorld, layerVisibility, layerOrder, dims: { width, height },
    }),
  });

  if (detached) return null;

  return (
    <SurfaceCanvas
      ref={elements.setOwnCanvas}
      width={props.width}
      height={props.height}
      tabIndex={props.tabIndex ?? 0} aria-label={props['aria-label']}
      className={props.className} style={style}
    />
  );
}

/** Forward-ref'd `<canvas>` wrapper. Generic over the pose type, inferred from the
 *  `adapter` prop. */
export const Canvas = forwardRef(CanvasInner) as <TPose = unknown>(
  props: CanvasProps<TPose> & { ref?: React.ForwardedRef<CanvasExtensionApi> },
) => ReturnType<typeof CanvasInner>;

