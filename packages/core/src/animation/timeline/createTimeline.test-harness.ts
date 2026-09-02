import { createTimeline, type TimelineRegister } from './createTimeline';
import type { SampledTrack, TimelineHandle, TimelineOptions } from './types';

/** A trivial two-key sampled track, for tests that only care about timing. */
export const numberTrack = (onTick: (v: number) => void): SampledTrack<number> => ({
  kind: 'sampled',
  keys: [{ t: 0, value: 0 }, { t: 100, value: 100 }],
  onTick,
});

export interface TimelineTestHandle {
  handle: TimelineHandle;
  /** Feed a virtual clock reading to the timeline's registered tick. A no-op
   *  returning the last finished state once the timeline has parked and
   *  nothing has re-registered it — mirroring a real animator, which drops a
   *  finished entry from its active set instead of ticking it forever. */
  advance: (virtualNow: number) => boolean;
  isCancelled: () => boolean;
  isPaused: () => boolean;
}

export type MakeTimelineOptions = Omit<TimelineOptions, 'tracks'> & {
  tracks?: TimelineOptions['tracks'];
};

/** Drives a `createTimeline` instance through a fake `register`, standing in
 *  for the animator. The one clock driver shared by every timeline test. */
export function makeTimeline(opts: MakeTimelineOptions): TimelineTestHandle {
  let tick: ((virtualNow: number) => boolean) | null = null;
  let onCancel: (() => void) | undefined;
  let active = false;
  let lastFinished = false;
  let cancelled = false;
  let paused = false;

  const register: TimelineRegister = (seed) => {
    tick = seed.tick;
    onCancel = seed.onCancel;
    active = true;
    return {
      id: seed.id,
      cancel: () => { cancelled = true; active = false; onCancel?.(); },
      pause: () => { paused = true; },
      resume: () => { paused = false; },
      setTimeScale: () => {},
      isPaused: () => paused,
    };
  };

  const handle = createTimeline(register, 1, {
    ...opts,
    tracks: opts.tracks ?? [numberTrack(() => {})],
  });

  return {
    handle,
    advance: (virtualNow: number): boolean => {
      if (!active) return lastFinished;
      lastFinished = tick!(virtualNow);
      if (lastFinished) active = false;
      return lastFinished;
    },
    isCancelled: () => cancelled,
    isPaused: () => paused,
  };
}
