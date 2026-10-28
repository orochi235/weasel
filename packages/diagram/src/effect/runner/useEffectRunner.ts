import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { ClockHandle } from '@weasel-js/clock';
import { useVisibleRaf, type VisibleRafOptions } from '@weasel-js/react';
import { createEffectRunner, type EffectRunner, type EffectRunnerOptions, type EffectRunnerState } from './runner';

/** Options for `useEffectRunner`: the runner's, which it follows as they
 *  change, and how its play loop is gated and clocked. */
export interface UseEffectRunnerOptions extends EffectRunnerOptions, Pick<VisibleRafOptions, 'target' | 'requestFrame' | 'cancelFrame'> {
  /** A clock to play on instead of a frame loop of its own: the play time is
   *  its `elapsed`, so its rate, seeks and visibility gate move the runner,
   *  and its host's `useClockLoop` syncs it. The runner plays while the clock
   *  does, and `play` and `pause` set the clock's rate. `target`,
   *  `requestFrame` and `cancelFrame` then go unused. */
  clock?: ClockHandle;
}

/** What `useEffectRunner` returns: the runner's state, and the runner to drive. */
export interface EffectRunnerHandle extends EffectRunnerState {
  runner: EffectRunner;
}

/**
 * A runner for the life of the component. While it plays, every visible frame
 * advances its clock by the time since the last and starts a run once the last
 * has finished; time spent hidden does not count. Each run it hands back is
 * taken as drawn after the render that shows it, so the previews of the runs
 * before it are closed then. Given a `clock`, it plays on that instead.
 */
export function useEffectRunner(opts: UseEffectRunnerOptions): EffectRunnerHandle {
  const { pipeline, sources, evaluators, kinds, previews, previewSize, target, requestFrame, cancelFrame, clock } = opts;
  const [runner] = useState(() => createEffectRunner(opts));
  useEffect(() => { runner.setPipeline(pipeline); }, [runner, pipeline]);
  useEffect(() => { if (sources !== undefined) runner.setSources(sources); }, [runner, sources]);
  useEffect(() => {
    runner.setOptions({
      evaluators,
      ...(kinds !== undefined ? { kinds } : {}),
      ...(previews !== undefined ? { previews } : {}),
      ...(previewSize !== undefined ? { previewSize } : {}),
    });
  }, [runner, evaluators, kinds, previews, previewSize]);
  const state = useSyncExternalStore(runner.subscribe, () => runner.state);

  const last = useRef<number | null>(null);
  const loop = useVisibleRaf((now, self) => {
    if (!runner.state.playing) return;
    runner.advance(last.current === null ? 0 : (now - last.current) / 1000);
    last.current = now;
    self.request();
  }, {
    ...(target !== undefined ? { target } : {}),
    ...(requestFrame !== undefined ? { requestFrame } : {}),
    ...(cancelFrame !== undefined ? { cancelFrame } : {}),
    onResume: () => { last.current = null; },
  });
  useEffect(() => {
    last.current = null;
    if (state.playing && clock === undefined) loop.request();
    else loop.cancel();
  }, [state.playing, loop, clock]);

  useEffect(() => {
    if (clock === undefined) return;
    const c = clock.clock;
    const follow = () => {
      if (c.rate !== 0) runner.play();
      else runner.pause();
    };
    follow();
    if (runner.state.time !== c.elapsed / 1000) runner.seek(c.elapsed / 1000);
    const offClock = c.subscribe(follow);
    const offFrame = clock.onFrame((elapsed) => runner.seek(elapsed / 1000));
    const offRunner = runner.subscribe(() => {
      const { playing } = runner.state;
      if (playing !== (c.rate !== 0)) c.rate = playing ? c.speed : 0;
    });
    return () => { offClock(); offFrame(); offRunner(); };
  }, [runner, clock]);

  useEffect(() => { runner.drawn(state.run); }, [runner, state.run]);
  useEffect(() => () => runner.dispose(), [runner]);
  return { ...state, runner };
}
