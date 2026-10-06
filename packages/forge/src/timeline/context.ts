import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import type { Clock, ClockState, SpanOverride } from './clock';

/** The clock of the story rendering below it; null where the story declares no timeline. */
export const ClockContext = createContext<Clock | null>(null);

/** What `useTimeline` hands a story: where its playhead stands, and the moves the transport makes. Times in ms. */
export interface StoryTimeline extends ClockState {
  play(): void;
  pause(): void;
  seek(time: number): void;
  setLoop(loop: boolean): void;
  setRate(rate: number): void;
  /** Replaces the declared span, for one the story only learns once it runs; null goes back to the declared one. */
  setSpan(span: SpanOverride | null): void;
}

function useClock(hook: string): Clock {
  const clock = useContext(ClockContext);
  if (!clock) {
    throw new Error(
      `${hook}: this story declares no timeline. Give it \`timeline: { duration }\`, or \`parameters.forge.timeline\` in CSF.`,
    );
  }
  return clock;
}

/** The story's playhead, in ms. Re-renders only the component calling it, on every move. Throws outside a story that
 *  declares a timeline. */
export function usePlayhead(): number {
  const clock = useClock('usePlayhead');
  return useSyncExternalStore(clock.subscribe, () => clock.get().time);
}

/** The story's whole clock: playhead, span, play state, loop and rate, and the moves on them. Throws outside a story
 *  that declares a timeline. */
export function useTimeline(): StoryTimeline {
  const clock = useClock('useTimeline');
  const state = useSyncExternalStore(clock.subscribe, clock.get);
  return useMemo(
    () => ({
      ...state,
      play: clock.play,
      pause: clock.pause,
      seek: clock.seek,
      setLoop: clock.setLoop,
      setRate: clock.setRate,
      setSpan: clock.setSpan,
    }),
    [state, clock],
  );
}
