import { describe, expect, it } from 'vitest';
import { periodicWave } from './periodicWave';
import { createFakeAudioContext } from './testing/fakeAudioContext';
import { renderNote } from './voiceKernel';

describe('harmonic waves, shrunk from the property tests', () => {
  it('render a wave whose levels sit at either end of the double range as the same finite wave', () => {
    const plain = renderNote({ pitch: 20, wave: [1, 0.5], duration: 10 }, 8000);
    for (const scale of [5e-324 / 0.5, 1e308]) {
      const out = renderNote({ pitch: 20, wave: [scale, scale * 0.5], duration: 10 }, 8000);
      expect(out.every(Number.isFinite)).toBe(true);
      expect(Array.from(out)).toEqual(Array.from(plain));
    }
    expect(renderNote({ pitch: 20, wave: [5e-324], duration: 10 }, 8000).every(Number.isFinite)).toBe(true);
  });

  it('hand a PeriodicWave levels scaled into float32 range', () => {
    const ctx = createFakeAudioContext();
    const wave = periodicWave(ctx as never, [1e300, 5e299]) as never as { imag: Float32Array };
    expect([...wave.imag]).toEqual([0, 1, 0.5]);
  });
});
