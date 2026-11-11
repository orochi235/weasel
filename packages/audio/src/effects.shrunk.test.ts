import { describe, expect, it } from 'vitest';
import { createDelayEffect } from './effects';
import { delayNode } from './graph/processors';
import { createFakeAudioContext } from './testing/fakeAudioContext';

describe('the delay insert, shrunk from the property tests', () => {
  it('refuses a line longer than a DelayNode takes, or as good as none, with its own RangeError', () => {
    const ctx = createFakeAudioContext();
    expect(() => createDelayEffect(ctx as never, { time: 0, maxTime: 180_001 })).toThrow(/^@weasel-js\/audio: /);
    expect(() => createDelayEffect(ctx as never, { maxTime: 5e-324, time: 5e-324 })).toThrow(RangeError);
    expect(() => delayNode(ctx as never, { time: 200_000 })).toThrow(RangeError);
    expect(() => createDelayEffect(ctx as never, { time: 180_000 })).toThrow(RangeError);
    expect(() => createDelayEffect(ctx as never, { time: 179_999 })).not.toThrow();
  });
});
