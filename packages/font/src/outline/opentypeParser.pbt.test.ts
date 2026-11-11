/**
 * The default outline parser fuzzed over the repo's Inter, damaged in its directory, its `cmap`, `hmtx`, `GPOS`,
 * and anywhere: it rejects, or it hands back a face whose metrics answer every code point without throwing.
 * `glyphD` is left out: the registry catches a glyph that throws, and costs only that glyph.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { interBytes, mutate, mutations, runs, tablesOf, tally, timeoutFor } from '../pbt.fixture';
import { createOpenTypeParser } from './opentypeParser';

const RUNS = 150;
const INTER = interBytes();
const TABLES = tablesOf(INTER);
const table = (tag: string): [number, number] => {
  const t = TABLES.find((r) => r.tag === tag)!;
  return [t.offset, t.offset + t.length];
};
const REGIONS: Record<string, [number, number]> = {
  directory: [0, 12 + TABLES.length * 16],
  cmap: table('cmap'), hmtx: table('hmtx'), hhea: table('hhea'), maxp: table('maxp'), gpos: table('GPOS'),
  anywhere: [0, INTER.byteLength],
};
const parse = createOpenTypeParser();
const cp = fc.oneof(fc.integer({ min: 0x20, max: 0x7e }), fc.integer({ min: 0, max: 0x10ffff }));
const finiteOrNull = (n: number | null): boolean => n === null || Number.isFinite(n);

describe('createOpenTypeParser, fuzzed', () => {
  it('rejects a damaged font, or reads one whose metrics answer every code point', async () => {
    const t = tally();
    await fc.assert(fc.asyncProperty(mutations(4), fc.constantFrom(...Object.keys(REGIONS)), fc.array(cp, { minLength: 1, maxLength: 8 }),
      async (edits, where, cps) => {
        const [from, to] = REGIONS[where]!;
        let face;
        try {
          face = await parse(mutate(INTER, edits, from, to));
        } catch (err) {
          expect(err).toBeInstanceOf(Error);
          t.count('rejected');
          return;
        }
        t.count('read');
        expect(face.unitsPerEm).toBeGreaterThan(0);
        expect(Number.isFinite(face.ascender)).toBe(true);
        for (const c of cps) {
          expect(finiteOrNull(face.advanceOf(c))).toBe(true);
          expect(Number.isFinite(face.kernOf(c, cps[0]!))).toBe(true);
          if (face.advanceOf(c) !== null) t.count('covered');
        }
        const embedding = face.embedding?.();
        if (embedding) {
          for (const c of cps) {
            const gid = embedding.glyphIndexOf(c);
            if (gid !== null) expect(Number.isFinite(embedding.advanceOfGlyph(gid))).toBe(true);
          }
        }
      }), runs(RUNS));
    t.atLeast('read', 40);
    t.atLeast('rejected', 5);
    t.atLeast('covered', 40);
  }, timeoutFor(RUNS, 40));
});

/** Inter with each table named in `tags` renamed out of reach. */
function without(...tags: string[]): ArrayBuffer {
  const bytes = INTER.slice(0);
  const view = new DataView(bytes);
  TABLES.forEach((t, i) => { if (tags.includes(t.tag)) view.setUint8(12 + i * 16, 0); });
  return bytes;
}

describe('createOpenTypeParser, shrunk', () => {
  it('rejects a font with no head table, which states no units per em', async () => {
    await expect(parse(without('head'))).rejects.toThrow(/units per em/);
  });

  it('embeds a font whose name table holds no names, with no PostScript name', async () => {
    // opentype.js 2's `getEnglishName` throws on this font; 1.x answers undefined.
    const bytes = INTER.slice(0);
    new DataView(bytes).setUint16(TABLES.find((t) => t.tag === 'name')!.offset + 2, 0);
    const face = await parse(bytes);
    expect(face.embedding?.().postScriptName).toBe('');
  });

  it('rejects a font with neither hhea nor OS/2, which states no ascent', async () => {
    await expect(parse(without('hhea', 'OS/2'))).rejects.toThrow(/no ascent/);
  });
});
