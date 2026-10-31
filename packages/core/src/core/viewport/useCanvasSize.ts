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
export function useCanvasSize(containerRef: RefObject<HTMLElement | null>): CanvasSizeSnapshot {
  const { dpr } = useDeviceProfile();
  const { width, height } = useElementSize(containerRef);
  return { width, height, dpr };
}

const UNMEASURED: CanvasSize = { width: 0, height: 0 };

/** `useSyncExternalStore`'s view of an element's size: measured when subscribed and on each resize. */
function elementSizeStore(containerRef: RefObject<HTMLElement | null>) {
  let size = UNMEASURED;
  const measure = (el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    if (rect.width !== size.width || rect.height !== size.height) size = { width: rect.width, height: rect.height };
  };
  return {
    subscribe(changed: () => void): () => void {
      const el = containerRef.current;
      if (!el) return () => {};
      measure(el);
      // Absent under jsdom and in older embedders: one measurement is all there is.
      if (typeof ResizeObserver === 'undefined') return () => {};
      const observer = new ResizeObserver(() => { measure(el); changed(); });
      observer.observe(el);
      return () => observer.disconnect();
    },
    get: () => size,
  };
}

/** An element's CSS-pixel size, `0 × 0` until it is mounted and measured.
 *  Re-measured whenever a `ResizeObserver` reports it resized, and committed
 *  before the browser paints that frame: a store update renders on a
 *  microtask, where state set in the observer's callback would wait for
 *  React's scheduler and show the old size for a frame. */
export function useElementSize(containerRef: RefObject<HTMLElement | null>): CanvasSize {
  const store = useMemo(() => elementSizeStore(containerRef), [containerRef]);
  return useSyncExternalStore(store.subscribe, store.get, store.get);
}
