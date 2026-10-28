import type { ClockHandle } from '@weasel-js/clock';
import { useLatest } from '@weasel-js/core';
import { useTransportControl, useTrialClockHandle } from '@weasel-js/labkit';
import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from 'react';
import { spanOverrideOf } from './clockSpec';
import { ownMoves, type PlayMoves, setLoop, subscribeSpeed } from './moves';
import { seekShown, shownTime } from './shown';
import type { Span, SpanOverride } from './types';

/** The clock of the story rendering below it; null where the story declares no timeline. */
export const ClockContext = createContext<ClockHandle | null>(null);

/** What `useTimeline` hands a story: where its playhead stands, and the moves the transport makes. Times in ms. */
export interface StoryTimeline {
  /** The playhead, in ms, always inside `span`. */
  time: number;
  playing: boolean;
  loop: boolean;
  rate: number;
  span: Span;
  play(): void;
  pause(): void;
  seek(time: number): void;
  setLoop(loop: boolean): void;
  setRate(rate: number): void;
  /** Replaces the declared span, for one the story only learns once it runs; null goes back to the declared one. */
  setSpan(span: SpanOverride | null): void;
}

function useClock(hook: string): ClockHandle {
  const handle = useContext(ClockContext);
  if (!handle) {
    throw new Error(
      `${hook}: this story declares no timeline. Give it \`timeline: { duration }\`, or \`parameters.forge.timeline\` in CSF.`,
    );
  }
  return handle;
}

/** Subscribes to every change of `handle`'s clock: rate, seek, loop and declare, each frame it moves, and a paused
 *  speed change. */
function useClockChanges(handle: ClockHandle): (listener: () => void) => () => void {
  return useCallback(
    (listener) => {
      const offChange = handle.clock.subscribe(listener);
      const offFrame = handle.onFrame(listener);
      const offSpeed = subscribeSpeed(handle.clock, listener);
      return () => {
        offChange();
        offFrame();
        offSpeed();
      };
    },
    [handle],
  );
}

/** The story's playhead, in ms. Re-renders only the component calling it, on every move. Throws outside a story that
 *  declares a timeline. */
export function usePlayhead(): number {
  const handle = useClock('usePlayhead');
  return useSyncExternalStore(useClockChanges(handle), () => shownTime(handle.clock));
}

const validRate = (rate: number): boolean => Number.isFinite(rate) && rate > 0;

/** Play, pause and speed through the trial's transport, so the story and the transport share one speed, or on the
 *  clock itself where no transport works it. A transport over another clock goes unread, so its frames re-render
 *  nothing here. */
function usePlayMoves(handle: ClockHandle): PlayMoves {
  const resolved = useTrialClockHandle();
  const control = useTransportControl(resolved === handle ? undefined : null);
  if (control === null) return ownMoves(handle.clock);
  return { speed: () => control.speed, play: control.play, pause: control.pause, setSpeed: control.setSpeed };
}

/** The story's whole clock: playhead, span, play state, loop and rate, and the moves on them. Throws outside a story
 *  that declares a timeline. */
export function useTimeline(): StoryTimeline {
  const handle = useClock('useTimeline');
  const { clock } = handle;
  const moves = usePlayMoves(handle);
  const latest = useLatest({ moves });
  useSyncExternalStore(
    useClockChanges(handle),
    () =>
      `${shownTime(clock)}|${clock.rate}|${String(clock.loop)}|${clock.origin}|${clock.duration}|${moves.speed()}`,
  );
  const time = shownTime(clock);
  const playing = clock.rate !== 0;
  const loop = clock.loop !== false;
  const rate = moves.speed();
  const { origin, duration } = clock;

  const actions = useMemo(
    () => ({
      play: () => latest.current.moves.play(),
      pause: () => latest.current.moves.pause(),
      seek: (t: number) => seekShown(handle.clock, t),
      setLoop: (next: boolean) => setLoop(handle.clock, next),
      setRate: (next: number) => {
        if (validRate(next)) latest.current.moves.setSpeed(next);
      },
      setSpan: (span: SpanOverride | null) => handle.override(span ? spanOverrideOf(span) : null),
    }),
    [handle, latest],
  );
  return useMemo(
    () => ({ time, playing, loop, rate, span: { start: origin, end: origin + duration }, ...actions }),
    [time, playing, loop, rate, origin, duration, actions],
  );
}
