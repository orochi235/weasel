import { describe, expect, it } from 'vitest';
import { biquadCoefficients } from './biquad';

const finite = (c: object): boolean => Object.values(c).every(Number.isFinite);

describe('biquadCoefficients, shrunk from the property tests', () => {
  it('stays finite for a lowpass whose Q is so far below 0 dB that 10^(Q/20) underflows', () => {
    expect(finite(biquadCoefficients('lowpass', 0, 8000, -1e308, 0))).toBe(true);
  });

  it('stays finite for a gain past what a node takes, either way', () => {
    for (const type of ['peaking', 'lowshelf', 'highshelf'] as const) {
      expect(finite(biquadCoefficients(type, 1000, 48000, 1, 1e308))).toBe(true);
      expect(finite(biquadCoefficients(type, 1000, 48000, 1, -1e308))).toBe(true);
    }
  });
});
