import { describe, expect, it } from 'vitest';
import { currency, multiplier, parseAs, percent, present } from './index';

describe('currency text in a locale reads back', () => {
  it.each([
    ['da-DK', 'DKK'], ['bg-BG', 'BGN'], ['de-DE', 'EUR'], ['fr-FR', 'EUR'], ['de-CH', 'CHF'],
    ['en-US', 'USD'], ['en-IN', 'INR'], ['ar-EG', 'EGP'], ['hi-IN', 'INR'], ['pl-PL', 'PLN'],
  ])('%s %s', (locale, code) => {
    for (const v of [12.5, 0, 1234.5, -1234.5, 1_234_567]) {
      const shown = present(v, currency(code), { locale }).text;
      expect(parseAs(shown, currency(code), { locale }), shown).toBe(v);
    }
  });

  it('reads a currency whose abbreviation ends in a period', () => {
    expect(parseAs('12,50 kr.', currency('DKK'), { locale: 'da-DK' })).toBe(12.5);
    expect(parseAs('12,50 лв.', currency('BGN'), { locale: 'bg-BG' })).toBe(12.5);
  });

  it('reads a yen amount with no fraction', () => {
    const shown = present(1234, currency('JPY'), { locale: 'ja-JP' }).text;
    expect(parseAs(shown, currency('JPY'), { locale: 'ja-JP' })).toBe(1234);
  });

  it('honors a typed magnitude suffix', () => {
    expect(parseAs('$5k', currency('USD'))).toBe(5000);
    expect(parseAs('$2.5M', currency('USD'))).toBe(2_500_000);
    expect(parseAs('5k', currency('USD'))).toBe(5000);
  });

  it('reads a sign on either side of the symbol', () => {
    expect(parseAs('−$3.00', currency('USD'))).toBe(-3);
    expect(parseAs('$-3.00', currency('USD'))).toBe(-3);
    expect(parseAs('-3', currency('USD'))).toBe(-3);
  });

  it('reads text with no number as NaN', () => {
    expect(parseAs('$', currency('USD'))).toBeNaN();
    expect(parseAs('', currency('USD'))).toBeNaN();
  });
});

describe('percent text in a locale reads back', () => {
  it.each(['en-US', 'ar', 'ar-EG', 'fa-IR', 'de-DE', 'fr-FR', 'tr-TR', 'he-IL'])('%s', (locale) => {
    for (const v of [0.25, 0, 1.5, -0.5]) {
      const shown = present(v, percent(), { locale }).text;
      expect(parseAs(shown, percent(), { locale }), shown).toBe(v);
    }
  });

  it('reads an Arabic percent sign and marks around a Latin one', () => {
    expect(parseAs('25٪', percent(), { locale: 'ar-EG' })).toBe(0.25);
    expect(parseAs('25‎%‎', percent(), { locale: 'ar' })).toBe(0.25);
  });
});

describe('multiplier with its own symbol', () => {
  it('reads back what it shows', () => {
    const display = multiplier({ symbol: '✕' });
    const shown = present(2.5, display).text;
    expect(shown).toContain('✕');
    expect(parseAs(shown, display)).toBe(2.5);
  });
});
