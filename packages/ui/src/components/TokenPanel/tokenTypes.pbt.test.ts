/**
 * Property tests of how the token panel reads values: an amount the panel writes back, `${amount}${unit}`, splits
 * into that amount and unit and is typed by its unit; a `cubic-bezier()` reads back its points; colors convert to the
 * hex a color input takes; and no text throws.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { finite, hex6, byte, runs, tally, timeoutFor } from '../../pbt.fixture';
import { bezierPoints, inferTokenType, shownAlike, splitUnit } from './tokenTypes';
import { parsesAsColor } from '@weasel-js/paint';
import { toHex } from './color';

const RUNS = 400;
const DIMENSIONS = ['px', 'rem', 'em', '%', 'ch', 'vh', 'pt', 'mm'];
const amount = fc.oneof(finite, fc.constantFrom(1e21, 1e-7, -2.5e-9, 123456789012345680000));

describe('splitUnit and inferTokenType', () => {
  it('read an amount written with its unit back as that amount and unit, typed by the unit', () => {
    const t = tally();
    fc.assert(fc.property(amount, fc.constantFrom('', 'ms', 's', ...DIMENSIONS), (n, unit) => {
      const text = `${n}${unit}`;
      expect(splitUnit(text)).toEqual({ amount: n === 0 ? 0 : n, unit });
      expect(inferTokenType(text)).toBe(unit === '' ? 'number' : unit === 'ms' || unit === 's' ? 'duration' : 'dimension');
      if (/e/.test(String(n))) t.count('exponent');
    }), runs(RUNS));
    t.atLeast('exponent', 30);
  }, timeoutFor(RUNS, 1));

  it('read a cubic-bezier() back as its four points', () => {
    fc.assert(fc.property(fc.tuple(amount, amount, amount, amount), fc.constantFrom(',', ', ', ' , '), ([a, b, c, d], sep) => {
      const text = `cubic-bezier(${[a, b, c, d].join(sep)})`;
      expect(inferTokenType(text)).toBe('cubicBezier');
      expect(bezierPoints(text)).toEqual([a, b, c, d].map((v) => (v === 0 ? 0 : v)));
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('type any text without throwing, and call shownAlike the same both ways', () => {
    fc.assert(fc.property(fc.string({ maxLength: 30 }), finite, finite, (s, a, b) => {
      expect(typeof inferTokenType(s)).toBe('string');
      splitUnit(s);
      bezierPoints(s);
      expect(shownAlike(a, b)).toBe(shownAlike(b, a));
      expect(shownAlike(a, a)).toBe(true);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

describe('toHex and parsesAsColor', () => {
  const css = fc.oneof(
    hex6.map((h) => ({ text: h, hex: h })),
    hex6.map((h) => ({ text: h.toUpperCase(), hex: h })),
    fc.tuple(byte, byte, byte).map(([r, g, b]) => ({
      text: `rgb(${r}, ${g}, ${b})`, hex: `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`,
    })),
    fc.tuple(fc.integer({ min: 0, max: 15 }), fc.integer({ min: 0, max: 15 }), fc.integer({ min: 0, max: 15 })).map(([r, g, b]) => ({
      text: `#${[r, g, b].map((v) => v.toString(16)).join('')}`, hex: `#${[r, g, b].map((v) => v.toString(16).repeat(2)).join('')}`,
    })),
  );

  it('convert a hex or rgb() color to the hex it names, and the small parser calls it a color', () => {
    fc.assert(fc.property(css, fc.constantFrom('', ' '), ({ text, hex }, pad) => {
      expect(toHex(`${pad}${text}${pad}`)).toBe(hex);
      expect(parsesAsColor(`${pad}${text}${pad}`, null)).toBe(true);
      expect(toHex(hex)).toBe(hex);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('refuse a var() or a CSS-wide keyword whatever the browser says, and never throw', () => {
    fc.assert(fc.property(fc.string({ maxLength: 20 }), fc.constantFrom('inherit', 'initial', 'unset', 'revert', 'revert-layer', 'INHERIT'), (s, wide) => {
      expect(parsesAsColor(`var(--${s})`, () => true)).toBe(false);
      expect(parsesAsColor(wide, () => true)).toBe(false);
      parsesAsColor(s, null);
      const h = toHex(s);
      if (h !== null) expect(h).toMatch(/^#[0-9a-f]{6}$/);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));
});

describe('token values, shrunk counterexamples', () => {
  it('read back an amount the panel wrote with an exponent', () => {
    expect(splitUnit('1e+21')).toEqual({ amount: 1e21, unit: '' });
    expect(splitUnit('1e-7px')).toEqual({ amount: 1e-7, unit: 'px' });
    expect(inferTokenType('cubic-bezier(1e+21,0,1e+21,0)')).toBe('cubicBezier');
  });
});
