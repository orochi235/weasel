/**
 * Property tests of what the easing picker reads off a spec: a built-in passed by name or by function reads back as
 * its name, a bezier as its control points, and a curve's samples run its ends for any count asked for.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { EASINGS, resolveEasing, type EasingSpec } from '@weasel-js/core';
import { runs, tally, timeoutFor } from '../../pbt.fixture';
import { EASING_NAMES, easingBezier, easingLabel, sampleEasing } from './easingSpec';

const RUNS = 300;
const name = fc.constantFrom(...EASING_NAMES);
const bezier = fc.tuple(fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: -2, max: 2, noNaN: true }), fc.double({ min: 0, max: 1, noNaN: true }), fc.double({ min: -2, max: 2, noNaN: true }));
const spec: fc.Arbitrary<EasingSpec | undefined> = fc.oneof(
  name, name.map((n) => EASINGS[n] as EasingSpec), bezier.map((b) => ({ bezier: b }) as EasingSpec), fc.constant(undefined));

describe('easingLabel and easingBezier', () => {
  it('read a built-in back as its name whether named or passed as its function, and a bezier as its points', () => {
    const t = tally();
    fc.assert(fc.property(spec, (s) => {
      const label = easingLabel(s);
      if (s === undefined) { expect(label).toBe('linear'); t.count('none'); return; }
      if (typeof s === 'string') { expect(label).toBe(s); t.count('name'); }
      else if (typeof s === 'function') {
        expect(EASINGS[label as keyof typeof EASINGS]).toBe(s);
        t.count('function');
      } else {
        const b = (s as { bezier: readonly number[] }).bezier;
        expect(easingBezier(s)).toEqual(b);
        expect(label).toBe(`cubic-bezier(${b.join(', ')})`);
        t.count('bezier');
      }
      if (typeof s !== 'object') expect(easingBezier(s)).toBeNull();
    }), runs(RUNS));
    for (const k of ['none', 'name', 'function', 'bezier']) t.atLeast(k, 30);
  }, timeoutFor(RUNS, 1));
});

describe('sampleEasing', () => {
  it('gives as many samples as the whole count asked for, from the curve at 0 to the curve at 1', () => {
    const t = tally();
    fc.assert(fc.property(spec, fc.oneof(fc.integer({ min: -3, max: 40 }), fc.double({ min: -3, max: 40, noNaN: true }), fc.constantFrom(Number.NaN, Infinity)), (s, count) => {
      const out = sampleEasing(s, count);
      const whole = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;
      expect(out).toHaveLength(whole);
      const fn = resolveEasing(s);
      if (whole >= 1) expect(out[0]).toBe(fn(0));
      if (whole >= 2) { expect(out[whole - 1]).toBe(fn(1)); t.count('ends'); }
      if (!Number.isInteger(count)) t.count('fraction');
    }), runs(RUNS));
    t.atLeast('ends', 40);
    t.atLeast('fraction', 30);
  }, timeoutFor(RUNS, 1));
});

describe('sampleEasing, shrunk counterexample', () => {
  it('gives no samples for a count just below zero, rather than throwing', () => {
    expect(sampleEasing(undefined, -5e-324)).toEqual([]);
  });
});
