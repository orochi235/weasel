import { describe, expect, it } from 'vitest';
import { duration } from './kinds/measure';
import { parseAs, present } from './present';
import { spinKey } from './spin';
import { endlessTrack } from './endless';
import { parseUnitExpr, resolveUnitExpr } from './unitExpr';
import { IMPERIAL_INCHES } from './units';

describe('counterexamples the property tests shrank to', () => {
  it('a units-style duration reads its seconds back in a locale that groups with a period', () => {
    const d = duration({ style: 'units', places: 3 });
    const text = present(0.01, d, { locale: 'da-DK' }).text;
    expect(text).toBe('0.010s');
    expect(parseAs(text, d, { locale: 'da-DK' })).toBe(0.01);
    expect(parseAs('1h 2m 3,250s', d, { locale: 'de-DE' })).toBe(3723.25);
    expect(parseAs('1.500s', d, { locale: 'de-DE' })).toBe(1.5);
  });

  it('a step down from an endless max lands on the step grid', () => {
    const bounds = { step: 0.1, min: -15.1, max: 4.1, endless: 'both' as const };
    expect(spinKey('End', 0, bounds)).toBe(Infinity);
    expect(spinKey('PageDown', Infinity, bounds)).toBe(3.2);
    expect(spinKey('PageUp', -Infinity, bounds)).toBe(-14.2);
    expect(endlessTrack(-15.1, 4.1, 0.1, 'both')).toMatchObject({ min: -15.2, max: 4.2 });
  });

  it('a unit expression refuses a literal past the range of a number', () => {
    expect(() => parseUnitExpr('9'.repeat(400))).toThrow(/^unitExpr: .* past the range of a number/);
    expect(() => resolveUnitExpr(`${'9'.repeat(400)}ft`, { unitSystem: IMPERIAL_INCHES })).toThrow(/past the range/);
  });

  it('a unit expression refuses a division by zero, and a result past the range of a number', () => {
    expect(() => resolveUnitExpr('1/0')).toThrow(/^unitExpr: cannot divide by zero/);
    expect(() => resolveUnitExpr('0/0')).toThrow(/^unitExpr: cannot divide by zero/);
    expect(() => resolveUnitExpr(`1${'0'.repeat(300)}*1${'0'.repeat(300)}`)).toThrow(/^unitExpr: the result is past the range/);
  });

  it('a compound value in a unit expression is a run of measures only', () => {
    expect(() => parseUnitExpr('2 3')).toThrow(/not a complete expression/);
    expect(() => parseUnitExpr('1ft 2')).toThrow(/not a complete expression/);
    expect(() => parseUnitExpr('2 3in')).toThrow(/not a complete expression/);
    expect(resolveUnitExpr('5ft 3in 1yd', { unitSystem: IMPERIAL_INCHES })).toBe(99);
  });
});
