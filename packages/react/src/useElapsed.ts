import { useEffect, useRef, useState } from 'react';
import { useVisibleRaf, type VisibleRaf, type VisibleRafOptions } from './useVisibleRaf';

/**
 * {@link useVisibleRaf} whose frame is handed the milliseconds the loop has run, counted from its
 * first frame and leaving out every stretch it spent suspended: an hour in a background tab adds
 * nothing. The rebase reads the frame clock, not `performance.now()`, so an injected
 * `requestFrame` keeps the count on its own clock. A `cancel()` does not stop the count; only
 * suspension does.
 */
export function useElapsedRaf(
  frame: (elapsedMs: number, loop: VisibleRaf) => void,
  options: VisibleRafOptions = {},
): VisibleRaf {
  const clock = useRef<{ start: number | null; elapsed: number; resumed: boolean }>({ start: null, elapsed: 0, resumed: false });
  const { onResume } = options;
  return useVisibleRaf((now, loop) => {
    const c = clock.current;
    if (c.start === null) c.start = now;
    else if (c.resumed) c.start = now - c.elapsed;
    c.resumed = false;
    c.elapsed = now - c.start;
    frame(c.elapsed, loop);
  }, {
    ...options,
    onResume: () => {
      clock.current.resumed = true;
      onResume?.();
    },
  });
}

/**
 * The milliseconds a component has been on screen, as state: it re-renders every frame while
 * visible, and stands still while the document is hidden or `target` is out of view.
 */
export function useElapsed(options: VisibleRafOptions = {}): number {
  const [elapsed, setElapsed] = useState(0);
  const loop = useElapsedRaf((ms, self) => {
    self.request();
    setElapsed(ms);
  }, options);
  useEffect(() => {
    loop.request();
    return () => loop.cancel();
  }, [loop]);
  return elapsed;
}
