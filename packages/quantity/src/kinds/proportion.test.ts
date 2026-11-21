import { describe, expect, it } from 'vitest';
import { parseAs } from '../present';
import { fraction, multiplier, ratio } from './proportion';

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

function timed<T>(read: () => T): T {
  const t0 = performance.now();
  const out = read();
  expect(performance.now() - t0).toBeLessThan(250);
  return out;
}

describe('fraction counted in a constant', () => {
  it('reads a long run of spaces in bounded time', () => {
    expect(timed(() => parseAs(`π${' '.repeat(2000)}2`, fraction({ of: 'π' })))).toBeCloseTo(2 * Math.PI);
    expect(timed(() => parseAs(`π${' '.repeat(2000)}x`, fraction({ of: 'π' })))).toBeNaN();
  });

  it('counts one of the constant for a bare sign or denominator', () => {
    expect(parseAs('π', fraction({ of: 'π' }))).toBeCloseTo(Math.PI);
    expect(parseAs(' - π ', fraction({ of: 'π' }))).toBeCloseTo(-Math.PI);
    expect(parseAs('π/2', fraction({ of: 'π' }))).toBeCloseTo(Math.PI / 2);
    expect(parseAs('-π/4', fraction({ of: 'π' }))).toBeCloseTo(-Math.PI / 4);
    expect(parseAs('3π/4', fraction({ of: 'π' }))).toBeCloseTo((3 * Math.PI) / 4);
  });
});

describe('multiplier', () => {
  it('reads a long run of spaces in bounded time', () => {
    expect(timed(() => parseAs(`5${' '.repeat(60_000)}a`, multiplier()))).toBeNaN();
  });

  it('reads a typed times sign, spaced or not', () => {
    expect(parseAs('2.5x', multiplier())).toBe(2.5);
    expect(parseAs(' 2.5 × ', multiplier())).toBe(2.5);
    expect(parseAs('3X', multiplier())).toBe(3);
  });
});

describe('fraction counted in e', () => {
  const ofE = fraction({ of: 'e' });

  it('reads exponent notation as a number, not as a count of e', () => {
    expect(parseAs('1e3', ofE)).toBe(1000);
    expect(parseAs('2E-1', ofE)).toBeCloseTo(0.2);
  });

  it('still reads e as a factor', () => {
    expect(parseAs('2e', ofE)).toBeCloseTo(2 * Math.E);
    expect(parseAs('e/2', ofE)).toBeCloseTo(Math.E / 2);
    expect(parseAs('3e/4', ofE)).toBeCloseTo((3 * Math.E) / 4);
    expect(parseAs('-e', ofE)).toBeCloseTo(-Math.E);
  });
});

describe('typed digits never read as an infinity', () => {
  it('reads a division by zero as NaN', () => {
    expect(parseAs('1/0', fraction())).toBeNaN();
    expect(parseAs('-1 1/0', fraction())).toBeNaN();
    expect(parseAs('¹⁄₀', fraction())).toBeNaN();
    expect(parseAs('1/0π', fraction({ of: 'π' }))).toBeNaN();
    expect(parseAs('-1:0', ratio())).toBeNaN();
  });

  it('still reads the infinity word', () => {
    expect(parseAs('∞', fraction())).toBe(Infinity);
    expect(parseAs('-∞', ratio())).toBe(-Infinity);
  });

  it('reads digits counted in a constant past the range of a number as NaN, not infinity', () => {
    expect(parseAs('1e308π', fraction({ of: 'π' }))).toBeNaN();
    expect(parseAs('-1e308π', fraction({ of: 'π' }))).toBeNaN();
  });
});
