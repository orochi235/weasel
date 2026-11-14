import { describe, expect, it } from 'vitest';
import { niceStep } from './niceStep';

describe('niceStep', () => {
  it('rounds up to 1, 2 or 5 times a power of ten', () => {
    expect(niceStep(0.7)).toBe(1);
    expect(niceStep(1)).toBe(1);
    expect(niceStep(1.3)).toBe(2);
    expect(niceStep(2.1)).toBe(5);
    expect(niceStep(6)).toBe(10);
    expect(niceStep(47.6)).toBe(50);
    expect(niceStep(0.0031)).toBeCloseTo(0.005, 12);
  });

  it('never returns less than it was asked for going up, nor more going down', () => {
    for (const rough of [0.013, 0.3, 3.3, 19, 201, 7777, 1e-300, 1e300]) {
      expect(niceStep(rough)).toBeGreaterThanOrEqual(rough);
      expect(niceStep(rough, 'down')).toBeLessThanOrEqual(rough);
    }
  });

  it('rounds down to the step at or under it', () => {
    expect(niceStep(0.8, 'down')).toBe(0.5);
    expect(niceStep(1, 'down')).toBe(1);
    expect(niceStep(4.99, 'down')).toBe(2);
    expect(niceStep(5, 'down')).toBe(5);
    expect(niceStep(99, 'down')).toBe(50);
  });

  it('rounds to the nearest by ratio', () => {
    expect(niceStep(1.4, 'nearest')).toBe(1);
    expect(niceStep(1.5, 'nearest')).toBe(2);
    expect(niceStep(3.1, 'nearest')).toBe(2);
    expect(niceStep(3.2, 'nearest')).toBe(5);
    expect(niceStep(7, 'nearest')).toBe(5);
    expect(niceStep(7.1, 'nearest')).toBe(10);
  });

  it('gives back what is not a positive finite number', () => {
    expect(niceStep(0)).toBe(0);
    expect(niceStep(-3)).toBe(-3);
    expect(niceStep(Number.NaN)).toBeNaN();
    expect(niceStep(Infinity)).toBe(Infinity);
  });

  it('does not overflow past the largest double', () => {
    expect(niceStep(Number.MAX_VALUE)).toBe(Number.MAX_VALUE);
    expect(niceStep(Number.MAX_VALUE, 'nearest') / 1e308).toBeCloseTo(1, 12);
    expect(niceStep(Number.MAX_VALUE, 'down') / 1e308).toBeCloseTo(1, 12);
  });
});
