import { describe, it, expect } from 'vitest';
import {
  formatCompact,
  formatNumber,
  MINUS_SIGN,
  parseNumber,
  parseSignedNumber,
} from './number';
import { qty } from './present';
import { zoom } from './kinds/proportion';

const formatZoom = (z: number) => qty(z, zoom()).text;

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

describe('zoom display', () => {
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

describe('formatCompact', () => {
  it('keeps the given precision below a thousand', () => {
    expect(formatCompact(0)).toBe('0');
    expect(formatCompact(950)).toBe('950');
    expect(formatCompact(2.5, 1)).toBe('2.5');
  });

  it('abbreviates from a thousand up, at one decimal', () => {
    expect(formatCompact(1000)).toBe('1.00K');
    expect(formatCompact(40_000)).toBe('40.0K');
    expect(formatCompact(2_000_000)).toBe('2.00M');
    expect(formatCompact(294_000)).toBe('294K');
    expect(formatCompact(12_345_678)).toBe('12.3M');
  });

  it('rolls over into the next magnitude rather than printing 1000.0K', () => {
    expect(formatCompact(999_950)).toBe('1.00M');
  });

  it('signs a negative with U+2212', () => {
    expect(formatCompact(-1500)).toBe('−1.50K');
  });
});

describe('parseNumber', () => {
  it('reads what parseSignedNumber reads', () => {
    expect(parseNumber('−42')).toBe(-42);
    expect(parseNumber('-3.5')).toBe(-3.5);
  });

  it('reads a magnitude suffix in either case, without float noise', () => {
    expect(parseNumber('2.5m')).toBe(2_500_000);
    expect(parseNumber('40K')).toBe(40_000);
    expect(parseNumber('1.1k')).toBe(1100);
    expect(parseNumber(formatCompact(-1500))).toBe(-1500);
  });

  it('reads thousands commas only in the thousands shape', () => {
    expect(parseNumber('40,000')).toBe(40_000);
    expect(parseNumber('2,5')).toBeNaN();
    expect(parseNumber('1,000.')).toBe(1000);
  });

  it('is NaN for empty text and for text that names no number', () => {
    expect(parseNumber('')).toBeNaN();
    expect(parseNumber('  ')).toBeNaN();
    expect(parseNumber('k')).toBeNaN();
    expect(parseNumber('abc')).toBeNaN();
  });
});

describe('parseNumber with units', () => {
  const metricInCm = { mm: 0.1, cm: 1, m: 100, km: 100_000 };

  it('scales by the unit typed, with or without a space', () => {
    expect(parseNumber('3m', metricInCm)).toBe(300);
    expect(parseNumber('3 m', metricInCm)).toBe(300);
    expect(parseNumber('4', metricInCm)).toBe(4);
  });

  it('reads the longest unit name the text ends with', () => {
    expect(parseNumber('12mm', metricInCm)).toBe(1.2);
    expect(parseNumber('2km', metricInCm)).toBe(200_000);
  });

  it('reads a unit before a magnitude suffix', () => {
    expect(parseNumber('2m', metricInCm)).toBe(200);
    expect(parseNumber('2k', metricInCm)).toBe(2000);
  });

  it('matches exact case first, then any case', () => {
    expect(parseNumber('5CM', metricInCm)).toBe(5);
    expect(parseNumber('1M', { M: 1_000_000, m: 1 })).toBe(1_000_000);
    expect(parseNumber('1m', { M: 1_000_000, m: 1 })).toBe(1);
  });

  it('is NaN for a unit it does not accept', () => {
    expect(parseNumber('12ft', metricInCm)).toBeNaN();
    expect(parseNumber('mm', metricInCm)).toBeNaN();
  });
});

describe('parseNumber with compound values', () => {
  const imperialInInches = { in: 1, ft: 12, yd: 36 };
  const metricInCm = { mm: 0.1, cm: 1, m: 100 };

  it('sums a run of unit-suffixed terms', () => {
    expect(parseNumber('5ft 3in', imperialInInches)).toBe(63);
    expect(parseNumber('1m 20cm', metricInCm)).toBe(120);
    expect(parseNumber('1yd 2ft 3in', imperialInInches)).toBe(63);
  });

  it('reads a compound value with no space between terms', () => {
    expect(parseNumber('5ft3in', imperialInInches)).toBe(63);
  });

  it('carries the leading sign across the whole value', () => {
    expect(parseNumber('-5ft 3in', imperialInInches)).toBe(-63);
  });

  it('reads thousands commas inside a term', () => {
    expect(parseNumber('1,500ft 3in', imperialInInches)).toBe(18_003);
    expect(parseNumber('1,000,000mm 5cm', metricInCm)).toBe(100_005);
    expect(parseNumber('1ft 1,200.5in', imperialInInches)).toBe(1_212.5);
  });

  it('is NaN for a term whose commas are not thousands groups', () => {
    expect(parseNumber('1,50ft 3in', imperialInInches)).toBeNaN();
    expect(parseNumber('1500,000ft 3in', imperialInInches)).toBeNaN();
  });

  it('is NaN when a term carries no unit', () => {
    expect(parseNumber('5ft 3', imperialInInches)).toBeNaN();
    expect(parseNumber('5 3in', imperialInInches)).toBeNaN();
  });

  it('is NaN when a term names a unit the field does not accept', () => {
    expect(parseNumber('5ft 3in', metricInCm)).toBeNaN();
  });
});

describe('parseNumber with inch and foot marks', () => {
  const imperialInInches = { in: 1, ft: 12 };

  it('reads " and \' as inches and feet wherever in and ft are accepted', () => {
    expect(parseNumber('3"', imperialInInches)).toBe(3);
    expect(parseNumber("5'", imperialInInches)).toBe(60);
    expect(parseNumber('5\' 3"', imperialInInches)).toBe(63);
  });

  it('reads the primes and the curly quotes a keyboard substitutes', () => {
    expect(parseNumber('5′ 3″', imperialInInches)).toBe(63);
    expect(parseNumber('5’ 3”', imperialInInches)).toBe(63);
  });

  it('reads the names wherever a mark is what the field accepts', () => {
    expect(parseNumber('5ft 3in', { '"': 1, "'": 12 })).toBe(63);
  });

  it('adds no unit a field does not accept', () => {
    expect(parseNumber('3"', { cm: 1 })).toBeNaN();
  });
});

describe('parseNumber with offset units', () => {
  // A field showing degC that also accepts K, which puts zero elsewhere.
  const inDegC = { degC: 1, K: { factor: 1, offset: -273.15 } };

  it('applies the offset to a single term', () => {
    expect(parseNumber('0K', inDegC)).toBeCloseTo(-273.15, 9);
    expect(parseNumber('20degC', inDegC)).toBe(20);
  });

  it('is NaN for a compound value whose terms disagree about zero', () => {
    expect(parseNumber('1K 2degC', inDegC)).toBeNaN();
  });
});

describe('parseNumber in a locale', () => {
  it('reads the locale\'s own group and decimal separators', () => {
    expect(parseNumber('1.500', undefined, 'de-DE')).toBe(1500);
    expect(parseNumber('1,5', undefined, 'de-DE')).toBe(1.5);
    expect(parseNumber('1.234.567,25', undefined, 'de-DE')).toBe(1_234_567.25);
    expect(parseNumber('12,34,567', undefined, 'en-IN')).toBe(1_234_567);
    expect(parseNumber('1’234.5', undefined, 'de-CH')).toBe(1234.5);
    expect(parseNumber("1'234.5", undefined, 'de-CH')).toBe(1234.5);
  });

  it('takes any space as the group where the locale groups with one', () => {
    expect(parseNumber('1 234,5', undefined, 'fr-FR')).toBe(1234.5);
    expect(parseNumber('1\u202f234,5', undefined, 'fr-FR')).toBe(1234.5);
    expect(parseNumber('1\u00a0234,5', undefined, 'fr-FR')).toBe(1234.5);
  });

  it('reads the locale form before the en-US one where they disagree', () => {
    expect(parseNumber('1,500', undefined, 'fr-FR')).toBe(1.5);
    expect(parseNumber('1.500', undefined, 'de-DE')).toBe(1500);
  });

  it('falls back to the en-US reading when the locale reading finds nothing', () => {
    expect(parseNumber('1.5', undefined, 'de-DE')).toBe(1.5);
    expect(parseNumber('1,234.5', undefined, 'de-DE')).toBe(1234.5);
  });

  it('keeps locale separators apart from its units', () => {
    expect(parseNumber('1 500 mm', { mm: 1 }, 'fr-FR')).toBe(1500);
    expect(parseNumber('2,5ft 3in', { in: 1, ft: 12 }, 'de-DE')).toBe(33);
    expect(parseNumber("5' 3\"", { in: 1, ft: 12 }, 'de-CH')).toBe(63);
  });

  it('does not take two-digit groups where the locale has none', () => {
    expect(parseNumber('12,34,567')).toBeNaN();
    expect(parseNumber('1.50.000', undefined, 'de-DE')).toBeNaN();
  });
});
