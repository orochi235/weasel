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
});
