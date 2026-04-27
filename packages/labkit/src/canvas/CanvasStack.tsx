import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import type { Point, ViewTransform } from '../instrument/types';
import { CanvasStackContext } from './CanvasStackContext';
import { screenToWorld } from './canvasCoords';
import { type CanvasLayerDescriptor, useLayerScheduler } from './useLayerScheduler';
import { usePanZoom } from './usePanZoom';

export interface CanvasStackProps {
  layers: CanvasLayerDescriptor[];
  view: ViewTransform;
  onViewChange: (v: ViewTransform) => void;
  width?: number | string;
  height?: number | string;
  className?: string;
  onHitTest?: (worldPos: Point) => void;
  children?: ReactNode;
}

export function CanvasStack({
  layers,
  view,
  onViewChange,
  width = '100%',
  height = '100%',
  className,
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

  const handlers = usePanZoom({ view, onViewChange });
  useLayerScheduler({ layers, view, canvasRefs: canvasMap, size });

  const ctxValue = useMemo(() => ({ view }), [view]);

  const containerStyle: CSSProperties = { width, height };
  const canvasPx = {
    width: Math.max(0, Math.round(size.width * size.dpr)),
    height: Math.max(0, Math.round(size.height * size.dpr)),
  };
  const canvasCss: CSSProperties = {
    width: size.width,
    height: size.height,
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const wasDragging = handlers.isDragging();
    handlers.onPointerUp(e);
    if (!wasDragging && onHitTest && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const screen = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      onHitTest(screenToWorld(screen, view));
    }
  };

  return (
    <CanvasStackContext.Provider value={ctxValue}>
      <div
        ref={containerRef}
        className={className ? `lk-canvas-stack ${className}` : 'lk-canvas-stack'}
        style={containerStyle}
        onWheel={handlers.onWheel}
        onPointerDown={handlers.onPointerDown}
        onPointerMove={handlers.onPointerMove}
        onPointerUp={handlePointerUp}
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
