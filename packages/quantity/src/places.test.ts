import { describe, expect, it } from 'vitest';
import { decimalPlaces, MAX_DECIMAL_PLACES } from './places';

describe('decimalPlaces', () => {
  it('counts the places a number is written with', () => {
    expect([0, 3, -3, 0.25, 2.5, -0.125, 0.1 + 0.2].map(decimalPlaces)).toEqual([0, 0, 0, 2, 1, 3, 17]);
  });

  it('counts exponent form by the places it stands for', () => {
    expect(decimalPlaces(1e-7)).toBe(7);
    expect(decimalPlaces(1.5e-7)).toBe(8);
    expect(decimalPlaces(-2.25e-9)).toBe(11);
    expect(decimalPlaces(1e21)).toBe(0);
    expect(decimalPlaces(1.5e22)).toBe(0);
  });

  it('caps at the places toFixed and Intl take, and has none for a value that is not finite', () => {
    expect(decimalPlaces(5e-324)).toBe(MAX_DECIMAL_PLACES);
    expect([Infinity, -Infinity, NaN].map(decimalPlaces)).toEqual([0, 0, 0]);
  });
});
