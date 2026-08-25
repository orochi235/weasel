/**
 * The frame loop behind `<Canvas>`: a dirty flag, one `requestAnimationFrame`
 * in flight at a time, and a subscriber set notified after a paint lands.
 *
 * @internal Not consumer surface. Canvas exposes `requestRedraw` and
 *   `subscribeFrame` on its ref handle; this is how they are implemented.
 */

import { useCallback, useEffect, useRef } from 'react';

export interface FrameLoop {
  /** Mark the surface dirty and schedule a frame. Identity is stable for the
   *  lifetime of the component — consumers capture it. */
  requestRedraw(): void;
  /** Run `fn` after every landed paint. Returns an unsubscribe. */
  subscribeFrame(fn: () => void): () => void;
}

/**
 * @param paint Runs on the frame; returns whether pixels landed. A `false`
 *   leaves the surface dirty and notifies nobody, so the next request retries.
 */
export function useFrameLoop(paint: () => boolean): FrameLoop {
  const dirtyRef = useRef(true);
  const rafRef = useRef(0);
  const aliveRef = useRef(true);
  const paintRef = useRef(paint);
  paintRef.current = paint;
  const subsRef = useRef<Set<() => void>>(new Set());

  const scheduleFrame = useCallback(() => {
    if (rafRef.current !== 0 || !aliveRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      if (!aliveRef.current) return;
      // Cleared before the paint: a `requestRedraw` issued from inside a
      // layer's draw schedules the next frame instead of being swallowed.
      dirtyRef.current = false;
      if (!paintRef.current()) {
        dirtyRef.current = true;
        return;
      }
      for (const fn of subsRef.current) fn();
    });
  }, []);

  const requestRedraw = useCallback(() => {
    dirtyRef.current = true;
    scheduleFrame();
  }, [scheduleFrame]);

  const subscribeFrame = useCallback((fn: () => void) => {
    subsRef.current.add(fn);
    return () => { subsRef.current.delete(fn); };
  }, []);

  // `requestRedraw` outlives the component: `@weasel-js/hud` calls it from a
  // `.then()`, and `viewRegistry.attachSurface` hands it to the consumer.
  useEffect(() => () => {
    aliveRef.current = false;
    if (rafRef.current !== 0) cancelAnimationFrame(rafRef.current);
    rafRef.current = 0;
    subsRef.current.clear();
  }, []);

  return { requestRedraw, subscribeFrame };
}
