import { describe, expect, it } from 'vitest';
import { powerSpectrum, rmsEnvelope } from './spectrum';

describe('powerSpectrum', () => {
  it('refuses a frame size that is not a power of two', () => {
    const x = new Float32Array(4096);
    expect(() => powerSpectrum(x, 48000, 1000)).toThrow(RangeError);
    expect(() => powerSpectrum(x, 48000, 1)).toThrow(RangeError);
    expect(() => powerSpectrum(x, 48000, 0)).toThrow(RangeError);
    expect(powerSpectrum(x, 48000, 1024).power).toHaveLength(512);
  });
});
