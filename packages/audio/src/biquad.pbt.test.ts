/**
 * Biquad coefficients for every filter type: finite for any finite parameters in a node's ranges, stable (both
 * poles strictly inside the unit circle) wherever the cutoff sits inside the band, written into `into` exactly
 * as returned fresh, and passing what each type promises: an allpass is flat, a lowpass passes DC whole, and a
 * peaking filter lifts its center by its gain.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { biquadCoefficients, biquadResponseDb, type BiquadCoefficients } from './biquad';
import { anyFinite, runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 500;
const TYPES: BiquadFilterType[] = ['lowpass', 'highpass', 'bandpass', 'lowshelf', 'highshelf', 'peaking', 'notch', 'allpass'];
const type = fc.constantFrom(...TYPES);
const rate = fc.oneof(fc.constantFrom(8000, 22050, 44100, 48000, 96000, 192000), fc.integer({ min: 3000, max: 768000 }));
/** A `BiquadFilterNode`'s gain reaches 40·log10 of float32's largest value. */
const NODE_GAIN = 40 * Math.log10(3.4028234663852886e38);
const gain = fc.oneof(fc.integer({ min: -40, max: 40 }), fc.double({ min: -NODE_GAIN, max: NODE_GAIN, noNaN: true }));
/** Q read as a quality factor or as dB, short of where a pole rounds onto the unit circle. */
const q = fc.oneof(fc.double({ min: -60, max: 60, noNaN: true }), fc.constantFrom(0, 1, 0.7071, 1e-4, -1));

const stable = (c: BiquadCoefficients): boolean => Math.abs(c.a2) < 1 && Math.abs(c.a1) < 1 + c.a2;
const finite = (c: BiquadCoefficients): boolean => Object.values(c).every(Number.isFinite);

describe('biquadCoefficients', () => {
  it('is finite for any finite cutoff, Q, and gain, and writes into `into` what it returns fresh', () => {
    fc.assert(fc.property(type, anyFinite, rate, fc.oneof(q, anyFinite), fc.oneof(gain, anyFinite), (t, f, sr, Q, g) => {
      const c = biquadCoefficients(t, f, sr, Q, g);
      expect(finite(c), JSON.stringify(c)).toBe(true);
      const into: BiquadCoefficients = { b0: 9, b1: 9, b2: 9, a1: 9, a2: 9 };
      expect(biquadCoefficients(t, f, sr, Q, g, into)).toBe(into);
      expect(into).toEqual(c);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));

  // Past ±120 dB a shelf's pole sits within rounding of z = 1 at a low cutoff.
  it('is stable for a cutoff inside the band', () => {
    const seen = tally();
    fc.assert(fc.property(type, fc.double({ min: 0, max: 1, noNaN: true }), rate, q, fc.double({ min: -120, max: 120, noNaN: true }), (t, u, sr, Q, g) => {
      const f = 10 + u * (sr * 0.49 - 10);
      const c = biquadCoefficients(t, f, sr, Q, g);
      expect(stable(c), `${t} ${f} Hz at ${sr}, Q ${Q}, gain ${g}: ${JSON.stringify(c)}`).toBe(true);
      seen.count(t);
    }), runs(RUNS));
    for (const t of TYPES) seen.atLeast(t, RUNS / 20);
  }, timeoutFor(RUNS, 2));

  it('flat through an allpass, whole at DC through a lowpass, and lifted by its gain at a peaking center', () => {
    fc.assert(fc.property(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), rate, fc.double({ min: 0.1, max: 30, noNaN: true }), fc.double({ min: -24, max: 24, noNaN: true }), (u, v, sr, Q, g) => {
      const f = 20 + u * (sr * 0.45 - 20);
      const probe = 20 + v * (sr * 0.45 - 20);
      expect(biquadResponseDb(biquadCoefficients('allpass', f, sr, Q), probe, sr)).toBeCloseTo(0, 6);
      const lp = biquadCoefficients('lowpass', f, sr, Q);
      expect((lp.b0 + lp.b1 + lp.b2) / (1 + lp.a1 + lp.a2)).toBeCloseTo(1, 6);
      expect(biquadResponseDb(biquadCoefficients('peaking', f, sr, Q, g), f, sr)).toBeCloseTo(g, 4);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 2));
});
