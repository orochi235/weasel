import { describe, expect, it } from 'vitest';
import { transportHoldOf } from './transportHold';
import { createTrialClock } from './trialClock';

describe('transportHoldOf', () => {
  it('notifies nobody for a write of the speed and direction it holds, NaN included', () => {
    const hold = transportHoldOf(createTrialClock({ duration: 1000 }).clock);
    let calls = 0;
    hold.subscribe(() => {
      calls++;
    });
    hold.set({ speed: Number.NaN, backward: false });
    expect(calls).toBe(1);
    hold.set({ speed: Number.NaN, backward: false });
    hold.set({ ...hold.get() });
    expect(calls).toBe(1);
  });
});
