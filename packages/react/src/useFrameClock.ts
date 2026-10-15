import { useEffect, useMemo, useRef } from 'react';
import { useLatest } from './useLatest';
import { useVisibleRaf } from './useVisibleRaf';

/** Options for {@link useFrameClock}. */
export interface FrameClockOptions {
  /** Stop the clock where it is. Time spent paused is not counted. */
  paused?: boolean;
  /** What `seconds()` reads before any frame has run. Read once, at mount. */
  start?: number;
  /** Frame source, as on `useVisibleRaf`. */
  requestFrame?: (cb: FrameRequestCallback) => number;
  cancelFrame?: (handle: number) => void;
}

/** A clock a paint reads without rendering. It has `subscribe`, so a render
 *  layer can name it as its redraw source. */
export interface FrameClock {
  /** Seconds of frames that ran: time hidden, paused, or with no subscriber is left out. */
  seconds(): number;
  /** Called once per frame. The clock runs while it has a subscriber. */
  subscribe(listener: () => void): () => void;
}

/**
 * Elapsed time for something that animates in its paint and nowhere else: a
 * shader uniform, a procedural layer. Each frame notifies the subscribers and
 * changes no React state, so the component that owns it does not re-render.
 */
export function useFrameClock(options: FrameClockOptions = {}): FrameClock {
  const { paused = false, requestFrame, cancelFrame } = options;
  const elapsed = useRef(options.start ?? 0);
  const last = useRef<number | null>(null);
  const listeners = useRef(new Set<() => void>());
  const pausedRef = useLatest(paused);

  const loop = useVisibleRaf(
    (now, loop) => {
      if (last.current !== null) elapsed.current += (now - last.current) / 1000;
      last.current = now;
      for (const listener of [...listeners.current]) listener();
      if (listeners.current.size > 0 && !pausedRef.current) loop.request();
    },
    { requestFrame, cancelFrame, onResume: () => { last.current = null; } },
  );

  useEffect(() => {
    if (paused) return;
    last.current = null;
    if (listeners.current.size > 0) loop.request();
    return () => loop.cancel();
  }, [paused, loop]);

  return useMemo<FrameClock>(() => ({
    seconds: () => elapsed.current,
    subscribe(listener) {
      const set = listeners.current;
      if (set.size === 0) last.current = null;
      set.add(listener);
      if (!pausedRef.current) loop.request();
      return () => {
        set.delete(listener);
        if (set.size === 0) loop.cancel();
      };
    },
  }), [loop, pausedRef]);
}
