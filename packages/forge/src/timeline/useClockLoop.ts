import { useVisibleRaf, type VisibleRafTarget } from '@weasel-js/core';
import { useEffect, useRef, useSyncExternalStore } from 'react';
import type { Clock } from './clock';

const NEVER = () => () => {};
const notPlaying = () => false;

/** Drives `clock` from frames while it plays. Frames stop while the page or `target` is out of sight, and the time
 *  spent there is dropped rather than arriving as one long frame. */
export function useClockLoop(clock: Clock | null, target?: VisibleRafTarget): void {
  const playing = useSyncExternalStore(clock?.subscribe ?? NEVER, clock ? () => clock.get().playing : notPlaying);
  const last = useRef<number | null>(null);
  const raf = useVisibleRaf(
    (now) => {
      if (!clock) return;
      const prev = last.current;
      last.current = now;
      if (prev !== null) clock.tick(now - prev);
      if (clock.get().playing) raf.request();
    },
    {
      ...(target ? { target } : {}),
      onResume: () => {
        last.current = null;
      },
    },
  );
  useEffect(() => {
    if (!playing) return;
    last.current = null;
    raf.request();
    return () => raf.cancel();
  }, [playing, raf]);
}
