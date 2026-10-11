import { describe, expect, it } from 'vitest';
import { currency, decimal, percent, present, unit } from './index';
import { formatCompact, formatNumber, MINUS_SIGN } from './number';
import { formatUnit, IMPERIAL_INCHES } from './units';

describe('a negative value that rounds to zero', () => {
  it('shows no sign through formatNumber', () => {
    expect(formatNumber(-0.0004, { maximumFractionDigits: 2 })).toBe('0');
    expect(formatNumber(-0)).toBe('0');
  });

  it('keeps the sign on one that rounds away from zero', () => {
    expect(formatNumber(-0.006, { maximumFractionDigits: 2 })).toBe(`${MINUS_SIGN}0.01`);
  });

  it('keeps a sign the caller asked to always see', () => {
    expect(formatNumber(-0.0004, { maximumFractionDigits: 2, signDisplay: 'always' })).toBe('+0');
  });

  it('shows no sign through formatCompact', () => {
    expect(formatCompact(-0.4)).toBe('0');
    expect(formatCompact(-0.004, 2)).toBe('0.00');
  });

  it('shows no sign through formatUnit', () => {
    expect(formatUnit(-0.001, 'in', IMPERIAL_INCHES)).toBe('0in');
    expect(formatUnit(-0.006, 'in', IMPERIAL_INCHES)).toBe('-0.01in');
  });

  it('shows no sign in a presented quantity', () => {
    expect(present(-0.0004, decimal({ maxPlaces: 2 })).text).toBe('0');
    expect(present(-0.001, percent()).text).toBe('0%');
    expect(present(-0.001, currency('USD')).text).toBe('$0.00');
    expect(present(-0.001, unit('mm', { places: 2 })).text).not.toContain(MINUS_SIGN);
  });
});
