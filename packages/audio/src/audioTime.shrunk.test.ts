import { describe, expect, it } from 'vitest';
import { atAudioTime } from './audioTime';
import { createFakeAudioContext } from './testing/fakeAudioContext';

describe('atAudioTime, shrunk from the property tests', () => {
  it('asks a timer for no more than a 32-bit count of ms for a time far ahead', () => {
    const ctx = createFakeAudioContext();
    ctx.state = 'running';
    const delays: number[] = [];
    atAudioTime(ctx as never, { setTimer: (_cb, ms) => { delays.push(ms); return 1; }, clearTimer: () => {} }, 1e9, () => {});
    expect(delays).toEqual([2 ** 31 - 1]);
  });
});
