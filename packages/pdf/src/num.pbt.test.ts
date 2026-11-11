/**
 * Property test of `num` at every precision a caller can ask for: what it writes is PDF real syntax
 * with no trailing zero after a point and no exponent, within half its last place of the number, and
 * the same again when that is written back.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { num } from './num';
import { anyFinite, runs, tally, timeoutFor } from './pbt.fixture';
import { NUMBER } from './pdfReader.fixture';

const RUNS = 400;

describe('num at any precision', () => {
  it('writes within half its last place, in PDF syntax, and reads back to itself', () => {
    const seen = tally();
    fc.assert(
      fc.property(anyFinite, fc.integer({ min: 0, max: 40 }), (n, decimals) => {
        const s = num(n, decimals);
        expect(s).toMatch(NUMBER);
        expect(s).not.toMatch(/\.\d*0$/);
        expect(s).not.toMatch(/^-0(\.0*)?$/);
        const places = s.includes('.') ? s.length - s.indexOf('.') - 1 : 0;
        expect(places).toBeLessThanOrEqual(decimals);
        const back = Number(s);
        expect(Math.abs(back - n)).toBeLessThanOrEqual(0.5 * 10 ** -decimals + Math.abs(n) * Number.EPSILON * 4);
        expect(num(back, decimals)).toBe(s);
        seen.count(decimals === 0 ? 'whole' : 'decimals');
        if (decimals === 0 && Number.isInteger(n) && n % 10 === 0 && n !== 0) seen.count('round ten');
      }),
      runs(RUNS),
    );
    seen.atLeast('whole', 5);
    seen.atLeast('decimals', 100);
  }, timeoutFor(RUNS, 2));
});
