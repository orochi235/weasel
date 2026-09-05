import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import type { Point, ViewTransform } from '../instrument/types';
import { CanvasStackContext } from './CanvasStackContext';
import { screenToWorld } from './canvasCoords';
import { type CanvasLayerDescriptor, useLayerScheduler } from './useLayerScheduler';
import { usePanZoom } from './usePanZoom';
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
}

/** Stacks one `<canvas>` per layer and drives them from a shared view, so a
 *  layer that changes rarely is not redrawn with one that changes every frame.
 *  Handles sizing, device pixel ratio, and pan/zoom. */
export function CanvasStack({
  layers,
  view,
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
}: CanvasStackProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasMap = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const [size, setSize] = useState({ width: 0, height: 0, dpr: 1 });

  const setCanvasRef = (id: string, el: HTMLCanvasElement | null): void => {
    if (el) canvasMap.current.set(id, el);
    else canvasMap.current.delete(id);
  };

  useEffect(() => {
    const el = containerRef.current;
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
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;
  useEffect(() => {
    if (size.width === 0 && size.height === 0) return;
    onResizeRef.current?.({ width: size.width, height: size.height });
  }, [size.width, size.height]);

  const frame = useMemo(() => resolveFrame(worldSpec, size), [worldSpec, size]);

  const onTap = (e: PointerEvent) => {
    const el = containerRef.current;
    if (!onHitTest || !el) return;
    const rect = el.getBoundingClientRect();
    onHitTest(screenToWorld({ x: e.clientX - rect.left, y: e.clientY - rect.top }, view, frame));
  };

  const handlers = usePanZoom({ view, onViewChange, minZoom, maxZoom, frame, onTap });
  useLayerScheduler({ layers, view, frame, canvasRefs: canvasMap, size, host: containerRef });

  const ctxValue = useMemo(
    () => ({
      view,
      frame,
      surface: { element: containerRef, size, canvases: canvasMap, layers },
    }),
    [view, frame, size, layers],
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
    <CanvasStackContext.Provider value={ctxValue}>
      <div
        ref={containerRef}
        className={className ? `lk-canvas-stack ${className}` : 'lk-canvas-stack'}
        style={containerStyle}
        onWheel={handlers.onWheel}
        onPointerDown={handlers.onPointerDown}
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
        <div className="lk-canvas-stack__overlay">{children}</div>
      </div>
    </CanvasStackContext.Provider>
  );
}
