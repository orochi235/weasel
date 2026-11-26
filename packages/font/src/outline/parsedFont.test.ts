/**
 * A face registered from a font the caller already parsed with opentype.js, against the same bytes parsed by the
 * default parser. Inter's kerning lives in GPOS extension lookups, which opentype.js's own `getKerningValue` reads
 * as 0 for every pair below, so a face that fell back to it would fail here.
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as opentype from 'opentype.js';
import { loadFontOutlines, outlineFace, registerFontOutlines, _resetFontOutlinesForTests } from './outlineRegistry';
import { createOpenTypeParser, openTypeModuleOf, openTypeParser } from './opentypeParser';
import { synthesizeCollection } from './fontFiles.fixture';
import type { OutlineFace } from './OutlineFace';

const INTER_TTF = resolve(import.meta.dirname, '../../../../assets/fonts/inter/inter.ttf');
const NOTO_LATIN = resolve(import.meta.dirname, '../../../text-shaping/src/__fixtures__/noto-sans-latin-subset.ttf');

function bytesOf(path: string): ArrayBuffer {
  const buf = readFileSync(path);
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

const parse = (bytes: ArrayBuffer) => openTypeModuleOf(opentype).parse(bytes);
const cp = (ch: string): number => ch.codePointAt(0)!;
/** A pair's kerning in Inter's font units. */
const units = (face: OutlineFace, pair: string): number => Math.round(face.kernOf!(cp(pair[0]!), cp(pair[1]!)) * 2048);

describe('a font registered already parsed', () => {
  let fromBytes: OutlineFace;
  let fromParsed: OutlineFace;

  beforeAll(async () => {
    const bytes = bytesOf(INTER_TTF);
    fromBytes = await openTypeParser(bytes);
    registerFontOutlines('Parsed Inter', {}, bytes, { parsed: parse(bytes) });
    expect(await loadFontOutlines('Parsed Inter')).toBe('ready');
    fromParsed = outlineFace('Parsed Inter', 400, 'normal')!;
  });
  afterAll(() => _resetFontOutlinesForTests());

  it('kerns from GPOS, pair for pair', () => {
    const expected = { AV: -140, To: -160, AT: -174, LT: -197, Yo: -157, ov: -40, rn: 32, Hx: 0 };
    for (const [pair, value] of Object.entries(expected)) {
      expect(units(fromParsed, pair), pair).toBe(value);
      expect(units(fromBytes, pair), pair).toBe(value);
    }
  });

  it('has the metrics the default parser reads from the same bytes', () => {
    expect(fromParsed.unitsPerEm).toBe(fromBytes.unitsPerEm);
    expect(fromParsed.ascender).toBe(fromBytes.ascender);
    expect(fromParsed.faceMetrics).toEqual(fromBytes.faceMetrics);
    for (let c = 0x20; c <= 0xff; c++) {
      expect(fromParsed.advanceOf!(c)).toBe(fromBytes.advanceOf!(c));
      expect(fromParsed.glyphD(c)).toBe(fromBytes.glyphD(c));
    }
  });

  it('embeds the same font', () => {
    const [a, b] = [fromParsed.embedding!(), fromBytes.embedding!()];
    expect({ ...a, glyphIndexOf: null, advanceOfGlyph: null }).toEqual({ ...b, glyphIndexOf: null, advanceOfGlyph: null });
  });
});

describe('a parsed font handed bytes that are not its own', () => {
  afterEach(() => _resetFontOutlinesForTests());

  it('is refused when the bytes are another font', async () => {
    const parser = createOpenTypeParser(undefined, parse(bytesOf(NOTO_LATIN)));
    await expect(parser(bytesOf(INTER_TTF))).rejects.toThrow(/was not parsed from these bytes \(2048 units per em/);
  });

  it('is refused when the bytes are the collection holding it', async () => {
    const single = bytesOf(INTER_TTF);
    const parser = createOpenTypeParser(undefined, parse(single));
    await expect(parser(synthesizeCollection(single))).rejects.toThrow(/not of the collection holding it/);
  });

  it('takes no parser beside it', () => {
    const bytes = bytesOf(INTER_TTF);
    expect(() => registerFontOutlines('Both', {}, bytes, { parsed: parse(bytes), parser: openTypeParser }))
      .toThrow(/a parser or a parsed font, not both/);
  });
});
