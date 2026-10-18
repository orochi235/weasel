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

/** The element's CSS size and the display's pixel density, kept current. */
function useMeasuredBox(ref: RefObject<HTMLElement | null>): {
  width: number;
  height: number;
  dpr: number;
} {
  const [size, setSize] = useState({ width: 0, height: 0, dpr: 1 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const rect = el.getBoundingClientRect();
      const dpr = window.devicePixelRatio ?? 1;
      setSize((prev) => {
        if (prev.width === rect.width && prev.height === rect.height && prev.dpr === dpr) {
          return prev;
        }
        return { width: rect.width, height: rect.height, dpr };
      });
    };
    update();
    // A window moved to a display of another density keeps its CSS box, so no observer fires.
    const unwatchDensity = watchDevicePixelRatio(update);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    ro?.observe(el);
    return () => {
      unwatchDensity();
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
