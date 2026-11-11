/**
 * Property test of an embedded face through any run of `use` and `useGlyph` calls: each answer is a
 * stable code that reads back, through the written `/ToUnicode`, as the text it was asked for, moves
 * the pen by the width asked for in `/W`, and draws, through `/CIDToGIDMap`, the glyph asked for,
 * whose outline the subset keeps byte for byte.
 */
import { registerFontOutlines, unregisterFontOutlines } from '@weasel-js/font';
import fc from 'fast-check';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { name, PdfObjects } from '../objects';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { type Dict, isDict, type Name, type ParsedPdf, readPdf, Ref, type Value } from '../pdfReader.fixture';
import { DocumentFonts } from './embedFont';
import { registryFontSource } from './fontSource';
import { glyphCount } from './subset';

const RUNS = 60;
const FAMILY = 'pdf-pbt-inter';

function interBytes(): ArrayBuffer {
  const buf = readFileSync(resolve(import.meta.dirname, '../../../../assets/fonts/inter/inter.ttf'));
  const out = new ArrayBuffer(buf.byteLength);
  new Uint8Array(out).set(buf);
  return out;
}

const INTER = interBytes();
const GLYPHS = glyphCount(INTER);

/** Each glyph's bytes in an sfnt's `glyf`, read straight from its tables. */
function glyphsOf(bytes: Uint8Array): Uint8Array[] {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const dir = new Map<string, number>();
  for (let i = 0; i < v.getUint16(4); i++) dir.set(String.fromCharCode(...bytes.subarray(12 + i * 16, 16 + i * 16)), v.getUint32(12 + i * 16 + 8));
  const [head, maxp, loca, glyf] = ['head', 'maxp', 'loca', 'glyf'].map((t) => dir.get(t)!);
  const long = v.getInt16(head! + 50) === 1;
  const at = (i: number) => (long ? v.getUint32(loca! + i * 4) : v.getUint16(loca! + i * 2) * 2);
  return Array.from({ length: v.getUint16(maxp! + 4) }, (_, i) => bytes.slice(glyf! + at(i), glyf! + at(i + 1)));
}

/** The sum of an sfnt's 32-bit words, which `head.checkSumAdjustment` brings to 0xB1B0AFBA. */
function fileChecksum(bytes: Uint8Array): number {
  const padded = new Uint8Array((bytes.length + 3) & ~3);
  padded.set(bytes);
  const v = new DataView(padded.buffer);
  let sum = 0;
  for (let i = 0; i < padded.length; i += 4) sum = (sum + v.getUint32(i)) >>> 0;
  return sum;
}

/** A ToUnicode CMap's `bfchar` entries, refusing a block over 100 or a count that does not match. */
function readCMap(cmap: string): Map<number, string> {
  const out = new Map<number, string>();
  for (const m of cmap.matchAll(/(\d+) beginbfchar\n([\s\S]*?)\nendbfchar/g)) {
    const lines = m[2]!.split('\n');
    expect(lines.length).toBe(Number(m[1]));
    expect(lines.length).toBeLessThanOrEqual(100);
    for (const line of lines) {
      const e = /^<([0-9A-F]{4})> <((?:[0-9A-F]{4})+)>$/.exec(line);
      if (!e) throw new Error(`bad bfchar line ${line}`);
      const code = parseInt(e[1]!, 16);
      expect(out.has(code)).toBe(false);
      out.set(code, String.fromCharCode(...e[2]!.match(/..../g)!.map((h) => parseInt(h, 16))));
    }
  }
  return out;
}

type Call = { kind: 'cp'; cp: number } | { kind: 'glyph'; gid: number; text: string; width?: number };

const text = fc.oneof(
  fc.constant(''),
  fc.string({ unit: 'grapheme', minLength: 1, maxLength: 3 }),
  fc.constantFrom('fi', 'á', ' ', '\u{1F600}', 'م'),
);
const call: fc.Arbitrary<Call> = fc.oneof(
  fc.record({ kind: fc.constant('cp' as const), cp: fc.oneof(fc.integer({ min: 0x20, max: 0x24f }), fc.constantFrom(0x1f600, 0x4e00, 0xfffd)) }),
  fc.record(
    {
      kind: fc.constant('glyph' as const),
      gid: fc.oneof(fc.integer({ min: 0, max: GLYPHS - 1 }), fc.integer({ min: 0, max: 6 })),
      text,
      width: fc.oneof(fc.integer({ min: -600, max: 1200 }), fc.constantFrom(0, 0.5, -1)),
    },
    { requiredKeys: ['kind', 'gid', 'text'] },
  ),
);

function get(pdf: ParsedPdf, v: Value | undefined): Value | undefined {
  return v instanceof Ref ? pdf.objects.get(v.id)?.value : v;
}

describe('DocumentFonts', () => {
  beforeAll(() => registerFontOutlines(FAMILY, {}, interBytes()));
  afterAll(() => unregisterFontOutlines(FAMILY, {}));

  it('writes a face whose every code reads back as its text, moves by its width, and draws its glyph', async () => {
    const original = glyphsOf(new Uint8Array(INTER));
    const seen = tally();
    await fc.assert(
      fc.asyncProperty(fc.array(call, { minLength: 1, maxLength: 25 }), fc.boolean(), async (calls, subset) => {
        const objects = new PdfObjects();
        const fonts = new DocumentFonts(objects, registryFontSource, subset);
        const font = (await fonts.face(FAMILY, 400, 'normal'))!;
        const emb = (await registryFontSource.embedding(FAMILY, 400, 'normal'))!;
        const want = new Map<number, { gid: number; text: string; width: number }>();
        const byKey = new Map<string, number>();
        for (const c of calls) {
          const gid = c.kind === 'cp' ? emb.glyphIndexOf(c.cp) : c.gid;
          const reads = c.kind === 'cp' ? String.fromCodePoint(c.cp) : c.text;
          const code = c.kind === 'cp' ? font.use(c.cp) : font.useGlyph(c.gid, c.text, c.width);
          if (gid === null || gid === 0) {
            expect(code).toBeNull();
            continue;
          }
          expect(code).not.toBeNull();
          const width = c.kind === 'glyph' && c.width !== undefined ? c.width : font.glyphWidth(gid);
          const key = `${gid}|${width}|${reads}`;
          if (byKey.has(key)) expect(code).toBe(byKey.get(key));
          byKey.set(key, code!);
          if (want.has(code!)) expect(want.get(code!)).toEqual({ gid, text: reads, width });
          want.set(code!, { gid, text: reads, width });
          expect(font.readsAs(code!)).toBe(reads);
          expect(font.widthOf(code!)).toBe(width);
          seen.count(code === gid ? 'own code' : 'spare code');
        }
        if (want.size === 0) return;
        await fonts.finish();
        const root = objects.alloc();
        objects.set(root, { Type: name('Catalog') });
        await objects.settle(false, async (d) => d);
        const pdf = readPdf(objects.serialize(root));

        const type0 = [...pdf.objects.values()].map((o) => o.value).find((v) => isDict(v) && (v.Subtype as Name)?.value === 'Type0') as Dict;
        const cid = get(pdf, (type0.DescendantFonts as Value[])[0]) as Dict;
        const toUnicode = readCMap(String.fromCharCode(...pdf.objects.get((type0.ToUnicode as Ref).id)!.stream!.data));
        const widths = new Map<number, number>();
        const w = cid.W as Value[];
        for (let i = 0; i < w.length; i += 2) widths.set(w[i] as number, (w[i + 1] as number[])[0]!);
        const map = get(pdf, cid.CIDToGIDMap);
        const mapData = cid.CIDToGIDMap instanceof Ref ? pdf.objects.get(cid.CIDToGIDMap.id)!.stream!.data : null;
        const gidOf = (code: number) => (mapData ? (mapData[code * 2]! << 8) | mapData[code * 2 + 1]! : code);
        if (!mapData) expect((map as Name).value).toBe('Identity');
        const fileRef = (get(pdf, cid.FontDescriptor) as Dict).FontFile2 as Ref;
        const sfnt = pdf.objects.get(fileRef.id)!.stream!.data;
        const kept = glyphsOf(sfnt);
        expect(fileChecksum(sfnt)).toBe(0xb1b0afba);

        for (const [code, { gid, text: reads, width }] of want) {
          expect(toUnicode.get(code)).toBe(reads || '⁠');
          expect(Math.abs(widths.get(code)! - width)).toBeLessThanOrEqual(5e-5);
          expect(gidOf(code)).toBe(gid);
          // The subset pads each glyph to four bytes.
          const glyph = kept[gid]!;
          expect([...glyph.subarray(0, original[gid]!.length)]).toEqual([...original[gid]!]);
          expect(glyph.length - original[gid]!.length).toBeLessThan(4);
          expect(glyph.subarray(original[gid]!.length).every((b) => b === 0)).toBe(true);
        }
        expect(toUnicode.size).toBe(want.size);
        expect(widths.size).toBe(want.size);
        if (subset) {
          const drawn = new Set([...want.values()].map((v) => v.gid));
          expect(kept.length).toBeGreaterThanOrEqual(Math.max(...drawn) + 1);
          seen.count('subset');
        }
      }),
      runs(RUNS),
    );
    for (const what of ['own code', 'spare code', 'subset']) seen.atLeast(what, 10);
  }, timeoutFor(RUNS, 400));
});
