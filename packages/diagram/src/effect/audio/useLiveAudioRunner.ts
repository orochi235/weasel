import { useEffect, useState } from 'react';
import { useLatest } from '@weasel-js/react';
import { createLiveAudioRunner, type LiveAudioRunner, type LiveAudioRunnerOptions, type LiveAudioRunnerState } from './liveRunner';
import { useFollowAudioRunner, type FollowAudioRunnerOptions } from './useFollowAudioRunner';

/** Options for `useLiveAudioRunner`: the runner's, which it follows as they change, and how its preview loop is gated. */
export interface UseLiveAudioRunnerOptions
  extends LiveAudioRunnerOptions, Pick<FollowAudioRunnerOptions, 'previews' | 'target' | 'requestFrame' | 'cancelFrame'> {}

/** What `useLiveAudioRunner` returns: the runner's state, and the runner to drive, null until it mounts. */
export interface LiveAudioRunnerHandle extends LiveAudioRunnerState {
  runner: LiveAudioRunner | null;
}

/**
 * A runner made on mount and remade when `engine`, `bus` or `nodes` change, following `pipeline`,
 * `sources` and `previews` through `useFollowAudioRunner`, and disposed on unmount. Before the first
 * mount the runner is null and the run holds the plan's errors. The engine is the caller's.
 */
export function useLiveAudioRunner(opts: UseLiveAudioRunnerOptions): LiveAudioRunnerHandle {
  const { engine, bus, nodes } = opts;
  const latest = useLatest(opts);
  const [runner, setRunner] = useState<LiveAudioRunner | null>(null);
  useEffect(() => {
    const { pipeline, sources } = latest.current;
    const made = createLiveAudioRunner({
      engine, pipeline,
      ...(nodes !== undefined ? { nodes } : {}),
      ...(sources !== undefined ? { sources } : {}),
      ...(bus !== undefined ? { bus } : {}),
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect -- publishes the runner this effect creates
    setRunner(made);
    return () => made.dispose();
  }, [engine, bus, nodes, latest]);
  const state = useFollowAudioRunner(runner, opts);
  return { ...state, runner };
}
