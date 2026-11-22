import { useVisibleRaf } from '@weasel-js/react';
import { useCallback, useRef } from 'react';

/** Runs each function handed to it on the next visible frame, each once however many times it arrives before then. */
export function useFrameSchedule(): (run: () => void) => void {
  const due = useRef<(() => void)[]>([]);
  const frame = useVisibleRaf(() => {
    const runs = due.current;
    due.current = [];
    for (const run of runs) run();
  });
  return useCallback(
    (run: () => void) => {
      if (!due.current.includes(run)) due.current.push(run);
      frame.request();
    },
    [frame],
  );
}
