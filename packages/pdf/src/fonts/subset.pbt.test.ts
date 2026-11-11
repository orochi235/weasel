/**
 * Property tests of the TrueType reader under the subsetter, fed faces with cut, overwritten, and
 * zeroed tables: `checkTrueType` passes Inter and refuses with its own error what it cannot read; any
 * face it passes subsets, for any glyphs, into a program it passes again; and text in any such face
 * the font registry loads writes a well-formed file, embedded or drawn as outlines.
 */
import { loadFontOutlines, registerFontOutlines, unregisterFontOutlines } from '@weasel-js/font';
import type { TextDrawCommand } from '@weasel-js/renderer';
import { _resetLayoutCacheForTests } from '@weasel-js/text/test-seams';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { checkPdf } from '../pdfCheck.fixture';
import { writePdf } from '../writePdf';
import { registryFontSource } from './fontSource';
import { checkTrueType, glyphCount, subsetTrueType } from './subset';

const RUNS = 150;
const buf = readFileSync(resolve(import.meta.dirname, '../../../../assets/fonts/inter/inter.ttf'));
const INTER = new Uint8Array(buf).slice().buffer;

/** Table tag to its offset and length, from Inter's directory. */
const TABLES = (() => {
  const v = new DataView(INTER);
  const out = new Map<string, [number, number]>();
  for (let i = 0; i < v.getUint16(4); i++) {
    out.set(String.fromCharCode(...new Uint8Array(INTER, 12 + i * 16, 4)), [v.getUint32(12 + i * 16 + 8), v.getUint32(12 + i * 16 + 12)]);
  }
  return out;
})();

type Damage =
  | { kind: 'poke'; table: string; at: number; bytes: number[] }
  | { kind: 'field'; table: 'hhea' | 'maxp' | 'head'; at: number; value: number }
  | { kind: 'cut'; keep: number }
  | { kind: 'directory'; at: number; value: number };

const damage: fc.Arbitrary<Damage> = fc.oneof(
  fc.record({
    kind: fc.constant('poke' as const),
    table: fc.constantFrom('loca', 'hmtx', 'glyf', 'hhea', 'maxp', 'head'),
    // Mostly near a table's start, where the glyphs text draws and the fields that size the rest are.
    at: fc.oneof(fc.nat(800), fc.nat()),
    bytes: fc.array(fc.oneof(fc.constantFrom(0, 0xff, 0x80), fc.integer({ min: 0, max: 255 })), { minLength: 1, maxLength: 8 }),
  }),
  fc.record({ kind: fc.constant('cut' as const), keep: fc.integer({ min: 0, max: INTER.byteLength - 1 }) }),
  fc.record({ kind: fc.constant('directory' as const), at: fc.integer({ min: 0, max: 12 + 16 * TABLES.size - 1 }), value: fc.integer({ min: 0, max: 255 }) }),
);

/** numberOfHMetrics, numGlyphs, or indexToLocFormat set to any value. */
const field = fc.record({
  where: fc.constantFrom({ table: 'hhea' as const, at: 34 }, { table: 'maxp' as const, at: 4 }, { table: 'head' as const, at: 50 }),
  value: fc.oneof(fc.constantFrom(0, 1, 2, 0xffff), fc.integer({ min: 0, max: 0xffff })),
}).map(({ where, value }): Damage => ({ kind: 'field', ...where, value }));

const damages = fc.array(fc.oneof(damage, field), { minLength: 1, maxLength: 3 });

function damaged(list: readonly Damage[]): ArrayBuffer {
  let b = new Uint8Array(INTER.slice(0));
  for (const d of list) {
    if (d.kind === 'cut') b = b.slice(0, d.keep);
    else if (d.kind === 'directory') { if (d.at < b.length) b[d.at] = d.value; }
    else {
      const [off, len] = TABLES.get(d.table)!;
      if (d.kind === 'field') {
        if (off + d.at + 1 < b.length) new DataView(b.buffer).setUint16(off + d.at, d.value);
      } else d.bytes.forEach((v, i) => { const at = off + ((d.at + i) % len); if (at < b.length) b[at] = v; });
    }
  }
  return b.buffer;
}

/** What `checkTrueType` answers: nothing, or its own error's message. */
function check(sfnt: ArrayBuffer): string | null {
  try {
    checkTrueType(sfnt);
    return null;
  } catch (err) {
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toMatch(/^pdf: /);
    return (err as Error).message;
  }
}

describe('checkTrueType', () => {
  it('passes Inter', () => {
    expect(check(INTER)).toBeNull();
  });

  it('refuses with its own error what it cannot read, and subsets what it passes into a program it passes', () => {
    const seen = tally();
    const used = fc.array(fc.oneof(fc.nat(3000), fc.nat(70_000)), { maxLength: 30 });
    fc.assert(
      fc.property(damages, used, (list, gids) => {
        const sfnt = damaged(list);
        if (check(sfnt) !== null) return seen.count('refused');
        const out = subsetTrueType(sfnt, gids);
        expect(check(out.slice().buffer)).toBeNull();
        expect(glyphCount(out.slice().buffer)).toBeLessThanOrEqual(glyphCount(sfnt));
        seen.count('passed');
      }),
      runs(RUNS * 2),
    );
    seen.atLeast('refused', 20);
    seen.atLeast('passed', 20);
  }, timeoutFor(RUNS * 2, 20));
});

afterAll(() => _resetLayoutCacheForTests());

describe('a damaged face in a document', () => {
  it('writes a well-formed file, whatever a face the registry loads holds', async () => {
    const seen = tally();
    const text = fc.string({ unit: fc.constantFrom(...'aeiofghAÆß€1ﬁ'), minLength: 1, maxLength: 8 });
    let n = 0;
    await fc.assert(
      fc.asyncProperty(damages, text, fc.boolean(), async (list, s, subset) => {
        const family = `pdf-pbt-damaged-${n++}`;
        registerFontOutlines(family, {}, damaged(list));
        try {
          try {
            await loadFontOutlines(family, {});
          } catch {
            return seen.count('not loaded');
          }
          const cmd: TextDrawCommand = {
            kind: 'text', x: 5, y: 20,
            runs: [{
              text: s, fontFamily: family, fontSize: 12, fontWeight: 400, fontStyle: 'normal', fill: { paint: { color: '#000' } },
              letterSpacing: 0, underline: false, strikethrough: false, overline: false, baselineShift: 0,
            }],
          };
          const { bytes } = await writePdf([{ width: 200, height: 50, commands: [cmd] }], { fonts: registryFontSource, compress: false, subsetFonts: subset });
          const { pdf } = checkPdf(bytes);
          const embedded = [...pdf.objects.values()].some((o) => o.value !== null && typeof o.value === 'object' && 'FontFile2' in (o.value as object));
          seen.count(embedded ? 'embedded' : 'outlines');
        } finally {
          unregisterFontOutlines(family, {});
        }
      }),
      runs(RUNS),
    );
    seen.atLeast('embedded', 20);
    seen.atLeast('outlines', 3);
  }, timeoutFor(RUNS, 100));
});
