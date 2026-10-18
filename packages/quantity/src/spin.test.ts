import { describe, expect, it } from 'vitest';
import { snapToStep } from './spin';

describe('snapToStep', () => {
  it('lands on the step grid without float dust', () => {
    expect(snapToStep(0.3, 0.1)).toBe(0.3);
    expect(snapToStep(0.29, 0.1)).toBe(0.3);
    expect(snapToStep(1.15, 0.05, 0.1)).toBe(1.15);
  });

  it('counts steps from the origin', () => {
    expect(snapToStep(7, 5, 1)).toBe(6);
    expect(snapToStep(0.44, 0.25, 0.1)).toBe(0.35);
  });

  it('leaves a value alone when there is no step', () => {
    expect(snapToStep(0.123, 0)).toBe(0.123);
  });
});
