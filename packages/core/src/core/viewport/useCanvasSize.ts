import { type RefObject, useCallback, useEffect, useState } from 'react';
import type { CanvasSize } from './clampView';
import { useDeviceProfile } from '../device/useDeviceProfile';

/** Size snapshot returned by `useCanvasSize` — the kit-wide `CanvasSize`
 *  (width × height in CSS pixels) plus the current devicePixelRatio. */
export interface CanvasSizeSnapshot extends CanvasSize {
  dpr: number;
}

/** Track a container's content-rect size via `ResizeObserver`, and density via
 *  the ambient `DeviceProfile`.
 *
 *  Density deliberately does NOT come from a `window.devicePixelRatio` read
 *  inside the resize callback: that only refreshes when the element resizes,
 *  so dragging a window to a different-density display without resizing it
 *  leaves the snapshot stale. */
export function useCanvasSize(containerRef: RefObject<HTMLElement | null>): CanvasSizeSnapshot {
  const { dpr } = useDeviceProfile();
  const { width, height } = useElementSize(containerRef);
  return { width, height, dpr };
}

/** An element's CSS-pixel size, `0 × 0` until it is mounted and measured.
 *  Re-measured whenever a `ResizeObserver` reports it resized. */
export function useElementSize(containerRef: RefObject<HTMLElement | null>): CanvasSize {
  const [size, setSize] = useState<CanvasSize>({ width: 0, height: 0 });

  const measure = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    setSize((prev) =>
      prev.width === rect.width && prev.height === rect.height
        ? prev
        : { width: rect.width, height: rect.height },
    );
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    measure();
    // Absent under jsdom and in older embedders: one measurement is all there is.
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [measure, containerRef]);

  return size;
}
