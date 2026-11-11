/**
 * Property tests of a number row's text: under the default display it reads back, through the same display, as the
 * value it shows for any finite value with at most 20 decimal places, and within half the twentieth place for any
 * other; under a display of fewer places, within half its last place; infinities read back through their word,
 * the row's own included; and the unit follows a finite value only.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { decimal, parseAs, withUnit } from '@weasel-js/quantity';
import { menuNumberDisplay, menuNumberText } from './numberText';
import { runs, tally, timeoutFor } from './pbt.fixture';

const RUNS = 500;

/** How many decimal places `v`'s shortest spelling has, uncapped. */
function placesOf(v: number): number {
  const [mantissa, exp = '0'] = String(v).split('e');
  const dot = mantissa!.indexOf('.');
  return Math.max(0, (dot < 0 ? 0 : mantissa!.length - dot - 1) - Number(exp));
}

const finite = fc.oneof(
  fc.double({ noNaN: true, noDefaultInfinity: true }),
  fc.integer({ min: -1e6, max: 1e6 }).map((n) => n / 1000),
  fc.double({ min: -1, max: 1, noNaN: true }),
  fc.constantFrom(0, -0, 5e-324, 1e-21, 4.9e-21, 1e21, Number.MAX_VALUE, -Number.MAX_SAFE_INTEGER, 0.1 + 0.2),
);

describe('menuNumberText', () => {
  it('reads back under the default display, exactly to 20 places and within half the twentieth past them', () => {
    const t = tally();
    fc.assert(fc.property(finite, (v) => {
      const text = menuNumberText(v);
      const back = parseAs(text, menuNumberDisplay({}));
      if (placesOf(v) <= 20) { expect(back === v, `${v} → ${text} → ${back}`).toBe(true); t.count('exact'); return; }
      expect(Math.abs(back - v)).toBeLessThanOrEqual(5e-21);
      t.count('rounded');
    }), runs(RUNS));
    t.atLeast('exact', RUNS / 4);
    t.atLeast('rounded', RUNS / 50);
  }, timeoutFor(RUNS, 1));

  it('reads back within half the last place of a display with fewer', () => {
    fc.assert(fc.property(fc.double({ min: -1e9, max: 1e9, noNaN: true }), fc.integer({ min: 0, max: 6 }), (v, places) => {
      const e = { display: decimal({ maxPlaces: places }) };
      const back = parseAs(menuNumberText(v, e), menuNumberDisplay(e));
      expect(Math.abs(back - v)).toBeLessThanOrEqual(0.5 * 10 ** -places * (1 + 1e-9) + Math.abs(v) * 1e-15);
    }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('reads an infinity back through its word, and writes the unit after a finite value only', () => {
    fc.assert(fc.property(fc.oneof(finite, fc.constantFrom(Infinity, -Infinity)), fc.option(fc.constantFrom('never', 'forever', 'no limit'), { nil: undefined }),
      fc.option(fc.constantFrom('px', '°', '%', 'mm'), { nil: undefined }), (v, word, suffix) => {
        const e = { ...(word ? { infinity: word } : {}), ...(suffix ? { suffix } : {}) };
        const text = menuNumberText(v, e);
        const bare = menuNumberText(v, word ? { infinity: word } : {});
        if (Number.isFinite(v)) expect(text).toBe(withUnit(bare, suffix));
        else {
          expect(text).toBe(bare);
          expect(parseAs(text, menuNumberDisplay(e))).toBe(v);
        }
      }), runs(RUNS));
  }, timeoutFor(RUNS, 1));

  it('writes a dash for no value', () => {
    expect(menuNumberText(undefined, { suffix: 'px' })).toBe('—');
  });
});
