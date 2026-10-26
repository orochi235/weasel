import { describe, expect, it } from 'vitest';
import { MINUS_SIGN as MINUS } from '../number';
import { parseAs, partsOf, present } from '../present';
import type { Display } from '../quantity';
import { scientific } from './scientific';

/** [display, value, text, spoken] */
const CASES: [Display, number, string, string][] = [
  [scientific(), 1_234_567, '1.23 × 10⁶', '1.23 times 10 to the power of 6'],
  [scientific(), 0.000123, '1.23 × 10⁻⁴', '1.23 times 10 to the power of minus 4'],
  [scientific(), -1_234_567, `${MINUS}1.23 × 10⁶`, 'minus 1.23 times 10 to the power of 6'],
  [scientific(), 5, '5.00 × 10⁰', '5.00 times 10 to the power of 0'],
  [scientific(), 0, '0', '0'],
  [scientific({ digits: 4 }), 1_234_567, '1.235 × 10⁶', '1.235 times 10 to the power of 6'],
  [scientific({ digits: 1 }), 96_000, '1 × 10⁵', '1 times 10 to the power of 5'],
  [scientific({ engineering: true }), 12_345, '12.3 × 10³', '12.3 times 10 to the power of 3'],
  [scientific({ engineering: true }), 0.00045, '450 × 10⁻⁶', '450 times 10 to the power of minus 6'],
  [scientific({ form: 'e' }), 1_234_567, '1.23e6', '1.23 times 10 to the power of 6'],
  [scientific({ form: 'e' }), -0.000123, `${MINUS}1.23e${MINUS}4`, 'minus 1.23 times 10 to the power of minus 4'],
];

describe.each(CASES)('%o of %s', (display, value, text, spoken) => {
  it(`shows ${text} and speaks ${spoken}`, () => {
    const p = present(value, display);
    expect(p.text).toBe(text);
    expect(p.spoken).toBe(spoken);
  });
});

describe('scientific', () => {
  it('names the mantissa, the base, and the exponent as parts', () => {
    expect(partsOf(1_234_567, scientific())).toEqual([
      { type: 'number', value: '1.23' },
      { type: 'literal', value: ' × ' },
      { type: 'base', value: '10' },
      { type: 'exponent', value: '⁶' },
    ]);
  });

  it("writes the mantissa in the locale's form", () => {
    expect(present(1_234_567, scientific(), { locale: 'de-DE' }).text).toBe('1,23 × 10⁶');
  });

  it('has a MathML form with a raised exponent', () => {
    expect(present(0.000123, scientific()).mathml).toBe(
      '<math><mn>1.23</mn><mo>×</mo><msup><mn>10</mn><mrow><mo>−</mo><mn>4</mn></mrow></msup></math>',
    );
  });

  it.each([
    ['1.23 × 10⁶', 1_230_000],
    ['1.23 × 10⁻⁴', 0.000123],
    ['1.23e6', 1_230_000],
    ['1.23E-4', 0.000123],
    ['1.23*10^6', 1_230_000],
    ['1.23 x 10^-4', 0.000123],
    [`${MINUS}2 × 10³`, -2000],
    ['42', 42],
    ['10⁶', 1_000_000],
  ])('reads %s back', (typed, value) => {
    expect(parseAs(typed, scientific())).toBeCloseTo(value, 12);
  });

  it.each(['nonsense', '× 10³', '1.2 × 11³'])('reads %s as NaN', (typed) => {
    expect(parseAs(typed, scientific())).toBeNaN();
  });

  it('reads every shown text back to the number it shows', () => {
    for (const [display, value] of CASES) {
      const shown = present(value, display).text;
      const digits = (display as { digits?: number }).digits ?? 3;
      expect(parseAs(shown, display), shown).toBeCloseTo(Number(value.toPrecision(digits)), 12);
    }
  });

  it("reads a mantissa in the locale's form", () => {
    expect(parseAs('2,5 × 10³', scientific(), { locale: 'de-DE' })).toBe(2500);
  });
});
