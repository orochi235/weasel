import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStepRepeat } from './stepRepeat';

afterEach(() => { vi.useRealTimers(); });

describe('timerScheduler', () => {
  it('holds a stepper for the whole of a delay longer than one timer holds, and never repeats on an infinite one', () => {
    vi.useFakeTimers();
    for (const delayMs of [2 ** 31, Infinity]) {
      const step = vi.fn();
      const repeat = createStepRepeat(step, () => false, { delayMs });
      repeat.start('up');
      vi.advanceTimersByTime(1000);
      expect(step).toHaveBeenCalledTimes(1);
      repeat.stop();
    }
  });
});
