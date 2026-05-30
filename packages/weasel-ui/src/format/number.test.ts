import { describe, it, expect } from 'vitest';
import { formatNumber, MINUS_SIGN } from './number';

describe('formatNumber', () => {
  it('exports the U+2212 MINUS SIGN, not the ASCII hyphen', () => {
    expect(MINUS_SIGN).toBe('−');
    expect(MINUS_SIGN).not.toBe('-');
  });

  it('returns positives unchanged (subject to locale)', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(42)).toBe('42');
  });

  it('prefixes negatives with U+2212, not U+002D', () => {
    const out = formatNumber(-42);
    expect(out.charCodeAt(0)).toBe(0x2212);
    expect(out).toBe('−42');
  });

  it('forwards Intl.NumberFormat options', () => {
    expect(formatNumber(-0.5, { minimumFractionDigits: 2 })).toBe('−0.50');
  });

  it('uses the real minus even when signDisplay forces a sign', () => {
    const positive = formatNumber(3, { signDisplay: 'always' });
    expect(positive).toBe('+3');
    const negative = formatNumber(-3, { signDisplay: 'always' });
    expect(negative).toBe('−3');
  });

  it('handles -Infinity and NaN without crashing', () => {
    expect(formatNumber(-Infinity)).toBe('−Infinity');
    expect(formatNumber(NaN)).toBe('NaN');
  });
});
