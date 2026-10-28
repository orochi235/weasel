import { useEffect, useReducer, useSyncExternalStore } from 'react';
import { useTrialClock, useTrialClockHandle } from './hooks';
import { type TransportControl, transportControl } from './transportControl';
import { type TransportHold, transportHoldOf } from './transportHold';

const NO_SUBSCRIBE = () => () => {};
const NO_HOLD: TransportHold = { speed: 1, backward: false, touched: false };

/**
 * The transport control over a trial's clock, resolved as {@link useTrialClock};
 * `null` when there is none. Re-renders on every frame the clock moves, and each
 * action marks the clock as worked by hand before it acts. A `trialId` of `null`
 * resolves no clock, for a caller that needs the control only some of the time.
 */
export function useTransportControl(trialId?: string | null): TransportControl | null {
  const clock = useTrialClock(trialId);
  const handle = useTrialClockHandle(trialId);
  const [, frame] = useReducer((n: number) => n + 1, 0);
  useEffect(() => handle?.onFrame(frame), [handle]);

  const hold = clock ? transportHoldOf(clock) : null;
  const held = useSyncExternalStore(hold?.subscribe ?? NO_SUBSCRIBE, () => hold?.get() ?? NO_HOLD);
  if (!clock || !hold) return null;
  const control = transportControl(clock, held, hold.set, hold.touch);
  const touching =
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A): void => {
      hold.touch();
      fn(...args);
    };
  return {
    ...control,
    play: touching(control.play),
    pause: touching(control.pause),
    toggle: touching(control.toggle),
    setSpeed: touching(control.setSpeed),
    stepSpeed: touching(control.stepSpeed),
    setBackward: touching(control.setBackward),
    seek: touching(control.seek),
  };
}
