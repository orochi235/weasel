import { describe, expect, it } from 'vitest';
import { createAudioEngine } from './createAudioEngine';
import { createScore } from './score';
import { scoreCues } from './scoreMood';
import { createFakeAudioContext } from './testing/fakeAudioContext';

describe('createScore, shrunk from the property tests', () => {
  it('reports the next bar, not the same one again, after a stall skips a bar\'s last step', async () => {
    const ctx = createFakeAudioContext();
    let pass: (() => void) | null = null;
    const engine = createAudioEngine({ context: ctx as never, setTimer: (cb) => { pass = cb; return 1; }, clearTimer: () => { pass = null; } });
    await engine.unlock();
    const flush = async () => { for (let i = 0; i < 5; i += 1) await Promise.resolve(); };
    const bars: number[] = [];
    // Dread is 60 bpm: 250 ms steps, 4000 ms bars.
    createScore(engine, { mood: scoreCues[0].mood, onBar: (s) => bars.push(s.bar) }).start(0);
    for (const ms of [938, 938, 938, 937, 1]) {
      await flush();
      ctx._advance(ms);
      const p = pass as (() => void) | null;
      pass = null;
      p?.();
      await flush();
    }
    expect(bars).toEqual([0, 1]);
  });
});
