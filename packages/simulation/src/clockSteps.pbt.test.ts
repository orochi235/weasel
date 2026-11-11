/** The steps a clock's time owes, however the frames slice it. */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { createClockSteps } from './clockSteps';
import { runs, tally, timeoutFor } from './pbt.fixture';

const stepMs = fc.oneof(
  fc.constantFrom(1000 / 60, 0.1, 1 / 3, 0.7, 3.3, 10),
  fc.double({ min: 1e-3, max: 100, noNaN: true }),
);

/** Frame times from 0 to `end`, in order, some landing on whole steps. */
const frames = (step: number) => fc.tuple(fc.integer({ min: 0, max: 400 }), fc.array(fc.oneof(
  fc.integer({ min: 0, max: 400 }).map((k) => k * step),
  fc.double({ min: 0, max: 400 * step, noNaN: true }),
), { maxLength: 12 })).map(([m, cuts]) => {
  const end = m * step;
  return [...cuts.filter((c) => c <= end).sort((a, b) => a - b), end];
});

describe('createClockSteps', () => {
  it('owes a span the same steps however the frames slice it', () => {
    const seen = tally();
    fc.assert(fc.property(stepMs.chain((s) => fc.tuple(fc.constant(s), frames(s))), ([s, times]) => {
      const sliced = createClockSteps();
      let total = 0;
      for (const t of times) {
        const n = sliced.owed(t, s);
        expect(Number.isInteger(n) && n >= 0).toBe(true);
        total += n;
      }
      const whole = createClockSteps().owed(times.at(-1)!, s);
      expect(total).toBe(whole);
      seen.count(times.length > 2 ? 'sliced' : 'whole');
      if (total > 0) seen.count('stepped');
    }), runs(300));
    seen.atLeast('sliced', 50);
    seen.atLeast('stepped', 50);
  }, timeoutFor(300, 2));

  it('owes nothing for time gone back, and counts on from where the clock stands', () => {
    const seen = tally();
    fc.assert(fc.property(stepMs, fc.integer({ min: 1, max: 200 }), fc.double({ min: 0, max: 1, noNaN: true }),
      fc.double({ min: 0, max: 200, noNaN: true }), (s, ahead, back, on) => {
        const steps = createClockSteps();
        const at = ahead * s;
        steps.owed(at, s);
        const to = at * back;
        // Back into an earlier step than the one paid up to; within that step nothing was owed anyway.
        fc.pre(Math.floor(to / s) < Math.floor(at / s));
        expect(steps.owed(to, s)).toBe(0);
        const fresh = createClockSteps();
        fresh.rebase(to);
        expect(steps.owed(to + on * s, s)).toBe(fresh.owed(to + on * s, s));
        if (to < at - s) seen.count('back');
      }), runs(300));
    seen.atLeast('back', 50);
  }, timeoutFor(300, 1));

  it('owes nothing twice when the step changes mid-run', () => {
    fc.assert(fc.property(stepMs, stepMs, fc.integer({ min: 0, max: 100 }), fc.integer({ min: 0, max: 100 }), (a, b, m, k) => {
      const steps = createClockSteps();
      const first = steps.owed(m * a, a);
      const second = steps.owed(m * a + k * b, b);
      if (a === b) {
        expect(first + second).toBe(createClockSteps().owed(m * a + k * b, b));
        return;
      }
      const fresh = createClockSteps();
      fresh.rebase(first * a);
      expect(second).toBe(fresh.owed(m * a + k * b, b));
    }), runs(300));
  }, timeoutFor(300, 1));
});
