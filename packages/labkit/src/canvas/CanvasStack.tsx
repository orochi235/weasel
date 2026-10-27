import type { Yoke } from '@weasel-js/core';
import { useLatest, watchDevicePixelRatio } from '@weasel-js/core';
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Point, ViewTransform } from '../instrument/types';
import { normalize2DView } from '../state/view';
import { CameraContext, CameraInput, CameraScope, useCameraView } from './CameraInput';
import { CanvasStackContext } from './CanvasStackContext';
import { type CameraGestures, resolveGestures, touchMode } from './cameraGestures';
import { embedScale } from './hostBox';
import { LinkedCursor } from './LinkedCursor';
import { type CanvasLayerDescriptor, useLayerScheduler } from './useLayerScheduler';
import { resolveFrame, type ViewportSize, type WorldSpec } from './worldSpec';

/** Props for `<CanvasStack>`. */
export interface CanvasStackProps {
  layers: CanvasLayerDescriptor[];
  view: ViewTransform;
  onViewChange: (v: ViewTransform) => void;
  /** The instrument's coordinate system. Omitted, world (0,0) sits at the
   *  element's top-left with y running down. */
  worldSpec?: WorldSpec;
  minZoom?: number;
  maxZoom?: number;
  width?: number | string;
  height?: number | string;
  className?: string;
  /** Fired whenever the stack is measured, so a consumer can place a view that
   *  only makes sense in terms of the viewport. */
  onResize?: (size: ViewportSize) => void;
  onHitTest?: (worldPos: Point) => void;
  children?: ReactNode;
  /** A yoke to join, from `useYoke()`: cameras on one yoke share their tool
   *  and gesture in flight. Omitted, this one keeps its own. */
  yoke?: Yoke;
  /** Which gestures the camera takes; the rest reach the page. Omitted, all
   *  but `home`. */
  gestures?: CameraGestures;
  /** Returns the camera to where it opened; what the `home` gesture runs. */
  onHome?: () => void;
  /** Frames after each of which every `timed` layer repaints — a trial clock's. */
  ticks?: (fn: () => void) => () => void;
}

/** The most backing pixels one layer's canvas is given, whatever magnifies it: 4096², 64 MB of RGBA. */
const MAX_BACKING_PIXELS = 4096 * 4096;

/**
 * Backing pixels per CSS px for a box of `width × height` CSS px that a transform shows at `scale` times its size on a
 * display of `dpr`: enough to stay sharp, capped at {@link MAX_BACKING_PIXELS} but never below `dpr` itself.
 */
export function backingDensity(width: number, height: number, dpr: number, scale: number): number {
  const wanted = dpr * scale;
  const area = width * height;
  const most = area > 0 ? Math.sqrt(MAX_BACKING_PIXELS / area) : wanted;
  return Math.min(wanted, Math.max(dpr, most));
}

/**
 * The element's layout size in CSS px and the backing density its canvases need, kept current. Measured from layout,
 * not from its client rect, which a scaled ancestor (a lens, a `<Stage>`) inflates or shrinks: the scale goes into
 * the density instead, so a magnified stack is drawn sharp rather than enlarged. In a frame, the scale the embedding
 * pages show the frame at goes in too.
 */
function useMeasuredBox(ref: RefObject<HTMLElement | null>): {
  width: number;
  height: number;
  dpr: number;
} {
  const [size, setSize] = useState({ width: 0, height: 0, dpr: 1 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const win = el.ownerDocument.defaultView;
    // The layout box as the observer last reported it; a transform does not reach it.
    let layout: { width: number; height: number } | null = null;
    const update = (entries?: readonly ResizeObserverEntry[]) => {
      const observed = entries?.at(-1)?.contentRect;
      if (observed) layout = { width: observed.width, height: observed.height };
      const rect = el.getBoundingClientRect();
      // Unscaled, the client rect is the box, read the same way on every call: a size that changed only in how it
      // was rounded would place a view a second time.
      const scaled = layout !== null && rect.width > 0 && Math.abs(rect.width - layout.width) > 0.5;
      const box = scaled && layout ? layout : rect;
      const scale = (box.width > 0 ? rect.width / box.width : 1) * embedScale(win);
      const { width, height } = box;
      const dpr = backingDensity(width, height, window.devicePixelRatio ?? 1, scale);
      setSize((prev) => {
        if (prev.width === width && prev.height === height && prev.dpr === dpr) return prev;
        return { width, height, dpr };
      });
    };
    update();
    // A window moved to a display of another density keeps its CSS box, so no observer fires.
    const unwatchDensity = watchDevicePixelRatio(() => update());
    // Nor does a page changing the transform it shows this frame at; it says so with a resize.
    const remeasure = () => update();
    win?.addEventListener('resize', remeasure);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(el);
    return () => {
      unwatchDensity();
      win?.removeEventListener('resize', remeasure);
      ro?.disconnect();
    };
  }, [ref]);
  return size;
}

/** Stacks one `<canvas>` per layer and drives them from a shared view, so a
 *  layer that changes rarely is not redrawn with one that changes every frame.
 *  Handles sizing and device pixel ratio; pan and zoom route through weasel's
 *  gesture dispatcher (`<CameraInput>`). */
export function CanvasStack({
  layers,
  view: viewProp,
  onViewChange,
  worldSpec,
  minZoom,
  maxZoom,
  width = '100%',
  height = '100%',
  className,
  onResize,
  onHitTest,
  children,
  yoke,
  ticks,
  gestures,
  onHome,
}: CanvasStackProps) {
  // Keyed on its numbers: a caller handing over an equal view in a new object
  // must not mark every layer dirty.
  const { zoom, pan } = normalize2DView(viewProp);
  const view = useMemo(() => ({ zoom, pan: { x: pan.x, y: pan.y } }), [zoom, pan.x, pan.y]);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasMap = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const size = useMeasuredBox(containerRef);

  const setCanvasRef = (id: string, el: HTMLCanvasElement | null): void => {
    if (el) canvasMap.current.set(id, el);
    else canvasMap.current.delete(id);
  };

  const onResizeRef = useLatest(onResize);
  useEffect(() => {
    if (size.width === 0 && size.height === 0) return;
    onResizeRef.current?.({ width: size.width, height: size.height });
  }, [size.width, size.height, onResizeRef]);

  const frame = useMemo(() => resolveFrame(worldSpec, size), [worldSpec, size]);

  const camera = useCameraView({
    view: viewProp,
    onViewChange,
    frame,
    hostRef: containerRef,
    minZoom,
    maxZoom,
  });
  const cameraCtx = useMemo(
    () => ({ view: camera, frame, element: () => containerRef.current }),
    [camera, frame],
  );
  useLayerScheduler({
    layers,
    view,
    frame,
    canvasRefs: canvasMap,
    size,
    host: containerRef,
    ticks,
  });

  const ctxValue = useMemo(
    () => ({
      view,
      frame,
      surface: { element: containerRef, size, canvases: canvasMap, layers, worldSpec },
    }),
    [view, frame, size, layers, worldSpec],
  );

  const containerStyle: CSSProperties = { width, height };
  const canvasPx = {
    width: Math.max(0, Math.round(size.width * size.dpr)),
    height: Math.max(0, Math.round(size.height * size.dpr)),
  };
  const canvasCss: CSSProperties = {
    width: size.width,
    height: size.height,
  };

  return (
    <CameraScope yoke={yoke}>
      <CameraContext.Provider value={cameraCtx}>
        <CanvasStackContext.Provider value={ctxValue}>
          <CameraInput
            hostRef={containerRef}
            camera={camera}
            frame={frame}
            onTap={onHitTest}
            gestures={gestures}
            onHome={onHome}
          />
          <div
            ref={containerRef}
            className={className ? `lk-canvas-stack ${className}` : 'lk-canvas-stack'}
            data-lk-touch={touchMode(resolveGestures(gestures))}
            style={containerStyle}
          >
            {layers.map((layer) => (
              <canvas
                key={layer.id}
                ref={(el) => setCanvasRef(layer.id, el)}
                className="lk-canvas-stack__canvas"
                width={canvasPx.width}
                height={canvasPx.height}
                style={{ ...canvasCss, display: layer.visible ? 'block' : 'none' }}
              />
            ))}
            <LinkedCursor />
            <div className="lk-canvas-stack__overlay">{children}</div>
          </div>
        </CanvasStackContext.Provider>
      </CameraContext.Provider>
    </CameraScope>
  );
}
