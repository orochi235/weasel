/**
 * `gposPairKerning` fuzzed over the repo's Inter with its table directory and GPOS table cut, overwritten, and
 * zeroed: it answers null or a kerning function, and that function answers a whole number of font units for any
 * pair, the same each time, without throwing.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { interBytes, mutate, mutations, runs, tablesOf, tally, timeoutFor } from '../pbt.fixture';
import { gposPairKerning } from './gposKerning';

const RUNS = 300;
const INTER = interBytes();
const GPOS = tablesOf(INTER).find((t) => t.tag === 'GPOS')!;
const DIRECTORY_END = 12 + tablesOf(INTER).length * 16;
/** The header of GPOS, its lists, and its first lookups' headers: where a corrupt offset sends the reader astray. */
const GPOS_HEAD = 512;

const glyph = fc.oneof(fc.integer({ min: 0, max: 220 }), fc.constantFrom(0xffff, 0x8000));
const region = fc.constantFrom('directory', 'gposHead', 'gpos', 'anywhere');
const bounds = (r: string): [number, number] =>
  r === 'directory' ? [0, DIRECTORY_END]
    : r === 'gposHead' ? [GPOS.offset, GPOS.offset + GPOS_HEAD]
      : r === 'gpos' ? [GPOS.offset, GPOS.offset + GPOS.length]
        : [0, INTER.byteLength];

describe('gposPairKerning, fuzzed', () => {
  it('kerns the untouched font through its extension lookup', () => {
    const kern = gposPairKerning(INTER)!;
    let nonzero = 0;
    for (let l = 1; l < 120; l++) for (let r = 1; r < 120; r++) if (kern(l, r) !== 0) nonzero++;
    expect(nonzero).toBeGreaterThan(50);
  });

  it('answers null or a function that kerns any pair by a whole number, without throwing', () => {
    const t = tally();
    fc.assert(fc.property(mutations(), region, fc.array(fc.tuple(glyph, glyph), { minLength: 1, maxLength: 12 }),
      (edits, where, pairs) => {
        const [from, to] = bounds(where);
        const kern = gposPairKerning(mutate(INTER, edits, from, to));
        if (!kern) { t.count('null'); return; }
        t.count('kerns');
        for (const [l, r] of pairs) {
          const k = kern(l, r);
          expect(Number.isInteger(k)).toBe(true);
          expect(kern(l, r)).toBe(k);
          if (k !== 0) t.count('nonzero');
        }
      }), runs(RUNS));
    t.atLeast('kerns', 50);
    t.atLeast('null', 5);
    t.atLeast('nonzero', 20);
  }, timeoutFor(RUNS, 5));
});

describe('gposPairKerning, shrunk', () => {
  it('reads past a kern feature record whose offset points at its own list, which opentype.js accepts', async () => {
    const bytes = INTER.slice(0);
    // FeatureList sits 60 bytes into Inter's GPOS; its first record's offset is 6 bytes into the list.
    new DataView(bytes).setUint16(GPOS.offset + 66, 0);
    const { parse } = await import('opentype.js');
    expect(() => parse(bytes)).not.toThrow();
    expect(() => gposPairKerning(bytes)?.(5, 6)).not.toThrow();
  });

  it('answers null for a font cut off inside its table directory', () => {
    expect(gposPairKerning(INTER.slice(0, 40))).toBeNull();
  });
});
