import { describe, expect, it } from 'vitest';
import { createClockSteps } from './clockSteps';

describe('createClockSteps', () => {
  it('owes one step per stepMs the clock moves', () => {
    const steps = createClockSteps();
    expect(steps.owed(50, 10)).toBe(5);
    expect(steps.owed(55, 10)).toBe(0);
    expect(steps.owed(60, 10)).toBe(1);
  });

  it.each([0, -5, NaN, Infinity])('owes one step a forward frame for a step of %s ms, and keeps counting', (stepMs) => {
    const steps = createClockSteps();
    expect(steps.owed(100, stepMs)).toBe(1);
    expect(steps.owed(100, stepMs)).toBe(0);
    expect(steps.owed(200, 10)).toBe(10);
  });

  it.each([
    [0.1, [0.1, 0.6]],
    [0.7, [43.4, 102.19999999999999]],
  ])('owes the same steps at a step of %s ms however frames %j slice the time', (stepMs, times) => {
    const sliced = createClockSteps();
    const total = times.reduce((sum, t) => sum + sliced.owed(t, stepMs), 0);
    expect(total).toBe(createClockSteps().owed(times.at(-1)!, stepMs));
  });
});
