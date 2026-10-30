import { useEffect, useRef } from 'react';
import { useKitSetting, useLatest } from '@weasel-js/react';

/** How long typing rests before a field that settles when idle commits its draft. */
export const IDLE_SETTLE_MS = 800;

/**
 * A timer that runs `settle` once typing has rested for the `typing.idleMs` kit setting, for a field holding a
 * draft that otherwise settles on blur or Enter. `typed` restarts it on each keystroke and `stop` drops it. It runs
 * only where `enabled`, else the `typing.settleWhenIdle` kit setting, says so; off by default, since each
 * commit may be an undo step.
 */
export function useIdleSettle(settle: () => void, enabled?: boolean): { typed(): void; stop(): void } {
  const kitOn = useKitSetting('typing.settleWhenIdle');
  const on = enabled ?? kitOn ?? false;
  const ms = useKitSetting('typing.idleMs') ?? IDLE_SETTLE_MS;
  const latest = useLatest(settle);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = (): void => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stop, []);
  return {
    typed: () => {
      stop();
      if (on) timer.current = setTimeout(() => {
        timer.current = null;
        latest.current();
      }, ms);
    },
    stop,
  };
}
