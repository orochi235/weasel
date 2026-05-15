import { type RefObject, useCallback, useEffect, useState } from 'react';
import type { CanvasSize } from './clampView';

/** Size snapshot returned by `useCanvasSize` — the kit-wide `CanvasSize`
 *  (width × height in CSS pixels) plus the current `devicePixelRatio`. */
export interface CanvasSizeSnapshot extends CanvasSize {
  dpr: number;
}

/** Track a container's content-rect size and the current devicePixelRatio via `ResizeObserver`. */
export function useCanvasSize(containerRef: RefObject<HTMLDivElement | null>): CanvasSizeSnapshot {
  const [size, setSize] = useState<CanvasSizeSnapshot>({ width: 0, height: 0, dpr: 1 });

  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setSize({
      width: rect.width,
      height: rect.height,
      dpr: window.devicePixelRatio || 1,
    });
  }, [containerRef]);

  useEffect(() => {
    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [measure, containerRef]);

  return size;
}
