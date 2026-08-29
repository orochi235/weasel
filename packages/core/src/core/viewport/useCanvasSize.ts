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
 *  This hook is the screen path's designated ambient-density source —
 *  rendering code should take density as a parameter (cf.
 *  `renderSceneToPixels`, `renderSceneToCanvas`'s `dpr`) rather than reading
 *  `window.devicePixelRatio` inline.
 *
 *  Density deliberately does NOT come from a `window.devicePixelRatio` read
 *  inside the resize callback: that only refreshes when the element resizes,
 *  so dragging a window to a different-density display without resizing it
 *  left the snapshot stale. The profile watches a re-armed resolution media
 *  query instead. */
export function useCanvasSize(containerRef: RefObject<HTMLElement | null>): CanvasSizeSnapshot {
  const { dpr } = useDeviceProfile();
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
    measure();
    const observer = new ResizeObserver(measure);
    if (containerRef.current) {
      observer.observe(containerRef.current);
    }
    return () => observer.disconnect();
  }, [measure, containerRef]);

  return { width: size.width, height: size.height, dpr };
}
