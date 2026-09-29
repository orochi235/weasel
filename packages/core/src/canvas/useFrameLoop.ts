/**
 * The frame loop behind `<Canvas>`: a dirty flag, one frame in flight at a
 * time, and a subscriber set notified after a paint lands. When frames may run
 * at all is `useVisibleRaf`'s question, not this hook's — a redraw requested
 * while nothing can see the surface is held there and re-armed on resume.
 *
 * @internal Not consumer surface. Canvas exposes `requestRedraw` and
 *   `subscribeFrame` on its ref handle; this is how they are implemented.
 */

import { useCallback, useInsertionEffect, useLayoutEffect, useRef } from 'react';
import { useLatest } from '@weasel-js/react';
import { useVisibleRaf, type VisibleRafTarget } from '../scheduling/useVisibleRaf';

export interface FrameLoop {
  /** Mark the surface dirty and schedule a frame. Identity is stable for the
   *  lifetime of the component — consumers capture it. */
  requestRedraw(): void;
  /** Run `fn` after every landed paint, with the frame's time. Returns an
   *  unsubscribe. */
  subscribeFrame(fn: (time: number) => void): () => void;
  /** Run `fn` on every frame just before its paint, with the frame's time.
   *  Returns an unsubscribe. */
  subscribeBeforePaint(fn: (time: number) => void): () => void;
}

export interface FrameLoopOptions {
  /** Paint in the caller's own stack — the commit or event that asked for the
   *  redraw — instead of on the next animation frame. Read live, so toggling
   *  it takes effect from the next `requestRedraw` on. */
  syncPaint?: boolean;
  /** The surface being painted. Given one, the loop also stops while that
   *  element sits outside the viewport, not only while the tab is hidden. */
  target?: VisibleRafTarget;
}

/**
 * @param paint Runs on the frame; returns whether pixels landed. A `false`
 *   leaves the surface dirty and notifies nobody, so the next request retries.
 */
export function useFrameLoop(paint: () => boolean, options: FrameLoopOptions = {}): FrameLoop {
  const dirtyRef = useRef(true);
  const aliveRef = useRef(true);
  const paintingRef = useRef(false);
  const paintRef = useLatest(paint);
  const syncRef = useLatest(options.syncPaint ?? false);
  const subsRef = useRef<Set<(time: number) => void>>(new Set());
  const beforeRef = useRef<Set<(time: number) => void>>(new Set());

  /** Set while recovering from a paint that threw, so one bad frame is retried
   *  and a permanently throwing one still doesn't spin at frame rate. */
  const retriedRef = useRef(false);
  /** `frame.request`, which doesn't exist until after `runPaint` is built. */
  const rearmRef = useRef<(() => void) | null>(null);

  const runPaint = useCallback((time: number) => {
    dirtyRef.current = false;
    paintingRef.current = true;
    let landed = false;
    try {
      for (const fn of beforeRef.current) fn(time);
      landed = paintRef.current();
      if (!landed) {
        dirtyRef.current = true;
        return;
      }
      retriedRef.current = false;
      // Notified inside the guard: a subscriber calling `requestRedraw` under
      // `syncPaint` would otherwise re-enter this synchronously, without bound.
      for (const fn of subsRef.current) fn(time);
    } catch (err) {
      // A throw skips the `!landed` branch above, so without this the surface
      // is left clean but unpainted — the pixels on screen are whatever the
      // last landed frame left, and nothing repaints until something
      // unrelated happens to request a redraw. That is how a single
      // malformed node blanked a whole document until the pointer moved.
      dirtyRef.current = true;
      if (!retriedRef.current) {
        retriedRef.current = true;
        rearmRef.current?.();
      }
      throw err;
    } finally {
      paintingRef.current = false;
    }
  }, [paintRef]);

  const frame = useVisibleRaf(
    useCallback((time: number) => {
      if (!aliveRef.current || !dirtyRef.current) return;
      runPaint(time);
    }, [runPaint]),
    { target: options.target },
  );
  useInsertionEffect(() => {
    rearmRef.current = () => { frame.request(); };
  });

  const requestRedraw = useCallback(() => {
    dirtyRef.current = true;
    // The gate suppresses the sync path too: a background tab still commits
    // React updates, and that is the one paint browser throttling does not stop.
    // A request made from inside a draw or a frame subscriber would recurse
    // forever if it painted here, so re-entrant ones fall through to a frame.
    if (syncRef.current && aliveRef.current && !paintingRef.current && frame.isVisible()) {
      runPaint(performance.now());
      return;
    }
    frame.request();
  }, [frame, runPaint, syncRef]);

  const subscribeFrame = useCallback((fn: (time: number) => void) => {
    subsRef.current.add(fn);
    return () => { subsRef.current.delete(fn); };
  }, []);
  const subscribeBeforePaint = useCallback((fn: (time: number) => void) => {
    beforeRef.current.add(fn);
    return () => { beforeRef.current.delete(fn); };
  }, []);

  // `requestRedraw` outlives the component: `@weasel-js/hud` calls it from a
  // `.then()`, and `viewRegistry.attachSurface` hands it to the consumer.
  // Re-armed in setup because refs survive StrictMode's simulated remount, and
  // a layout effect so the arming precedes Canvas's own layout effects — the
  // sync-paint path runs in one of those.
  useLayoutEffect(() => {
    aliveRef.current = true;
    const subs = subsRef.current;
    const before = beforeRef.current;
    return () => {
      aliveRef.current = false;
      subs.clear();
      before.clear();
    };
  }, []);

  return { requestRedraw, subscribeFrame, subscribeBeforePaint };
}
