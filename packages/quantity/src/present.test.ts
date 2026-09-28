import { afterEach, describe, expect, it } from 'vitest';
import {
  amount,
  bytes,
  compact,
  currency,
  decimal,
  displayKindOf,
  duration,
  fraction,
  fractionKind,
  integer,
  METRIC_MM,
  multiplier,
  nearestFraction,
  ordinal,
  parseAs,
  percent,
  present,
  qty,
  ratio,
  registerDisplayKind,
  retag,
  roman,
  tag,
  unit,
  zoom,
  type Display,
  type DisplayKind,
  type Quantity,
} from './index';

const MINUS = '−';

describe('quantity shape', () => {
  it('reads and retags a bare number as a bare number', () => {
    expect(amount(3)).toBe(3);
    expect(retag(3, 4)).toBe(4);
  });

  it('keeps a tagged value tagged through retag', () => {
    const q = tag(1 / 12, fraction(), 'in');
    const next = retag(q, 1 / 6);
    expect(next).toEqual({ value: 1 / 6, unit: 'in', display: { kind: 'fraction' } });
    expect(q.value).toBe(1 / 12);
  });

  it('round-trips through JSON unchanged', () => {
    const q: Quantity = tag(0.25, fraction({ maxDenominator: 16 }));
    expect(JSON.parse(JSON.stringify(q))).toEqual(q);
    expect(JSON.parse(JSON.stringify(qty(q)))).toEqual(q);
  });

  it("lets a value's own display win over the fallback", () => {
    expect(qty(tag(0.5, fraction()), percent()).text).toBe('1/2');
    expect(qty(0.5, percent()).text).toBe('50%');
  });

  it('shows an unknown kind as decimal and keeps its tag', () => {
    const q = tag(1.5, { kind: 'someone-elses', frob: 3 });
    expect(qty(q).text).toBe('1.5');
    expect(qty(q).with(2).raw).toEqual({ value: 2, display: { kind: 'someone-elses', frob: 3 } });
  });

  it('converts through a unit system, tagging the result', () => {
    expect(qty(tag(12, unit(), 'mm')).to('cm', METRIC_MM).text).toBe('1.2cm');
    expect(qty(25).to('cm', METRIC_MM).raw).toEqual({ value: 2.5, unit: 'cm' });
  });
});

/** [display, value, text, spoken] */
const CASES: [Display, number, string, string][] = [
  [decimal(), 1234.5678, '1,234.568', '1,234.568'],
  [decimal({ places: 2 }), -3, `${MINUS}3.00`, 'minus 3.00'],
  [integer(), 41.6, '42', '42'],
  [compact(), 2_000_000, '2.00M', '2 million'],
  [compact({ places: 1 }), 12.34, '12.3', '12.3'],
  [percent(), 0.25, '25%', '25 percent'],
  [fraction(), 1 / 12, '1/12', '1 over 12'],
  [fraction(), -0.75, `${MINUS}3/4`, 'minus 3 over 4'],
  [fraction({ mixed: true }), 1.5, '1 1/2', '1 and 1 over 2'],
  [fraction(), 1.5, '3/2', '3 over 2'],
  [fraction(), 2, '2', '2'],
  [fraction(), 0, '0', '0'],
  [fraction({ form: 'diagonal' }), 1 / 12, '¹⁄₁₂', '1 over 12'],
  [fraction({ form: 'diagonal', mixed: true }), 1.5, '1¹⁄₂', '1 and 1 over 2'],
  [fraction({ form: 'diagonal' }), -0.75, `${MINUS}³⁄₄`, 'minus 3 over 4'],
  [fraction({ form: 'diagonal' }), 2, '2', '2'],
  [fraction({ of: 'π' }), (3 * Math.PI) / 4, '3π/4', '3 pi over 4'],
  [fraction({ of: 'π' }), Math.PI / 2, 'π/2', 'pi over 2'],
  [fraction({ of: 'π' }), -Math.PI / 2, `${MINUS}π/2`, 'minus pi over 2'],
  [fraction({ of: 'π' }), 2 * Math.PI, '2π', '2 pi'],
  [fraction({ of: 'π' }), Math.PI, 'π', 'pi'],
  [fraction({ of: 'π' }), 0, '0', '0'],
  [fraction({ of: 'π', form: 'diagonal' }), (3 * Math.PI) / 4, '³⁄₄π', '3 pi over 4'],
  [fraction({ of: 'τ' }), Math.PI / 2, 'τ/4', 'tau over 4'],
  [fraction({ of: 'e' }), 2 * Math.E, '2e', '2 e'],
  [fraction({ of: { symbol: 'g', value: 9.80665, spoken: 'gee' } }), 9.80665 / 2, 'g/2', 'gee over 2'],
  [ratio(), 1 / 12, '1:12', '1 to 12'],
  [multiplier(), 2.5, '2.5×', '2.5 times'],
  [zoom(), 2.5, '2.5x', '2.5 times'],
  [zoom(), 1.5, '150%', '150 percent'],
  [unit('mm'), 12, '12mm', '12 millimeters'],
  [unit('in'), 1, '1in', '1 inch'],
  [unit('"'), 12, '12"', '12 inches'],
  [unit("'"), 1, "1'", '1 foot'],
  [unit('px'), 3, '3px', '3 pixels'],
  [unit('furlong', { spoken: ['furlong', 'furlongs'], space: true }), 1, '1 furlong', '1 furlong'],
  [currency('USD'), 12.5, '$12.50', '12.50 US dollars'],
  [currency('USD'), -3, `${MINUS}$3.00`, 'minus 3.00 US dollars'],
  [duration(), 3723, '1:02:03', '1 hour, 2 minutes, 3 seconds'],
  [duration({ places: 1 }), 65.5, '1:05.5', '1 minute, 5.5 seconds'],
  [duration({ style: 'units' }), 7503, '2h 5m 3s', '2 hours, 5 minutes, 3 seconds'],
  [duration({ style: 'units' }), 0, '0s', '0 seconds'],
  [bytes(), 1_200_000, '1.2 MB', '1.2 megabytes'],
  [bytes({ base: 1024 }), 1024, '1 KiB', '1 kibibyte'],
  [bytes(), 512, '512 B', '512 bytes'],
  [roman(), 12, 'XII', '12'],
  [roman({ lower: true }), 1994, 'mcmxciv', '1994'],
  [roman(), 0, '0', '0'],
  [ordinal(), 1, '1st', '1st'],
  [ordinal(), 22, '22nd', '22nd'],
  [ordinal(), 113, '113th', '113th'],
];

describe.each(CASES)('%o of %s', (display, value, text, spoken) => {
  it(`shows ${text} and speaks ${spoken}`, () => {
    const p = present(value, display);
    expect(p.text).toBe(text);
    expect(p.spoken).toBe(spoken);
  });
});

/** [display, typed, value] */
const PARSES: [Display, string, number][] = [
  [decimal(), `${MINUS}1,234.5`, -1234.5],
  [percent(), '25%', 0.25],
  [percent(), '25', 0.25],
  [fraction(), '1/12', 1 / 12],
  [fraction(), '1 1/2', 1.5],
  [fraction(), `${MINUS}3/4`, -0.75],
  [fraction(), '0.2', 0.2],
  [fraction(), '¹⁄₁₂', 1 / 12],
  [fraction(), '1¹⁄₂', 1.5],
  [fraction(), '1 ¹⁄₂', 1.5],
  [fraction(), `${MINUS}³⁄₄`, -0.75],
  [fraction({ of: 'π' }), '3π/4', (3 * Math.PI) / 4],
  [fraction({ of: 'π' }), '3pi/4', (3 * Math.PI) / 4],
  [fraction({ of: 'π' }), '3/4π', (3 * Math.PI) / 4],
  [fraction({ of: 'π' }), '³⁄₄π', (3 * Math.PI) / 4],
  [fraction({ of: 'π' }), 'π/2', Math.PI / 2],
  [fraction({ of: 'π' }), `${MINUS}π/2`, -Math.PI / 2],
  [fraction({ of: 'π' }), '2π', 2 * Math.PI],
  [fraction({ of: 'π' }), 'PI', Math.PI],
  [fraction({ of: 'π' }), '0.5', 0.5],
  [fraction({ of: 'τ' }), 'tau/4', Math.PI / 2],
  [ratio(), '1:4', 0.25],
  [multiplier(), '4x', 4],
  [zoom(), '150%', 1.5],
  [zoom(), '3x', 3],
  [unit('cm', { accepts: { cm: 1, mm: 0.1 } }), '12mm', 1.2],
  [unit('in', { accepts: { in: 1, ft: 12 } }), '5ft 3in', 63],
  [unit('in', { accepts: { in: 1, ft: 12 } }), '5\' 3"', 63],
  [unit('"'), '4in', 4],
  [currency('USD'), '$1,234.50', 1234.5],
  [duration(), '1:02:03', 3723],
  [duration(), '2m 5s', 125],
  [bytes(), '1.5 MB', 1_500_000],
  [bytes(), '2 KiB', 2048],
  [roman(), 'mcmxciv', 1994],
  [roman(), '12', 12],
  [ordinal(), '22nd', 22],
];

describe.each(PARSES)('parsing %o', (display, typed, value) => {
  it(`reads ${typed} as ${value}`, () => {
    expect(parseAs(typed, display)).toBeCloseTo(value, 10);
  });
});

it('refuses a constant on a mixed fraction, which has no honest text form', () => {
  // @ts-expect-error — `1 1/2π` reads as 1 + ½π.
  fraction({ of: 'π', mixed: true });
});

it('reads text it cannot parse as NaN', () => {
  expect(parseAs('abc', fraction())).toBeNaN();
  expect(parseAs('IIII', roman())).toBeNaN();
});

describe('round trips', () => {
  const displays: Display[] = [decimal({ maxPlaces: 6 }), fraction(), fraction({ of: 'π' }), fraction({ of: 'π', form: 'diagonal' }), fraction({ form: 'diagonal', mixed: true }), ratio(), percent({ places: 2 }), duration({ places: 2 }), roman()];
  it.each(displays)('reads back what %o shows', (display) => {
    for (const v of [1 / 12, 0.5, 3, 42]) {
      const shown = present(v, display).text;
      expect(present(parseAs(shown, display), display).text).toBe(shown);
    }
  });
});

describe('round trips in a locale', () => {
  const displays: Display[] = [decimal({ maxPlaces: 6 }), integer(), unit('mm', { places: 2 }), currency('EUR'), percent({ places: 2 })];
  it.each(['de-DE', 'fr-FR', 'de-CH', 'en-IN', 'es-ES'])('reads back what %s shows', (locale) => {
    for (const display of displays) {
      for (const v of [0.5, 3, 1234.5, 1_234_567]) {
        const shown = present(v, display, { locale }).text;
        expect(present(parseAs(shown, display, { locale }), display, { locale }).text).toBe(shown);
      }
    }
  });
});

describe('duration clock in a locale', () => {
  it("reads the locale's decimal before a fraction of a second", () => {
    expect(parseAs('4:05,5', duration(), { locale: 'de-DE' })).toBe(245.5);
    expect(parseAs('4:05.5', duration(), { locale: 'de-DE' })).toBe(245.5);
    expect(parseAs('1:02,500', duration(), { locale: 'de-DE' })).toBe(62.5);
    expect(parseAs('٤:٠٥٫٥', duration(), { locale: 'ar-EG' })).toBe(245.5);
  });

  it('keeps a comma out of the clock where it is not the decimal', () => {
    expect(parseAs('4:05,5', duration())).toBeNaN();
  });
});

it('reads back what ar-EG shows', () => {
  for (const display of [decimal({ maxPlaces: 6 }), integer()]) {
    for (const v of [0.5, 3, 1234.5, -1_234_567]) {
      const shown = present(v, display, { locale: 'ar-EG' }).text;
      expect(present(parseAs(shown, display, { locale: 'ar-EG' }), display, { locale: 'ar-EG' }).text).toBe(shown);
    }
  }
});

describe('html', () => {
  it('wraps named parts in data-part spans inside <data value>', () => {
    expect(present(1 / 4, fraction()).html).toBe(
      '<data value="0.25"><span data-part="numerator">1</span>/<span data-part="denominator">4</span></data>',
    );
    expect(present(12, unit('mm')).html).toBe(
      '<data value="12"><span data-part="number">12</span><span data-part="unit">mm</span></data>',
    );
  });

  it('escapes what it embeds', () => {
    expect(present(1, unit('<b>')).html).toContain('&lt;b&gt;');
  });
});

describe('mathml', () => {
  it('writes a fraction as mfrac, with a whole part when mixed', () => {
    expect(present(1 / 12, fraction()).mathml).toBe('<math><mfrac><mn>1</mn><mn>12</mn></mfrac></math>');
    expect(present((3 * Math.PI) / 4, fraction({ of: 'π' })).mathml).toBe(
      '<math><mfrac><mrow><mn>3</mn><mi>π</mi></mrow><mn>4</mn></mfrac></math>',
    );
    expect(present(Math.PI / 2, fraction({ of: 'π' })).mathml).toBe('<math><mfrac><mi>π</mi><mn>2</mn></mfrac></math>');
    expect(present(2 * Math.PI, fraction({ of: 'π' })).mathml).toBe('<math><mn>2</mn><mi>π</mi></math>');
    expect(present(-1.5, fraction({ mixed: true })).mathml).toBe(
      `<math><mo>${MINUS}</mo><mn>1</mn><mfrac><mn>1</mn><mn>2</mn></mfrac></math>`,
    );
  });

  it('is absent for a kind with no MathML form', () => {
    expect(present(3, unit('mm')).mathml).toBeUndefined();
  });
});

describe('nearestFraction', () => {
  it('finds the best fraction under the denominator cap', () => {
    expect(nearestFraction(Math.PI, 10)).toEqual([22, 7]);
    expect(nearestFraction(Math.PI, 200)).toEqual([355, 113]);
    expect(nearestFraction(1 / 45, 64)).toEqual([1, 45]);
    expect(nearestFraction(-0.3333333, 64)).toEqual([-1, 3]);
  });
});

describe('registerDisplayKind', () => {
  let unregister: (() => void) | undefined;
  afterEach(() => unregister?.());

  it('adds a kind from outside the package', () => {
    const hex: DisplayKind<{ kind: 'hex' }> = {
      kind: 'hex',
      format: (v) => [{ type: 'number', value: `0x${Math.round(v).toString(16)}` }],
      parse: (t) => Number.parseInt(t.replace(/^0x/, ''), 16),
    };
    unregister = registerDisplayKind(hex);
    expect(qty(255, { kind: 'hex' }).text).toBe('0xff');
    expect(parseAs('0x10', { kind: 'hex' })).toBe(16);
  });

  it('replaces a built-in, and removing it restores the built-in', () => {
    unregister = registerDisplayKind({ ...fractionKind, speak: () => 'one twelfth' });
    expect(qty(1 / 12, fraction()).spoken).toBe('one twelfth');
    unregister();
    unregister = undefined;
    expect(displayKindOf(fraction())).toBe(fractionKind);
    expect(qty(1 / 12, fraction()).spoken).toBe('1 over 12');
  });
});
