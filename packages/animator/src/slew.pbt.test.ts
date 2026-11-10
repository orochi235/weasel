import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createSlew, slewToward, type SlewRates } from './slew';
import { moderate, runs, tally, timeoutFor } from './pbt.fixture';

const N = 500;
const RUNS = runs(N);

const rate = fc.oneof(fc.double({ min: 0, max: 1e4, noNaN: true }), fc.constantFrom(0, 1, Infinity), fc.constant(undefined));
const rates: fc.Arbitrary<SlewRates> = fc.record({ rise: rate, fall: rate }, { requiredKeys: [] });
const dt = fc.oneof(fc.double({ min: -1, max: 10, noNaN: true }), fc.constantFrom(0, 1 / 60, 1));

const limit = (r: number | undefined): number => r ?? Infinity;

describe('slewToward, property', () => {
  it('moves toward the target by at most its rate times dt, and never past it', () => {
    const t = tally();
    fc.assert(fc.property(moderate(), moderate(), dt, rates, (value, target, step, r) => {
      const next = slewToward(value, target, step, r);
      expect(Number.isFinite(next)).toBe(true);
      const lo = Math.min(value, target), hi = Math.max(value, target);
      expect(next).toBeGreaterThanOrEqual(lo);
      expect(next).toBeLessThanOrEqual(hi);
      const most = limit(target > value ? r.rise : r.fall);
      const allowed = most === Infinity ? Infinity : step > 0 ? most * step : 0;
      expect(Math.abs(next - value)).toBeLessThanOrEqual(allowed + Math.abs(value) * 4 * Number.EPSILON);
      if (next === target) t.count('reached');
      else t.count('short');
    }), RUNS);
    t.atLeast('reached', 10);
    t.atLeast('short', 10);
  }, timeoutFor(N, 2));

  it('is mirrored by negation with rise and fall swapped', () => {
    fc.assert(fc.property(moderate(), moderate(), dt, rates, (value, target, step, r) => {
      const a = slewToward(value, target, step, r);
      const b = slewToward(-value, -target, step, { rise: r.fall, fall: r.rise });
      expect(b + 0).toBe(-a + 0);
    }), RUNS);
  }, timeoutFor(N, 2));

  it('commutes with a shift of value and target together', () => {
    fc.assert(fc.property(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -1000, max: 1000 }),
      fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: 0, max: 8 }), fc.integer({ min: 0, max: 50 }),
      (value, target, shift, step, r) => {
        const at = slewToward(value, target, step / 4, { rise: r, fall: r });
        expect(slewToward(value + shift, target + shift, step / 4, { rise: r, fall: r })).toBe(at + shift);
      }), RUNS);
  }, timeoutFor(N, 2));
});

describe('createSlew, property', () => {
  it('reaches its target in the steps its rate needs, and stays there', () => {
    const t = tally();
    fc.assert(fc.property(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: -1000, max: 1000 }),
      fc.integer({ min: 1, max: 100 }), fc.integer({ min: 1, max: 100 }), fc.constantFrom(0.25, 0.5, 1),
      (value, target, rise, fall, step) => {
        const slew = createSlew({ value, target, rise, fall });
        const per = (target > value ? rise : fall) * step;
        const need = Math.ceil(Math.abs(target - value) / per);
        let last = value;
        for (let i = 0; i < need; i++) {
          const v = slew.step(step);
          expect(Math.abs(v - last)).toBeLessThanOrEqual(per + 1e-9);
          last = v;
        }
        expect(slew.value).toBe(target);
        expect(slew.step(step)).toBe(target);
        if (need > 1) t.count('several steps');
      }), RUNS);
    t.atLeast('several steps', 10);
  }, timeoutFor(N, 2));

  it('takes one long step as it takes the same time in short ones, short of the target', () => {
    fc.assert(fc.property(fc.integer({ min: -1000, max: 1000 }), fc.integer({ min: 1, max: 20 }), fc.integer({ min: 1, max: 8 }),
      (value, r, parts) => {
        const one = createSlew({ value, target: value + 1e6, rise: r, fall: r });
        const many = createSlew({ value, target: value + 1e6, rise: r, fall: r });
        one.step(parts);
        for (let i = 0; i < parts; i++) many.step(1);
        expect(many.value).toBe(one.value);
      }), RUNS);
  }, timeoutFor(N, 2));
});
