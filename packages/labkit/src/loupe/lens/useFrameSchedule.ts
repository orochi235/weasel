import { useVisibleRaf } from '@weasel-js/react';
import { useCallback, useRef } from 'react';

/** Runs the last function handed to it on the next visible frame, once however many arrive before then. */
export function useFrameSchedule(): (run: () => void) => void {
  const next = useRef<(() => void) | null>(null);
  const frame = useVisibleRaf(() => {
    const run = next.current;
    next.current = null;
    run?.();
  });
  return useCallback(
    (run: () => void) => {
      next.current = run;
      frame.request();
    },
    [frame],
  );
}
