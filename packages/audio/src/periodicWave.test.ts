import { describe, expect, it } from 'vitest';
import { PERIODIC_WAVE_CACHE, periodicWave } from './periodicWave';
import { createFakeAudioContext } from './testing/fakeAudioContext';

describe('periodicWave', () => {
  it('shares one wave between levels that differ only in scale', () => {
    const ctx = createFakeAudioContext() as never as BaseAudioContext;
    expect(periodicWave(ctx, [2, 1])).toBe(periodicWave(ctx, [1, 0.5]));
  });

  it('keeps only the most recently asked-for waves', () => {
    const ctx = createFakeAudioContext() as never as BaseAudioContext;
    const first = periodicWave(ctx, [1, 0]);
    const kept = periodicWave(ctx, [1, 1]);
    for (let i = 0; i < PERIODIC_WAVE_CACHE - 1; i += 1) {
      periodicWave(ctx, [1, i / PERIODIC_WAVE_CACHE + 0.001]);
      periodicWave(ctx, [1, 1]);
    }
    expect(periodicWave(ctx, [1, 1])).toBe(kept);
    expect(periodicWave(ctx, [1, 0])).not.toBe(first);
  });
});
