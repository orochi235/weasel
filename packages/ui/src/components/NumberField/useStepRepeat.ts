import { useEffect, useRef, type RefObject } from 'react';
import { useKitSetting } from '@weasel-js/react';

export const REPEAT_DELAY_MS = 400;
export const REPEAT_EVERY_MS = 60;

type StepKey = 'ArrowUp' | 'ArrowDown';

/**
 * A held stepper: one step at once, then after a delay one at every interval until `stop`. `spin` steps and
 * `spent` says a key has nowhere left to go; each is read through its ref at the moment of the step.
 */
export function useStepRepeat(
  spin: RefObject<(key: StepKey) => void>,
  spent: RefObject<(key: StepKey) => boolean>,
): { start(key: StepKey): void; stop(): void } {
  const delayMs = useKitSetting('numberField.repeatDelayMs') ?? REPEAT_DELAY_MS;
  const everyMs = useKitSetting('numberField.repeatEveryMs') ?? REPEAT_EVERY_MS;
  const repeat = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stop = () => {
    if (repeat.current !== null) clearTimeout(repeat.current);
    repeat.current = null;
  };
  useEffect(() => stop, []);
  const start = (key: StepKey) => {
    stop();
    spin.current(key);
    const tick = (delay: number) => {
      repeat.current = setTimeout(() => {
        // At a bound the button is disabled while still held, and a disabled
        // button may never hear the release that would end the repeat.
        if (spent.current(key)) return stop();
        spin.current(key);
        tick(everyMs);
      }, delay);
    };
    tick(delayMs);
  };
  return { start, stop };
}
