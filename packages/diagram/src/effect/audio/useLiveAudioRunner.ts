import { useEffect, useState } from 'react';
import { useLatest, useStableByContent } from '@weasel-js/react';
import { createLiveAudioRunner, type LiveAudioRunner, type LiveAudioRunnerOptions, type LiveAudioRunnerState } from './liveRunner';
import type { AudioStageNodes } from './nodes';
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
 * mount the runner is null and the run holds the plan's errors. The engine is the caller's. `nodes`
 * counts as changed only when a type is added, dropped or given a different node, so it can be built in render.
 */
export function useLiveAudioRunner(opts: UseLiveAudioRunnerOptions): LiveAudioRunnerHandle {
  const { engine, bus } = opts;
  const nodes = useStableByContent(opts.nodes, sameNodes);
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
  const state = useFollowAudioRunner(runner, { ...opts, ...(nodes !== undefined ? { nodes } : {}) });
  return { ...state, runner };
}

function sameNodes(a: AudioStageNodes | undefined, b: AudioStageNodes | undefined): boolean {
  if (a === undefined || b === undefined) return a === b;
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => Object.hasOwn(b, k) && a[k] === b[k]);
}
