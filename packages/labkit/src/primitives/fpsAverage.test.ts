import { describe, expect, test } from 'vitest';
import { rollingAverage } from './fpsAverage';

describe('rollingAverage', () => {
  test('returns the input when only one sample', () => {
    expect(rollingAverage([60])).toBe(60);
  });

  test('averages multiple samples', () => {
    expect(rollingAverage([30, 60, 90])).toBe(60);
  });

  test('returns 0 for empty array', () => {
    expect(rollingAverage([])).toBe(0);
  });

  test('rounds to nearest integer', () => {
    expect(rollingAverage([59, 60, 61])).toBe(60);
    expect(rollingAverage([58, 59, 61])).toBe(59);
  });
});
