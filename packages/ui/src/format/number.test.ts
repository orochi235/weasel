import { describe, it, expect } from 'vitest';
import { formatNumber, formatZoom, MINUS_SIGN, parseSignedNumber } from './number';

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

describe('parseSignedNumber', () => {
  it('reads back a value formatNumber rendered with U+2212', () => {
    expect(parseSignedNumber(formatNumber(-42))).toBe(-42);
  });

  it('accepts the ASCII hyphen too', () => {
    expect(parseSignedNumber('-3.5')).toBe(-3.5);
  });

  it('is NaN for text that names no number', () => {
    expect(parseSignedNumber('abc')).toBeNaN();
  });
});

describe('formatZoom', () => {
  it('shows a percentage up to and including 2x', () => {
    expect(formatZoom(0.5)).toBe('50%');
    expect(formatZoom(1)).toBe('100%');
    expect(formatZoom(1.5)).toBe('150%');
    expect(formatZoom(2)).toBe('200%');
  });

  it('switches to a multiplier above 2x', () => {
    expect(formatZoom(2.5)).toBe('2.5x');
    expect(formatZoom(4)).toBe('4x');
    expect(formatZoom(16)).toBe('16x');
  });

  it('rounds the multiplier to one decimal and drops a trailing zero', () => {
    expect(formatZoom(3.04)).toBe('3x');
    expect(formatZoom(3.06)).toBe('3.1x');
  });

  it('drops the decimal and groups thousands past 100x', () => {
    expect(formatZoom(100)).toBe('100x');
    expect(formatZoom(1009.74)).toBe('1,010x');
    expect(formatZoom(99.9)).toBe('99.9x');
  });

  it('passes non-finite zoom through rather than printing NaN%', () => {
    expect(formatZoom(Number.NaN)).toBe('NaN');
    expect(formatZoom(Number.POSITIVE_INFINITY)).toBe('Infinity');
  });
});
