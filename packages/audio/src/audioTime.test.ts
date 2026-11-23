import { describe, expect, it } from 'vitest';
import { afterRamp } from './audioTime';
import { createFakeAudioContext } from './testing/fakeAudioContext';

const timers = { setTimer: () => 1, clearTimer: () => {} };

describe('afterRamp', () => {
  it('stays canceled when it was armed while the context was suspended', () => {
    const ctx = createFakeAudioContext();
    let ran = 0;
    const cancel = afterRamp(ctx as never, timers, 1, () => { ran++; });
    cancel();
    expect(ctx._listenerCount()).toBe(0);
    ctx._setState('running');
    expect(ran).toBe(0);
  });

  it('waits out an interrupted context instead of ending the ramp', () => {
    const ctx = createFakeAudioContext();
    ctx.state = 'interrupted';
    let ran = 0;
    afterRamp(ctx as never, timers, 1, () => { ran++; });
    expect(ran).toBe(0);
    ctx._setState('suspended');
    expect(ran).toBe(0);
    ctx.currentTime = 1;
    ctx._setState('running');
    expect(ran).toBe(1);
  });

  it('ends the wait when the context closes', () => {
    const ctx = createFakeAudioContext();
    ctx.state = 'interrupted';
    let ran = 0;
    afterRamp(ctx as never, timers, 1, () => { ran++; });
    ctx._setState('closed');
    expect(ran).toBe(1);
  });
});
