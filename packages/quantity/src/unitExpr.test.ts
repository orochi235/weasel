import { describe, expect, it } from 'vitest';
import { parseUnitExpr, resolveUnitExpr } from './unitExpr';
import { IMPERIAL_INCHES, type UnitSystem } from './units';

const TEMPERATURE: UnitSystem = { base: 'K', units: { K: 1, degC: { factor: 1, offset: 273.15 } } };

describe('resolveUnitExpr', () => {
  it('sums terms in different units into base units', () => {
    expect(resolveUnitExpr('2ft + 3in', { unitSystem: IMPERIAL_INCHES })).toBe(27);
    expect(resolveUnitExpr('1yd − 2 ft', { unitSystem: IMPERIAL_INCHES })).toBe(12);
  });

  it('resolves a percentage against the context', () => {
    expect(resolveUnitExpr('50% + 2ft', { unitSystem: IMPERIAL_INCHES, percentOf: 100 })).toBe(74);
    expect(resolveUnitExpr('100% - 1in', { unitSystem: IMPERIAL_INCHES, percentOf: 40 })).toBe(39);
  });

  it('throws on a percentage with nothing to resolve it against', () => {
    expect(() => resolveUnitExpr('50% + 2ft', { unitSystem: IMPERIAL_INCHES })).toThrow(/percentOf/);
  });

  it('reads a bare number as base units, and as a scalar beside * and /', () => {
    expect(resolveUnitExpr('1ft + 3', { unitSystem: IMPERIAL_INCHES })).toBe(15);
    expect(resolveUnitExpr('2 * 3ft', { unitSystem: IMPERIAL_INCHES })).toBe(72);
    expect(resolveUnitExpr('(1ft + 6in) / 3', { unitSystem: IMPERIAL_INCHES })).toBe(6);
    expect(resolveUnitExpr('3ft / 1ft * 2in', { unitSystem: IMPERIAL_INCHES })).toBe(6);
    expect(resolveUnitExpr('7')).toBe(7);
  });

  it('binds * and / tighter than + and -, and honors parentheses', () => {
    expect(resolveUnitExpr('1in + 2 * 3in', { unitSystem: IMPERIAL_INCHES })).toBe(7);
    expect(resolveUnitExpr('(1in + 2in) × 3', { unitSystem: IMPERIAL_INCHES })).toBe(9);
    expect(resolveUnitExpr('-(1ft - 2in)', { unitSystem: IMPERIAL_INCHES })).toBe(-10);
  });

  it('reads adjacent terms as one compound value, sign carried across', () => {
    expect(resolveUnitExpr(`5' 3"`, { unitSystem: IMPERIAL_INCHES })).toBe(63);
    expect(resolveUnitExpr('-5ft 3in + 100%', { unitSystem: IMPERIAL_INCHES, percentOf: 3 })).toBe(-60);
  });

  it('refuses a product or quotient that is not a measure', () => {
    expect(() => resolveUnitExpr('2ft * 3ft', { unitSystem: IMPERIAL_INCHES })).toThrow(/two measures/);
    expect(() => resolveUnitExpr('2 / 3ft', { unitSystem: IMPERIAL_INCHES })).toThrow(/divide by a measure/);
  });

  it('resolves an offset unit alone, and refuses it inside arithmetic', () => {
    expect(resolveUnitExpr('-10degC', { unitSystem: TEMPERATURE })).toBeCloseTo(263.15);
    expect(() => resolveUnitExpr('1K + 2degC', { unitSystem: TEMPERATURE })).toThrow(/offset/);
  });

  it('names an unknown unit and a malformed expression', () => {
    expect(() => resolveUnitExpr('2furlong', { unitSystem: IMPERIAL_INCHES })).toThrow(/unknown unit 'furlong'/);
    expect(() => resolveUnitExpr('2ft +', { unitSystem: IMPERIAL_INCHES })).toThrow(/unitExpr/);
    expect(() => resolveUnitExpr('(2ft', { unitSystem: IMPERIAL_INCHES })).toThrow(/unitExpr/);
    expect(() => resolveUnitExpr('', { unitSystem: IMPERIAL_INCHES })).toThrow(/unitExpr/);
  });
});

describe('parseUnitExpr', () => {
  it('yields plain data that resolves again under another context', () => {
    const expr = JSON.parse(JSON.stringify(parseUnitExpr('50% + 2ft')));
    expect(resolveUnitExpr(expr, { unitSystem: IMPERIAL_INCHES, percentOf: 100 })).toBe(74);
    expect(resolveUnitExpr(expr, { unitSystem: IMPERIAL_INCHES, percentOf: 200 })).toBe(124);
  });
});
