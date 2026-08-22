import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAudioEngine } from './createAudioEngine';
import { createFakeAudioContext } from './testing/fakeAudioContext';

/** The engine's own `setTimer`/`clearTimer` defaults. Every other engine test
 *  injects them, which is how a repeating default timer under a scheduler that
 *  re-arms itself reached the published package. */
describe('createAudioEngine shipped timer defaults', () => {
  afterEach(() => { vi.useRealTimers(); });

  it('keeps one timer live however many passes run, and none after dispose', () => {
    vi.useFakeTimers();
    const ctx = createFakeAudioContext();
    const engine = createAudioEngine({ context: ctx as never });
    expect(vi.getTimerCount()).toBe(1);
    vi.advanceTimersByTime(25 * 8);
    expect(vi.getTimerCount()).toBe(1);
    engine.dispose();
    expect(vi.getTimerCount()).toBe(0);
  });
});
