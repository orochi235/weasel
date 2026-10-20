import { useEffect, useState } from 'react';
import { createLiveAudioRunner, type LiveAudioRunner, type LiveAudioRunnerOptions, type LiveAudioRunnerState } from './liveRunner';
import { useFollowAudioRunner, type FollowAudioRunnerOptions } from './useFollowAudioRunner';

/** Options for `useLiveAudioRunner`: the runner's, which it follows as they change, and how its preview loop is gated. */
export interface UseLiveAudioRunnerOptions
  extends LiveAudioRunnerOptions, Pick<FollowAudioRunnerOptions, 'previews' | 'target' | 'requestFrame' | 'cancelFrame'> {}

/** What `useLiveAudioRunner` returns: the runner's state, and the runner to drive. */
export interface LiveAudioRunnerHandle extends LiveAudioRunnerState {
  runner: LiveAudioRunner;
}

/**
 * A runner for the life of the component, following `pipeline`, `sources` and `previews` through
 * `useFollowAudioRunner`, and disposed on unmount. The engine is the caller's.
 */
export function useLiveAudioRunner(opts: UseLiveAudioRunnerOptions): LiveAudioRunnerHandle {
  const [runner] = useState(() => createLiveAudioRunner(opts));
  const state = useFollowAudioRunner(runner, opts);
  useEffect(() => () => runner.dispose(), [runner]);
  return { ...state, runner };
}
