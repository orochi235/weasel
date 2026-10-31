import { type RefObject, useMemo, useSyncExternalStore } from 'react';
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
export function useCanvasSize(containerRef: RefObject<HTMLElement | null>, options?: ElementSizeOptions): CanvasSizeSnapshot {
  const { dpr } = useDeviceProfile();
  const { width, height } = useElementSize(containerRef, options);
  return { width, height, dpr };
}

/** How {@link useElementSize} commits a resize. */
export interface ElementSizeOptions {
  /** Render the caller with a new size inside the `ResizeObserver` callback, so the frame it resized in paints
   *  it. Only for a caller whose render lays out nothing outside the observed element: the browser delivers a
   *  resize it causes outside it only next frame, and reports the loop as an error. By default the size
   *  arrives a frame later. */
  beforePaint?: boolean;
}

const UNMEASURED: CanvasSize = { width: 0, height: 0 };

/** `useSyncExternalStore`'s view of an element's size: measured when subscribed and on each resize. */
function elementSizeStore(containerRef: RefObject<HTMLElement | null>, beforePaint: boolean) {
  let size = UNMEASURED;
  const measure = (el: HTMLElement): boolean => {
    const rect = el.getBoundingClientRect();
    if (rect.width === size.width && rect.height === size.height) return false;
    size = { width: rect.width, height: rect.height };
    return true;
  };
  return {
    subscribe(changed: () => void): () => void {
      const el = containerRef.current;
      if (!el) return () => {};
      measure(el);
      // Absent under jsdom and in older embedders: one measurement is all there is.
      if (typeof ResizeObserver === 'undefined') return () => {};
      let pending: ReturnType<typeof setTimeout> | undefined;
      const observer = new ResizeObserver(() => {
        // A store update renders on a microtask, still inside the browser's resize loop; a task waits for it.
        if (beforePaint) { if (measure(el)) changed(); }
        else pending ??= setTimeout(() => { pending = undefined; if (measure(el)) changed(); }, 0);
      });
      observer.observe(el);
      return () => { observer.disconnect(); clearTimeout(pending); };
    },
    get: () => size,
  };
}

/** An element's CSS-pixel size, `0 × 0` until it is mounted and measured.
 *  Re-measured whenever a `ResizeObserver` reports it resized. */
export function useElementSize(containerRef: RefObject<HTMLElement | null>, options?: ElementSizeOptions): CanvasSize {
  const beforePaint = options?.beforePaint ?? false;
  const store = useMemo(() => elementSizeStore(containerRef, beforePaint), [containerRef, beforePaint]);
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
