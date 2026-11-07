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
});
