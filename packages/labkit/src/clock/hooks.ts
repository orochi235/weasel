import { useLatest } from '@weasel-js/core';
import { useContext, useEffect, useReducer, useSyncExternalStore } from 'react';
import { LabContext } from '../lab/LabContext';
import { ClockRegistryContext, TrialClockContext } from './clockRegistry';
import type { ClockedMix, TrialClock, TrialClockHandle } from './trialClock';

const NO_SUBSCRIBE = () => () => {};

/**
 * A trial's clock: `trialId`'s, else the one of the trial this renders inside,
 * else the lab's focused trial's, else the lab's own. `null` when there is none.
 * Re-renders on rate, seek and loop changes, never per frame — read `elapsed`
 * per frame through {@link useClockFrame}.
 */
export function useTrialClock(trialId?: string): TrialClock | null {
  const clock = useTrialClockHandle(trialId)?.clock ?? null;
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => clock?.subscribe(bump), [clock]);
  return clock;
}

/**
 * The blits mix the trial's `clock.mix` made, resolved as {@link useTrialClock};
 * `null` when it declares none. Probe it per frame inside {@link useClockFrame}
 * or a `timed` layer, which run after the mix has followed the clock.
 */
export function useTrialMix<M extends ClockedMix = ClockedMix>(trialId?: string): M | null {
  return (useTrialClockHandle(trialId)?.mix ?? null) as M | null;
}

/** The handle behind {@link useTrialClock}, resolved the same way; re-renders
 *  only when which handle that is changes. */
export function useTrialClockHandle(trialId?: string): TrialClockHandle | null {
  const registry = useContext(ClockRegistryContext);
  const own = useContext(TrialClockContext);
  const lab = useContext(LabContext);
  useSyncExternalStore(registry?.subscribe ?? NO_SUBSCRIBE, () => (registry ? resolve() : own));
  function resolve() {
    if (trialId !== undefined) return registry?.get(trialId) ?? null;
    if (own) return own;
    const focused = lab?.focusedTrialId;
    return (focused ? registry?.get(focused) : null) ?? registry?.lab ?? null;
  }
  return resolve();
}

/**
 * Run `fn` after each frame a clock moves, with its `elapsed` and `pass`,
 * outside React's render — for a renderer that draws imperatively, or text that
 * changes every frame written into a ref. The clock is resolved as
 * {@link useTrialClock}, so a lab-level readout follows one too.
 */
export function useClockFrame(fn: (elapsed: number, pass: number) => void, trialId?: string): void {
  const handle = useTrialClockHandle(trialId);
  const latest = useLatest(fn);
  useEffect(
    () => handle?.onFrame((elapsed, pass) => latest.current(elapsed, pass)),
    [handle, latest],
  );
}
