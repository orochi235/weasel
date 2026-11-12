import { layoutBoxOf } from '@weasel-js/routing';
import { type RefObject, useLayoutEffect, useMemo, useSyncExternalStore } from 'react';
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

/** `useSyncExternalStore`'s view of an element's size: measured when subscribed, on each resize, and whenever
 *  `sync` finds the ref holding another element than the one it watches. */
function elementSizeStore(containerRef: RefObject<HTMLElement | null>, beforePaint: boolean) {
  let size = UNMEASURED;
  let el: HTMLElement | null = null;
  let observer: ResizeObserver | null = null;
  let pending: ReturnType<typeof setTimeout> | undefined;
  let changed: (() => void) | null = null;
  const measure = (): boolean => {
    // The layout box, not the client rect: an ancestor transform shows the element larger or smaller without
    // resizing what it lays out or paints in, and changes without the observer hearing of it.
    const rect = el ? layoutBoxOf(el) : UNMEASURED;
    if (rect.width === size.width && rect.height === size.height) return false;
    size = { width: rect.width, height: rect.height };
    return true;
  };
  /** Watch whatever the ref holds now. Returns whether the size moved. */
  const follow = (): boolean => {
    const next = containerRef.current;
    if (next === el) return false;
    if (el) observer?.unobserve(el);
    el = next;
    if (el) observer?.observe(el);
    return measure();
  };
  return {
    subscribe(onChange: () => void): () => void {
      changed = onChange;
      // Absent under jsdom and in older embedders: a measurement per element is all there is.
      observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => {
        // A store update renders on a microtask, still inside the browser's resize loop; a task waits for it.
        if (beforePaint) { if (measure()) changed?.(); }
        else pending ??= setTimeout(() => { pending = undefined; if (measure()) changed?.(); }, 0);
      });
      if (follow()) onChange();
      return () => {
        observer?.disconnect();
        observer = null;
        el = null;
        changed = null;
        clearTimeout(pending);
        pending = undefined;
      };
    },
    /** After a commit: an element mounted, swapped or gone since the subscription is watched from here. */
    sync(): void {
      if (changed && follow()) changed();
    },
    get: () => size,
  };
}

/** An element's CSS-pixel size, `0 × 0` until it is mounted and measured.
 *  Re-measured whenever a `ResizeObserver` reports it resized, and when the ref
 *  comes to hold another element. */
export function useElementSize(containerRef: RefObject<HTMLElement | null>, options?: ElementSizeOptions): CanvasSize {
  const beforePaint = options?.beforePaint ?? false;
  const store = useMemo(() => elementSizeStore(containerRef, beforePaint), [containerRef, beforePaint]);
  const size = useSyncExternalStore(store.subscribe, store.get, store.get);
  // No dependency array: a ref says nothing when it changes, so every commit asks.
  useLayoutEffect(() => store.sync());
  return size;
}
