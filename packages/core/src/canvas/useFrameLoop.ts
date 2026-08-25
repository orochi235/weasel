/**
 * The frame loop behind `<Canvas>`: a dirty flag, one `requestAnimationFrame`
 * in flight at a time, and a subscriber set notified after a paint lands.
 *
 * @internal Not consumer surface. Canvas exposes `requestRedraw` and
 *   `subscribeFrame` on its ref handle; this is how they are implemented.
 */

import { useCallback, useLayoutEffect, useRef } from 'react';

export interface FrameLoop {
  /** Mark the surface dirty and schedule a frame. Identity is stable for the
   *  lifetime of the component — consumers capture it. */
  requestRedraw(): void;
  /** Run `fn` after every landed paint. Returns an unsubscribe. */
  subscribeFrame(fn: () => void): () => void;
}

export interface FrameLoopOptions {
  /** Paint in the caller's own stack — the commit or event that asked for the
   *  redraw — instead of on the next animation frame. Read live, so toggling
   *  it takes effect from the next `requestRedraw` on. */
  syncPaint?: boolean;
}

/**
 * @param paint Runs on the frame; returns whether pixels landed. A `false`
 *   leaves the surface dirty and notifies nobody, so the next request retries.
 */
export function useFrameLoop(paint: () => boolean, options: FrameLoopOptions = {}): FrameLoop {
  const dirtyRef = useRef(true);
  const rafRef = useRef(0);
  const aliveRef = useRef(true);
  const paintingRef = useRef(false);
  const paintRef = useRef(paint);
  paintRef.current = paint;
  const syncRef = useRef(false);
  syncRef.current = options.syncPaint ?? false;
  const subsRef = useRef<Set<() => void>>(new Set());

  const runPaint = useCallback(() => {
    dirtyRef.current = false;
    paintingRef.current = true;
    let landed = false;
    try {
      landed = paintRef.current();
    } finally {
      paintingRef.current = false;
    }
    if (!landed) {
      dirtyRef.current = true;
      return;
    }
    for (const fn of subsRef.current) fn();
  }, []);

  const scheduleFrame = useCallback(() => {
    if (rafRef.current !== 0 || !aliveRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      // Released before the paint, so a `requestRedraw` issued from inside a
      // layer's draw schedules the next frame instead of being swallowed.
      rafRef.current = 0;
      if (!aliveRef.current) return;
      runPaint();
    });
  }, [runPaint]);

  const requestRedraw = useCallback(() => {
    dirtyRef.current = true;
    // A request made from inside a draw would recurse forever if it painted
    // here, so re-entrant ones always fall through to a frame.
    if (syncRef.current && aliveRef.current && !paintingRef.current) {
      runPaint();
      return;
    }
    scheduleFrame();
  }, [runPaint, scheduleFrame]);

  const subscribeFrame = useCallback((fn: () => void) => {
    subsRef.current.add(fn);
    return () => { subsRef.current.delete(fn); };
  }, []);

  // `requestRedraw` outlives the component: `@weasel-js/hud` calls it from a
  // `.then()`, and `viewRegistry.attachSurface` hands it to the consumer.
  // Re-armed in setup because refs survive StrictMode's simulated remount, and
  // a layout effect so the arming precedes Canvas's own layout effects — the
  // sync-paint path runs in one of those.
  useLayoutEffect(() => {
    aliveRef.current = true;
    const subs = subsRef.current;
    return () => {
      aliveRef.current = false;
      if (rafRef.current !== 0) cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
      subs.clear();
    };
  }, []);

  return { requestRedraw, subscribeFrame };
}
