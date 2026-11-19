import { describe, expect, it } from 'vitest';
import { createFakeAudioContext } from '../testing/fakeAudioContext';
import { createAudioGraph } from './createAudioGraph';

describe('createAudioGraph misuse', () => {
  it('refuses a fade that is not a finite length of zero or more', () => {
    const ctx = createFakeAudioContext();
    ctx.state = 'running';
    for (const fadeMs of [NaN, Infinity, -Infinity, -1]) {
      expect(() => createAudioGraph(ctx as never, ctx.destination as never, { fadeMs })).toThrow(RangeError);
    }
    expect(() => createAudioGraph(ctx as never, ctx.destination as never, { fadeMs: 0 })).not.toThrow();
  });
});
