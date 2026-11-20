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

  it("follows the clock's declared speed until a transport sets one", () => {
    const handle = createTrialClock({ duration: 1000 });
    const hold = transportHoldOf(handle.clock);
    handle.declare({ duration: 1000, speed: 2 });
    expect(hold.get().speed).toBe(2);
    hold.set({ speed: 0.5, backward: false });
    handle.declare({ duration: 1000, speed: 4 });
    expect(hold.get().speed).toBe(0.5);
  });

  it('keeps a direction set on it when it follows the speed', () => {
    const handle = createTrialClock({ duration: 1000 });
    const hold = transportHoldOf(handle.clock);
    hold.set({ speed: 1, backward: true });
    handle.declare({ duration: 1000, speed: 2 });
    expect(hold.get()).toMatchObject({ speed: 2, backward: true });
  });
});
