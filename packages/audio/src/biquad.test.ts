import { describe, expect, it } from 'vitest';
import { biquadCoefficients, biquadResponseDb } from './biquad';

const RATE = 48000;
const at = (type: BiquadFilterType, hz: number, Q = 1, gain = 0, cutoff = 1000): number =>
  biquadResponseDb(biquadCoefficients(type, cutoff, RATE, Q, gain), hz, RATE);

describe('biquadCoefficients', () => {
  it('a lowpass at 0 dB of resonance is level at its cutoff and passes what is below', () => {
    expect(at('lowpass', 1000, 0)).toBeCloseTo(0, 3);
    expect(at('lowpass', 1000, -3.01)).toBeCloseTo(-3.01, 2);
    expect(at('lowpass', 50, 0)).toBeCloseTo(0, 1);
    expect(at('lowpass', 8000, 0)).toBeLessThan(-30);
  });

  it('reads a lowpass Q as dB of resonance at the cutoff', () => {
    expect(at('lowpass', 1000, 12)).toBeCloseTo(12, 0);
  });

  it('a highpass mirrors it', () => {
    expect(at('highpass', 1000, -3.01)).toBeCloseTo(-3.01, 2);
    expect(at('highpass', 12000, 0)).toBeCloseTo(0, 1);
    expect(at('highpass', 100, 0)).toBeLessThan(-30);
  });

  it('a bandpass passes its center and narrows as Q rises', () => {
    expect(at('bandpass', 1000, 1)).toBeCloseTo(0, 3);
    expect(at('bandpass', 2000, 8)).toBeLessThan(at('bandpass', 2000, 1));
  });

  it('a notch removes its center and an allpass removes nothing', () => {
    expect(at('notch', 1000, 4)).toBeLessThan(-60);
    expect(at('allpass', 1000, 4)).toBeCloseTo(0, 6);
    expect(at('allpass', 300, 4)).toBeCloseTo(0, 6);
  });

  it('a peaking filter lifts its center by its gain and leaves the far ends', () => {
    expect(at('peaking', 1000, 1, 6)).toBeCloseTo(6, 3);
    expect(at('peaking', 20, 1, 6)).toBeCloseTo(0, 1);
  });

  it('shelves lift their own side by the gain', () => {
    expect(at('lowshelf', 20, 1, 9)).toBeCloseTo(9, 1);
    expect(at('lowshelf', 20000, 1, 9)).toBeCloseTo(0, 1);
    expect(at('highshelf', 20000, 1, -9)).toBeCloseTo(-9, 1);
    expect(at('highshelf', 20, 1, -9)).toBeCloseTo(0, 1);
  });

  it('stays finite for a cutoff at or past either end', () => {
    for (const hz of [0, -50, RATE / 2, RATE]) {
      const c = biquadCoefficients('lowpass', hz, RATE);
      expect(Object.values(c).every(Number.isFinite)).toBe(true);
    }
  });
});
