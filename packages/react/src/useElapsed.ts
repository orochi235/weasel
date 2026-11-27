import { transport, type Transport } from '@msb235/blits';
import { useEffect, useRef, useState } from 'react';
import { useVisibleRaf, type VisibleRaf, type VisibleRafOptions } from './useVisibleRaf';

/**
 * {@link useVisibleRaf} whose frame is handed the milliseconds the loop has run, counted from its
 * first frame and leaving out every stretch it spent suspended: an hour in a background tab adds
 * nothing. The count is a blits transport's time, synced with the frame clock rather than
 * `performance.now()`, so an injected `requestFrame` keeps it on its own clock. A `cancel()` does
 * not stop the count; only suspension does.
 */
export function useElapsedRaf(
  frame: (elapsedMs: number, loop: VisibleRaf) => void,
  options: VisibleRafOptions = {},
): VisibleRaf {
  const clock = useRef<Transport | null>(null);
  const { onResume } = options;
  return useVisibleRaf((now, loop) => {
    let c = clock.current;
    if (!c) {
      c = clock.current = transport({ seek: 'jump' });
      c.sync(now);
      c.seek(0);
    } else c.sync(now);
    frame(c.now, loop);
  }, {
    ...options,
    onResume: () => {
      clock.current?.rebase();
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
