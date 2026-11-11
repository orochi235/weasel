/**
 * The legacy `kern` table, which a face with no GPOS kerning is kerned by: Inter with its GPOS renamed out of reach
 * and a format 0 `kern` table of random pairs added. Every pair kerns by its value over the em and every other pair
 * by 0; damaged anywhere in the table, the face is refused or kerns every pair by a finite number.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { interBytes, mutate, mutations, runs, tablesOf, tally, timeoutFor, withTable } from '../pbt.fixture';
import { createOpenTypeParser } from './opentypeParser';

const RUNS = 150;
const parse = createOpenTypeParser();

/** Inter with no table named GPOS. */
const NO_GPOS = (() => {
  const bytes = interBytes();
  const i = tablesOf(bytes).findIndex((t) => t.tag === 'GPOS');
  new DataView(bytes).setUint8(12 + i * 16, 0x78);
  return bytes;
})();

/** A version 0 `kern` table of one format 0 subtable holding `pairs`. */
function kernTable(pairs: readonly [number, number, number][]): Uint8Array {
  const out = new Uint8Array(4 + 14 + pairs.length * 6);
  const v = new DataView(out.buffer);
  v.setUint16(2, 1);
  v.setUint16(4 + 2, 14 + pairs.length * 6);
  v.setUint16(4 + 4, 0x0001);
  v.setUint16(4 + 6, pairs.length);
  pairs.forEach(([l, r, value], i) => {
    v.setUint16(18 + i * 6, l);
    v.setUint16(18 + i * 6 + 2, r);
    v.setInt16(18 + i * 6 + 4, value);
  });
  return out;
}

const letter = fc.integer({ min: 0x41, max: 0x7a });
const pairs = fc.uniqueArray(fc.tuple(letter, letter, fc.integer({ min: -32768, max: 32767 })), {
  selector: ([l, r]) => `${l},${r}`, minLength: 1, maxLength: 40,
});

describe('the kern table, read back', () => {
  it('kerns each pair it holds by its value over the em, and every other pair by 0', async () => {
    const t = tally();
    const plain = (await parse(NO_GPOS)).embedding!();
    await fc.assert(fc.asyncProperty(pairs, fc.array(fc.tuple(letter, letter), { maxLength: 8 }), async (list, others) => {
      const byGlyph = list.map(([l, r, value]) => [plain.glyphIndexOf(l), plain.glyphIndexOf(r), value] as const)
        .filter((p): p is readonly [number, number, number] => p[0] !== null && p[1] !== null);
      const face = await parse(withTable(NO_GPOS, 'kern', kernTable(byGlyph.map(([l, r, v]) => [l, r, v]))));
      const mapped = list.filter(([l, r]) => plain.glyphIndexOf(l) !== null && plain.glyphIndexOf(r) !== null);
      const want = new Map(mapped.map(([l, r, v]) => [`${l},${r}`, v]));
      for (const [l, r] of [...list.map(([a, b]) => [a, b] as const), ...others]) {
        const value = want.get(`${l},${r}`) ?? 0;
        expect(face.kernOf(l, r)).toBeCloseTo(value / face.unitsPerEm, 12);
        t.count(value === 0 ? 'zero' : 'kerned');
      }
    }), runs(RUNS));
    t.atLeast('kerned', 500);
    t.atLeast('zero', 50);
  }, timeoutFor(RUNS, 40));

  it('refuses a face whose kern table is damaged, or kerns every pair by a finite number', async () => {
    const t = tally();
    await fc.assert(fc.asyncProperty(pairs, mutations(4), fc.array(fc.tuple(letter, letter), { minLength: 1, maxLength: 8 }), async (list, edits, asked) => {
      const bytes = withTable(NO_GPOS, 'kern', kernTable(list.map(([l, r, v]) => [l - 0x20, r - 0x20, v])));
      const kern = tablesOf(bytes).find((r) => r.tag === 'kern')!;
      let face;
      try {
        face = await parse(mutate(bytes, edits, kern.offset, kern.offset + kern.length));
      } catch (err) {
        expect(err).toBeInstanceOf(Error);
        return t.count('refused');
      }
      t.count('read');
      for (const [l, r] of asked) expect(Number.isFinite(face.kernOf(l, r))).toBe(true);
    }), runs(RUNS));
    t.atLeast('read', 50);
  }, timeoutFor(RUNS, 40));
});
