import { useEffect } from 'react';
import { readRoute } from '../shell/useRoute';
import type { Clock } from './clock';
import { writePlayheadParam } from './playheadUrl';

/**
 * Holds `clock`'s playhead in the URL while it is paused and the route names `storyId`, so a paused frame is a link.
 * Playing drops it once; the frames that follow write nothing.
 */
export function useHeldPlayhead(clock: Clock | null, storyId: string): void {
  useEffect(() => {
    if (!clock) return;
    let held: number | null | undefined;
    return clock.subscribe(() => {
      if (readRoute() !== storyId) return;
      const { playing, time } = clock.get();
      const next = playing ? null : time;
      if (next === held) return;
      held = next;
      writePlayheadParam(next);
    });
  }, [clock, storyId]);
}
