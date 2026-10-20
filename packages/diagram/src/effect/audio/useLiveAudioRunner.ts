import { useEffect, useState, useSyncExternalStore } from 'react';
import { useVisibleRaf, type VisibleRafOptions } from '@weasel-js/react';
import { createLiveAudioRunner, type LiveAudioRunner, type LiveAudioRunnerOptions, type LiveAudioRunnerState } from './liveRunner';
import type { AudioPreview } from './scope';

/** Options for `useLiveAudioRunner`: the runner's, which it follows as they change, and how its preview loop is gated. */
export interface UseLiveAudioRunnerOptions
  extends LiveAudioRunnerOptions, Pick<VisibleRafOptions, 'target' | 'requestFrame' | 'cancelFrame'> {
  previews: AudioPreview;
}

/** What `useLiveAudioRunner` returns: the runner's state, and the runner to drive. */
export interface LiveAudioRunnerHandle extends LiveAudioRunnerState {
  runner: LiveAudioRunner;
}

/**
 * A runner for the life of the component, following `pipeline`, `sources` and `previews`. While it plays
 * with previews on, every visible frame draws them anew. Each run it hands back is taken as drawn after
 * the render that shows it, so the previews of the runs before it are closed then. The engine is the caller's.
 */
export function useLiveAudioRunner(opts: UseLiveAudioRunnerOptions): LiveAudioRunnerHandle {
  const { pipeline, sources, previews, target, requestFrame, cancelFrame } = opts;
  const [runner] = useState(() => createLiveAudioRunner(opts));
  useEffect(() => { runner.setPipeline(pipeline); }, [runner, pipeline]);
  useEffect(() => { if (sources !== undefined) runner.setSources(sources); }, [runner, sources]);
  useEffect(() => { runner.setPreviews(previews); }, [runner, previews]);
  const state = useSyncExternalStore(runner.subscribe, () => runner.state);

  const loop = useVisibleRaf((_now, self) => {
    if (!runner.state.playing || previews === 'off') return;
    runner.frame();
    self.request();
  }, {
    ...(target !== undefined ? { target } : {}),
    ...(requestFrame !== undefined ? { requestFrame } : {}),
    ...(cancelFrame !== undefined ? { cancelFrame } : {}),
  });
  useEffect(() => {
    if (state.playing && previews !== 'off') loop.request();
    else loop.cancel();
  }, [state.playing, previews, loop]);

  useEffect(() => { runner.drawn(state.run); }, [runner, state.run]);
  useEffect(() => () => runner.dispose(), [runner]);
  return { ...state, runner };
}
