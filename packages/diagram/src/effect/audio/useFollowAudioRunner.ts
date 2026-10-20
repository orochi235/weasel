import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useVisibleRaf, type VisibleRafOptions } from '@weasel-js/react';
import type { EffectPipeline } from '../types';
import { errorsRun, type LiveAudioRunner, type LiveAudioRunnerState } from './liveRunner';
import { audioStageNodes, type AudioSources, type AudioStageNodes } from './nodes';
import { livePlan } from './plan';
import type { AudioPreview } from './scope';

/** What `useFollowAudioRunner` keeps a runner following, and how its preview loop is gated. */
export interface FollowAudioRunnerOptions extends Pick<VisibleRafOptions, 'target' | 'requestFrame' | 'cancelFrame'> {
  pipeline: EffectPipeline;
  sources?: AudioSources;
  previews: AudioPreview;
  /** The nodes the plan is read with while there is no runner. */
  nodes?: AudioStageNodes;
}

const noSubscribe = () => () => {};

/**
 * Keeps a caller-owned `runner` following `pipeline`, `sources` and `previews`, draws its previews every
 * visible frame while it plays, and closes the bitmaps of runs no render shows. While `runner` is null,
 * the run holds the plan's errors, so a stage that cannot play says why before any engine exists.
 */
export function useFollowAudioRunner(runner: LiveAudioRunner | null, opts: FollowAudioRunnerOptions): LiveAudioRunnerState {
  const { pipeline, sources, previews, nodes, target, requestFrame, cancelFrame } = opts;
  useEffect(() => { runner?.setPipeline(pipeline); }, [runner, pipeline]);
  useEffect(() => { if (sources !== undefined) runner?.setSources(sources); }, [runner, sources]);
  useEffect(() => { runner?.setPreviews(previews); }, [runner, previews]);
  const live = useSyncExternalStore(runner?.subscribe ?? noSubscribe, () => runner?.state ?? null);
  const planned = useMemo(
    () => (runner !== null ? undefined : errorsRun(livePlan(pipeline, nodes ?? audioStageNodes, sources ?? {}).errors)),
    [runner, pipeline, nodes, sources],
  );
  const playing = live?.playing ?? false;

  const loop = useVisibleRaf((_now, self) => {
    if (runner === null || !runner.state.playing || previews === 'off') return;
    runner.frame();
    self.request();
  }, {
    ...(target !== undefined ? { target } : {}),
    ...(requestFrame !== undefined ? { requestFrame } : {}),
    ...(cancelFrame !== undefined ? { cancelFrame } : {}),
  });
  useEffect(() => {
    if (playing && previews !== 'off') loop.request();
    else loop.cancel();
  }, [playing, previews, loop]);

  useEffect(() => { runner?.drawn(live?.run); }, [runner, live?.run]);
  return live ?? { run: planned, playing: false };
}
