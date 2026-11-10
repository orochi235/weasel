import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { compact, decimal, integer } from './kinds/plain';
import { fraction, multiplier, nearestFraction, percent, ratio, readableFraction, zoom } from './kinds/proportion';
import { bytes, currency, duration, unit } from './kinds/measure';
import { ordinal, roman } from './kinds/numeral';
import { scientific } from './kinds/scientific';
import { roundWhole } from './number';
import { parseAs, present } from './present';
import { endless, type Display } from './quantity';
import { finite, locale, LOCALES, numberish, runs, timeoutFor, typed } from './pbt.fixture';

const RUNS = runs(150);
const TIMEOUT = timeoutFor(150, 3);

/** Half of the last place shown, with room for the double the parse lands on. */
const half = (places: number, value: number) => 0.5 * 10 ** -places * (1 + 1e-9) + Math.abs(value) * 1e-14;

interface Case {
  name: string;
  value: fc.Arbitrary<number>;
  display: fc.Arbitrary<Display>;
  /** Locales the kind formats in; the rest always write `en-US`. */
  locales: fc.Arbitrary<string>;
  /** How far the reading may land from the value. */
  within: (value: number, d: Display) => number;
}

const places = fc.integer({ min: 0, max: 4 });
const value = typed.map((t) => t.value);
const en = fc.constant('en-US');

const CASES: Case[] = [
  {
    name: 'integer', value, locales: locale, display: fc.boolean().map((grouping) => integer({ grouping })),
    within: () => 0.5,
  },
  {
    name: 'percent', value: value.map((v) => v / 1000), locales: locale, display: places.map((p) => percent({ places: p })),
    within: (v, d) => half((d.places as number) + 2, v),
  },
  {
    name: 'currency', value, locales: locale,
    display: fc.record({ code: fc.constantFrom('USD', 'EUR', 'JPY', 'INR', 'CHF', 'GBP'), places: fc.option(places, { nil: undefined }) })
      .map(({ code, places }) => currency(code, places === undefined ? {} : { places })),
    within: (v, d) => half((d.places as number | undefined) ?? (d.currency === 'JPY' ? 0 : 2), v),
  },
  {
    name: 'multiplier', value, locales: locale, display: places.map((p) => multiplier({ places: p })),
    within: (v, d) => half(d.places as number, v),
  },
  {
    name: 'unit', value, locales: locale,
    display: fc.record({ u: fc.constantFrom('mm', 'in', 'ft', 'deg', 'px', '%', 's'), p: places, space: fc.boolean(), compact: fc.boolean() })
      .map(({ u, p, space, compact }) => unit(u, { places: p, space, compact })),
    within: (v, d) => half(d.places as number, v),
  },
  {
    name: 'duration', value: value.map((v) => v / 100), locales: locale,
    display: fc.record({ style: fc.constantFrom('clock', 'units') as fc.Arbitrary<'clock' | 'units'>, p: places })
      .map(({ style, p }) => duration({ style, places: p })),
    within: (v, d) => half(d.places as number, v),
  },
  {
    name: 'bytes', value: fc.integer({ min: -1e15, max: 1e15 }), locales: locale,
    display: fc.record({ base: fc.constantFrom(1000, 1024) as fc.Arbitrary<1000 | 1024>, p: places })
      .map(({ base, p }) => bytes({ base, places: p })),
    // A step's places of whatever unit the value lands in: at most base^5 per unit, and whole bytes below one.
    within: (v, d) => {
      const base = d.base as number;
      let scale = 1;
      while (Math.abs(v) / scale >= base && scale < base ** 5) scale *= base;
      return scale === 1 ? 0.5 : half(d.places as number, v / scale) * scale * base;
    },
  },
  {
    name: 'scientific', value: finite(1e30).filter((v) => v === 0 || Math.abs(v) > 1e-30), locales: locale,
    display: fc.record({ digits: fc.integer({ min: 1, max: 8 }), engineering: fc.boolean(), form: fc.constantFrom('superscript', 'e') as fc.Arbitrary<'superscript' | 'e'> })
      .map((o) => scientific(o)),
    within: (v, d) => Math.abs(v) * 0.5 * 10 ** (1 - (d.digits as number)) * (1 + 1e-9) + Math.abs(v) * 1e-14,
  },
  {
    name: 'ordinal', value, locales: fc.constantFrom('en-US', 'en-GB', 'de-DE', 'ar-EG'), display: fc.constant(ordinal()),
    within: () => 0.5,
  },
  {
    name: 'compact', value: finite(1e14), locales: en, display: places.map((p) => compact({ places: p })),
    within: (v, d) => (Math.abs(v) >= 999 ? Math.abs(v) * 5e-3 * (1 + 1e-9) : half(d.places as number, v)),
  },
];

describe('present then parseAs, property', () => {
  for (const c of CASES) {
    it(`${c.name}: reads back the value it shows, to the precision it shows it`, () => {
      fc.assert(fc.property(c.value, c.display, c.locales, (v, d, loc) => {
        const text = present(v, d, { locale: loc }).text;
        const got = parseAs(text, d, { locale: loc });
        expect(Math.abs(got - v), `${text} under ${JSON.stringify(d)} in ${loc}`).toBeLessThanOrEqual(c.within(v, d));
      }), RUNS);
    }, TIMEOUT);
  }

  it('integer and ordinal read back exactly the whole number they round to', () => {
    fc.assert(fc.property(value, fc.constantFrom(...LOCALES), (v, loc) => {
      expect(parseAs(present(v, integer(), { locale: loc }).text, integer(), { locale: loc })).toBe(roundWhole(v));
      expect(parseAs(present(v, ordinal()).text, ordinal())).toBe(roundWhole(v));
    }), RUNS);
  }, TIMEOUT);

  it('roman reads back every whole number it can write, in either case', () => {
    fc.assert(fc.property(fc.integer({ min: 1, max: 3999 }), fc.boolean(), (n, lower) => {
      const d = roman({ lower });
      expect(parseAs(present(n, d).text, d)).toBe(n);
    }), RUNS);
  });

  it('fraction and ratio read back the very fraction they show', () => {
    const tally = { mixed: 0, constant: 0 };
    const display = fc.record({
      max: fc.integer({ min: 1, max: 1000 }),
      form: fc.constantFrom('inline', 'diagonal', 'stacked') as fc.Arbitrary<'inline' | 'diagonal' | 'stacked'>,
      shape: fc.constantFrom('plain', 'mixed', 'π', 'τ', 'e'),
    });
    fc.assert(fc.property(finite(1e4), display, locale, (v, { max, form, shape }, loc) => {
      const of = shape === 'π' || shape === 'τ' || shape === 'e' ? shape : undefined;
      const d = of ? fraction({ maxDenominator: max, form, of }) : fraction({ maxDenominator: max, form, mixed: shape === 'mixed' });
      const k = of === 'π' ? Math.PI : of === 'τ' ? 2 * Math.PI : of === 'e' ? Math.E : 1;
      const [n, den] = readableFraction(v / k, max);
      if (shape === 'mixed' && Math.abs(n) > den) tally.mixed++;
      if (of) tally.constant++;
      const text = present(v, d, { locale: loc }).text;
      const want = (n / den) * k;
      const got = parseAs(text, d, { locale: loc });
      expect(Math.abs(got - want), `${text} under ${JSON.stringify(d)}`).toBeLessThanOrEqual(Math.abs(want) * 1e-14);
      const r = ratio({ maxDenominator: max });
      const [a, b] = readableFraction(v, max);
      const back = parseAs(present(v, r, { locale: loc }).text, r, { locale: loc });
      expect(Math.abs(back - a / b)).toBeLessThanOrEqual(Math.abs(a / b) * 1e-15);
    }), RUNS);
    expect(tally.mixed).toBeGreaterThan(0);
    expect(tally.constant).toBeGreaterThan(0);
  }, TIMEOUT);

  it('zoom reads back a whole percent at 2x and below, a tenth above, and a whole number past 100x', () => {
    fc.assert(fc.property(fc.double({ min: 0.001, max: 1e5, noNaN: true }), (z) => {
      const got = parseAs(present(z, zoom()).text, zoom());
      const tol = z <= 2 ? 0.005 : z >= 100 ? 0.5 : 0.05;
      expect(Math.abs(got - z), present(z, zoom()).text).toBeLessThanOrEqual(tol * (1 + 1e-9) + z * 1e-14);
    }), RUNS);
  });

  it('reads back ±Infinity from the word any display shows it with', () => {
    const word = fc.option(fc.constantFrom('never', 'unlimited', 'Forever', { text: 'no limit', spoken: 'without limit', negative: 'none' }), { nil: undefined });
    const kind = fc.constantFrom<Display>(decimal(), integer(), percent(), unit('ms'), duration(), fraction(), scientific(), compact(), zoom(), currency('USD'));
    fc.assert(fc.property(kind, word, fc.constantFrom(Infinity, -Infinity), locale, (d, w, inf, loc) => {
      const shown = w === undefined ? d : endless(d, w);
      const p = present(inf, shown, { locale: loc });
      expect(parseAs(p.text, shown, { locale: loc }), p.text).toBe(inf);
      expect(parseAs(p.spoken, shown, { locale: loc }), p.spoken).toBe(inf);
    }), RUNS);
  });

  it('never throws while reading, whatever the text and the display', () => {
    const d = fc.constantFrom<Display>(
      decimal(), integer(), percent(), unit('ft', { accepts: { ft: 12, in: 1 } }), duration(), bytes(), fraction(), fraction({ of: 'π' }),
      ratio(), multiplier(), zoom(), compact(), scientific(), roman(), ordinal(), currency('EUR'), { kind: 'no-such-kind' },
    );
    fc.assert(fc.property(numberish, d, locale, (text, display, loc) => {
      const n = parseAs(text, display, { locale: loc });
      expect(typeof n).toBe('number');
    }), { numRuns: RUNS.numRuns * 3 });
  }, TIMEOUT * 3);

  it('nearestFraction is never beaten by a smaller denominator', () => {
    fc.assert(fc.property(finite(100), fc.integer({ min: 1, max: 50 }), (x, max) => {
      const [n, den] = nearestFraction(x, max);
      expect(den).toBeGreaterThanOrEqual(1);
      expect(den).toBeLessThanOrEqual(max);
      const err = Math.abs(n / den - x);
      for (let q = 1; q <= max; q++) {
        const best = Math.abs(Math.round(x * q) / q - x);
        expect(err, `${n}/${den} against ${Math.round(x * q)}/${q} for ${x}`).toBeLessThanOrEqual(best + 1e-12);
      }
    }), RUNS);
  });
});
