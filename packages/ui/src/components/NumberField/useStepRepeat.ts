import { useEffect, useState, type RefObject } from 'react';
import { createStepRepeat, REPEAT_DELAY_MS, REPEAT_EVERY_MS, type StepRepeat } from '@weasel-js/headless';
import { useKitSetting, useLatest } from '@weasel-js/react';

type StepKey = 'ArrowUp' | 'ArrowDown';

/**
 * A held stepper: {@link createStepRepeat} timed by `numberField.repeatDelayMs` and `repeatEveryMs`. `spin`
 * steps and `spent` says a key has nowhere left to go; each is read through its ref at the moment of the step.
 */
export function useStepRepeat(
  spin: RefObject<(key: StepKey) => void>,
  spent: RefObject<(key: StepKey) => boolean>,
): Pick<StepRepeat<StepKey>, 'start' | 'stop'> {
  const delayMs = useLatest(useKitSetting('numberField.repeatDelayMs') ?? REPEAT_DELAY_MS);
  const everyMs = useLatest(useKitSetting('numberField.repeatEveryMs') ?? REPEAT_EVERY_MS);
  const [repeat] = useState(() => createStepRepeat<StepKey>((k) => spin.current(k), (k) => spent.current(k), {
    get delayMs() { return delayMs.current; },
    get everyMs() { return everyMs.current; },
  }));
  useEffect(() => repeat.stop, [repeat]);
  return repeat;
}
