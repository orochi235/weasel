import { describe, expect, it } from 'vitest';
import { parseAs } from '../present';
import { fraction, ratio } from './proportion';

describe('fraction and ratio read typed text in the locale', () => {
  it("reads a fraction's decimal fallback with the locale's decimal mark and digits", () => {
    expect(parseAs('0,5', fraction(), { locale: 'de-DE' })).toBe(0.5);
    expect(parseAs('1.234,5', fraction(), { locale: 'de-DE' })).toBe(1234.5);
    expect(parseAs('٠٫٥', fraction(), { locale: 'ar-EG' })).toBe(0.5);
    expect(parseAs('١/٢', fraction(), { locale: 'ar-EG' })).toBe(0.5);
    expect(parseAs('0,5π', fraction({ of: 'π' }), { locale: 'de-DE' })).toBeCloseTo(Math.PI / 2);
  });

  it("reads a ratio's terms in the locale", () => {
    expect(parseAs('1,5:1', ratio(), { locale: 'de-DE' })).toBe(1.5);
    expect(parseAs('١:٤', ratio(), { locale: 'ar-EG' })).toBe(0.25);
  });

  it('still reads en-US text in another locale', () => {
    expect(parseAs('1 1/2', fraction(), { locale: 'de-DE' })).toBe(1.5);
    expect(parseAs('0.5', fraction(), { locale: 'de-DE' })).toBe(0.5);
    expect(parseAs('3:4', ratio(), { locale: 'de-DE' })).toBe(0.75);
  });
});
