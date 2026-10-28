import { useLayoutEffect, useMemo, useRef } from 'react';
import { useLatest, useVisibleRaf } from '@weasel-js/react';
import { createClockSteps } from './clockSteps';
import type { UseSimulationOptions } from './types';

/** ms of clock time per step when the clock declares no `step`: one a frame at 60fps, as the
 *  frame loop steps it. */
const DEFAULT_STEP_MS = 1000 / 60;

/** What runs a simulation's steps: its own frame loop, or `opts.clock`. */
export interface Steps {
  /** Steps from here on; time on a clock spent stopped owes none. */
  start(): void;
  stop(): void;
}

/**
 * Runs `step` once a frame on a loop of its own, or on `opts.clock`'s frames once per `step` ms
 * of its time, until it answers false or `stop` is called.
 */
export function useSteps(
  opts: Pick<UseSimulationOptions<never>, 'clock' | 'requestFrame' | 'cancelFrame'>,
  step: () => boolean,
): Steps {
  const stepRef = useLatest(step);
  const { clock } = opts;

  // The loop runs behind the visibility gate: a settling simulation stops
  // integrating on a page nobody is looking at, and picks up where it left off.
  // Its step is fixed rather than time-based, so there is no clock to rebase.
  // The gate defaults an absent clock to `requestAnimationFrame`, so an
  // injected one passes straight through rather than being defaulted twice.
  const frameLoop = useVisibleRaf(
    (_t, loop) => { if (stepRef.current()) loop.request(); },
    {
      requestFrame: opts.requestFrame,
      cancelFrame: opts.cancelFrame,
    },
  );

  const running = useRef(false);
  const owed = useRef(createClockSteps()).current;
  useLayoutEffect(() => {
    if (!clock) return;
    return clock.onFrame((elapsed) => {
      const n = owed.owed(elapsed, clock.step ?? DEFAULT_STEP_MS);
      for (let i = 0; i < n && running.current; i++) {
        if (!stepRef.current()) running.current = false;
      }
    });
  }, [clock, owed, stepRef]);

  return useMemo(() => ({
    start() {
      if (!clock) {
        frameLoop.request();
        return;
      }
      if (!running.current) owed.rebase(clock.clock.elapsed);
      running.current = true;
    },
    stop() {
      frameLoop.cancel();
      running.current = false;
    },
  }), [clock, frameLoop, owed]);
}
