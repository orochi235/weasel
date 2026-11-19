import { describe, expect, it } from 'vitest';
import { createFakeAudioContext } from '../testing/fakeAudioContext';
import { createAudioGraph } from './createAudioGraph';

describe('createAudioGraph options', () => {
  it('refuses a fadeMs that is not finite or is negative', () => {
    const ctx = createFakeAudioContext();
    for (const fadeMs of [NaN, Infinity, -Infinity, -1]) {
      expect(() => createAudioGraph(ctx as never, ctx.destination as never, { fadeMs })).toThrow(RangeError);
    }
    expect(() => createAudioGraph(ctx as never, ctx.destination as never, { fadeMs: 0 })).not.toThrow();
  });
});
