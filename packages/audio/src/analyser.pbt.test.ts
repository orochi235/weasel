/**
 * Properties of the analyser tap over any spectrum and waveform bytes, any band count, and an `fftSize` changed
 * under the tap: every band and level is finite and in 0..1; a band per bin is the bin; one band is the mean of
 * every bin; bands that split the bins evenly average to the same mean (a metamorphic rule); and the level is the
 * RMS of the window it reads.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createAnalyserTap } from './analyser';
import { createFakeAudioContext } from './testing/fakeAudioContext';
import { runs, timeoutFor } from './pbt.fixture';

const fft = fc.constantFrom(32, 64, 128, 256, 512, 2048);
const bytes = fc.array(fc.integer({ min: 0, max: 255 }), { minLength: 1, maxLength: 64 });

function tapOver(size: number, pattern: number[]) {
  const ctx = createFakeAudioContext();
  ctx._analyserBytes = (i) => pattern[i % pattern.length];
  const tap = createAnalyserTap(ctx as never, ctx.createGain() as never, { fftSize: size });
  return { tap, ctx };
}

describe('the analyser tap', () => {
  it('reads bands in 0..1 whose evenly split means agree, a band per bin as the bin and one band as the mean', () => {
    fc.assert(fc.property(fft, bytes, fc.integer({ min: 1, max: 2048 }), (size, pattern, n) => {
      const { tap } = tapOver(size, pattern);
      const bins = Array.from(tap.frequencies());
      const mean = bins.reduce((a, b) => a + b, 0) / bins.length / 255;
      const b = tap.bands(n);
      expect(b.length).toBe(n);
      for (const v of b) {
        expect(Number.isFinite(v)).toBe(true);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
      expect(Array.from(tap.bands(bins.length))).toEqual(bins.map((x) => Math.fround(x / 255)));
      expect(tap.bands(1)[0]).toBeCloseTo(mean, 6);
      if (bins.length % n === 0) {
        expect(b.reduce((s, v) => s + v, 0) / n).toBeCloseTo(mean, 5);
      }
    }), runs(300));
  }, timeoutFor(300, 10));

  it('reads a level in 0..1 that is the RMS of its window, after any fftSize change under it', () => {
    fc.assert(fc.property(fft, fft, bytes, (size, later, pattern) => {
      const { tap } = tapOver(size, pattern);
      tap.level();
      tap.node.fftSize = later;
      const level = tap.level();
      const wave = Array.from(tap.waveform());
      expect(wave.length).toBe(later);
      const rms = Math.sqrt(wave.reduce((s, x) => s + ((x - 128) / 128) ** 2, 0) / wave.length);
      expect(level).toBeCloseTo(rms, 12);
      expect(level).toBeGreaterThanOrEqual(0);
      expect(level).toBeLessThanOrEqual(1);
      expect(tap.bands(4).length).toBe(4);
      expect(tap.frequencies().length).toBe(later / 2);
    }), runs(300));
  });
});
