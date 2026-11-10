import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { formatCompact, parseNumber, parseSignedNumber, roundWhole, formatNumber, type UnitTable } from './number';
import { decimalPlaces } from './places';
import { decimal } from './kinds/plain';
import { present } from './present';
import { finite, locale, numberish, runs, timeoutFor, typed } from './pbt.fixture';

const RUNS = runs(200);
const TIMEOUT = timeoutFor(200, 2);
const FEET: UnitTable = { in: 1, ft: 12 };

describe('parseNumber, property', () => {
  it('reads back a decimal display exactly when it shows every place the value has', () => {
    const tally = { grouped: 0 };
    fc.assert(fc.property(typed, fc.integer({ min: 0, max: 3 }), locale, fc.boolean(), ({ value, places }, extra, loc, grouping) => {
      const text = present(value, decimal({ places: places + extra, grouping }), { locale: loc }).text;
      if (grouping && Math.abs(value) >= 1000) tally.grouped++;
      expect(parseNumber(text, undefined, loc), `${text} in ${loc}`).toBe(value);
    }), RUNS);
    expect(tally.grouped).toBeGreaterThan(RUNS.numRuns / 10);
  }, TIMEOUT);

  it('reads back a rounded decimal display to within half its last place', () => {
    fc.assert(fc.property(typed, fc.integer({ min: 0, max: 5 }), locale, ({ value }, places, loc) => {
      const text = present(value, decimal({ places }), { locale: loc }).text;
      const got = parseNumber(text, undefined, loc);
      expect(Math.abs(got - value), `${text} in ${loc}`).toBeLessThanOrEqual(0.5 * 10 ** -places * (1 + 1e-9) + Math.abs(value) * 1e-15);
    }), RUNS);
  }, TIMEOUT);

  it('reads what formatNumber writes ungrouped, through parseSignedNumber', () => {
    fc.assert(fc.property(typed, ({ value }) => {
      const text = formatNumber(value, { useGrouping: false, maximumFractionDigits: 20 });
      expect(parseSignedNumber(text), text).toBe(value);
    }), RUNS);
  });

  it('never throws, and answers a finite number or NaN, whatever the text', () => {
    let read = 0;
    fc.assert(fc.property(numberish, locale, fc.boolean(), (text, loc, withUnits) => {
      const n = parseNumber(text, withUnits ? FEET : undefined, loc);
      if (!Number.isNaN(n)) {
        read++;
        expect(Number.isFinite(n), `${JSON.stringify(text)} in ${loc}`).toBe(true);
      }
    }), { numRuns: RUNS.numRuns * 5 });
    expect(read).toBeGreaterThan(0);
  }, TIMEOUT * 5);

  it('scales a magnitude suffix by its power of ten, without float dust', () => {
    const suffix = fc.constantFrom(['k', 3], ['K', 3], ['m', 6], ['M', 6], ['b', 9], ['t', 12]) as fc.Arbitrary<[string, number]>;
    fc.assert(fc.property(fc.integer({ min: -1e6, max: 1e6 }), fc.integer({ min: 0, max: 4 }), suffix, fc.constantFrom('', ' '), (n, places, [s, e], gap) => {
      const text = `${n / 10 ** places}${gap}${s}`;
      expect(parseNumber(text), text).toBe(Number(`${n}e${e - places}`));
    }), RUNS);
  });

  it('sums a compound value term by term, a leading sign carried across every term', () => {
    const amount = fc.integer({ min: 0, max: 100_000 }).chain((n) => fc.integer({ min: 0, max: 3 }).map((p) => n / 10 ** p));
    const spell = fc.record({ ft: fc.constantFrom('ft', "'", '′', 'FT'), inch: fc.constantFrom('in', '"', '″', '”') });
    fc.assert(fc.property(amount, amount, spell, fc.constantFrom('', '-', '−', '+'), fc.constantFrom(' ', '', '  '), locale, (a, b, { ft, inch }, sign, gap, loc) => {
      // In a locale that groups with an apostrophe, `5'300"` is 5,300 inches: where both read, the locale wins.
      if (loc === 'de-CH' && ft === "'") return;
      const local = (n: number) => n.toLocaleString(loc, { useGrouping: false, maximumFractionDigits: 3 });
      const text = `${sign}${local(a)}${ft}${gap}${local(b)}${inch}`;
      const want = (sign === '-' || sign === '−' ? -1 : 1) * (a * 12 + b);
      const got = parseNumber(text, FEET, loc);
      expect(Math.abs(got - want), text).toBeLessThanOrEqual(Math.abs(want) * 1e-14);
    }), RUNS);
  });
});

describe('formatCompact, property', () => {
  it('reads back to three significant figures, or to its places below a thousand', () => {
    const tally = { compact: 0, plain: 0 };
    fc.assert(fc.property(finite(1e14), fc.integer({ min: 0, max: 3 }), (value, places) => {
      const text = formatCompact(value, places);
      const got = parseNumber(text);
      if (Math.abs(got) >= 1000) {
        tally.compact++;
        expect(Math.abs(got - value), text).toBeLessThanOrEqual(Math.abs(value) * 5e-3 * (1 + 1e-9));
      } else {
        tally.plain++;
        expect(Math.abs(got - value), text).toBeLessThanOrEqual(0.5 * 10 ** -places * (1 + 1e-9) + Math.abs(value) * 1e-15);
      }
    }), RUNS);
    expect(tally.compact).toBeGreaterThan(0);
    expect(tally.plain).toBeGreaterThan(0);
  });
});

describe('roundWhole and decimalPlaces, property', () => {
  it('rounds to the nearest whole number, a half away from zero, alike on either side of it', () => {
    fc.assert(fc.property(finite(1e12), (x) => {
      const r = roundWhole(x);
      expect(Number.isInteger(r)).toBe(true);
      expect(Math.abs(r - x)).toBeLessThanOrEqual(0.5);
      expect(Object.is(roundWhole(-x), r === 0 ? 0 : -r)).toBe(true);
    }), RUNS);
  });

  it('counts no more places than a typed value was written with, and enough to write it again', () => {
    fc.assert(fc.property(typed, ({ value, places }) => {
      const p = decimalPlaces(value);
      expect(p).toBeLessThanOrEqual(places);
      expect(Number(value.toFixed(p))).toBe(value);
    }), RUNS);
  });
});
