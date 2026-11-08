import { useEffect, useRef } from 'react';
import { useVisibleRaf } from '@weasel-js/react';

/** Calls `poll` about every `ms` while the page is visible, on `useVisibleRaf` rather than a timer that runs unseen. */
export function useVisiblePoll(poll: () => void, ms: number): void {
  const last = useRef(-Infinity);
  const loop = useVisibleRaf((time, self) => {
    if (time - last.current >= ms) {
      last.current = time;
      poll();
    }
    self.request();
  });
  useEffect(() => loop.request(), [loop]);
}
