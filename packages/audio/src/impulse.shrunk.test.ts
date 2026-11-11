import { describe, expect, it } from 'vitest';
import { impulseResponse } from './impulse';
import { createFakeAudioContext } from './testing/fakeAudioContext';

describe('impulseResponse, shrunk from the property tests', () => {
  it('refuses a channel count that is not a whole number above 0 with its own RangeError', () => {
    const ctx = createFakeAudioContext();
    expect(() => impulseResponse(ctx as never, 5e-324, { channels: 0 })).toThrow(/^@weasel-js\/audio: /);
    expect(() => impulseResponse(ctx as never, 0.01, { channels: 1.5 })).toThrow(RangeError);
  });

  it('refuses an endless length, and a decay that is not finite or rises past float32', () => {
    const ctx = createFakeAudioContext();
    expect(() => impulseResponse(ctx as never, Infinity)).toThrow(/^@weasel-js\/audio: /);
    expect(() => impulseResponse(ctx as never, 0.01, { decayDb: Infinity })).toThrow(RangeError);
    expect(() => impulseResponse(ctx as never, 0.01, { decayDb: -771 })).toThrow(RangeError);
    const data = impulseResponse(ctx as never, 0.01, { decayDb: -770 }).getChannelData(0);
    expect(data.every(Number.isFinite)).toBe(true);
  });
});
