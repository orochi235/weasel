import { useLatest } from '@weasel-js/core';
import { useContext, useEffect, useReducer, useSyncExternalStore } from 'react';
import { LabContext } from '../lab/LabContext';
import { ClockRegistryContext, TrialClockContext } from './clockRegistry';
import type { TrialClock } from './trialClock';

const NO_SUBSCRIBE = () => () => {};

/**
 * A trial's clock: `trialId`'s, else the one of the trial this renders inside,
 * else the lab's focused trial's. `null` when that trial declares no clock.
 * Re-renders on rate, seek and loop changes, never per frame — read `elapsed`
 * per frame through {@link useClockFrame}.
 */
export function useTrialClock(trialId?: string): TrialClock | null {
  const registry = useContext(ClockRegistryContext);
  const own = useContext(TrialClockContext);
  const lab = useContext(LabContext);
  useSyncExternalStore(registry?.subscribe ?? NO_SUBSCRIBE, () => (registry ? resolve() : own));
  function resolve() {
    if (trialId !== undefined) return registry?.get(trialId) ?? null;
    if (own) return own;
    const focused = lab?.focusedTrialId;
    return focused ? (registry?.get(focused) ?? null) : null;
  }
  const clock = resolve()?.clock ?? null;
  const [, bump] = useReducer((n: number) => n + 1, 0);
  useEffect(() => clock?.subscribe(bump), [clock]);
  return clock;
}

/**
 * Run `fn` after each frame the clock of the trial this renders inside moves,
 * with its `elapsed` and `pass`, outside React's render — for a renderer that
 * draws imperatively, or text that changes every frame written into a ref.
 */
export function useClockFrame(fn: (elapsed: number, pass: number) => void): void {
  const handle = useContext(TrialClockContext);
  const latest = useLatest(fn);
  useEffect(
    () => handle?.onFrame((elapsed, pass) => latest.current(elapsed, pass)),
    [handle, latest],
  );
}
