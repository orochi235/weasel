/**
 * Write, read, and write again: any value `PdfObjects` writes, read back and written once more, reads
 * as the same value, and so does a whole file `writePdf` wrote, rebuilt object by object from what a
 * reader finds at each xref offset; written a third time, either is the second's bytes. A difference
 * means an offset, a `/Length`, an escape, or a number that does not read back as itself.
 */
import { deflateSync } from 'node:zlib';
import fc from 'fast-check';
import { afterAll, describe, expect, it } from 'vitest';
import { registerTexture, unregisterTexture } from '@weasel-js/renderer';
import { latin1, latin1Bytes } from './latin1';
import { bytes, name, type PdfDict, PdfObjects, PdfReal, PdfRef, type PdfValue, text, writeDict } from './objects';
import { anyFinite, commands, coord, fakeImage, readFakePixels, runs, tally, texturePaint, timeoutFor } from './pbt.fixture';
import { isDict, Lexer, Name, Ref, readPdf, Str, type Value } from './pdfReader.fixture';
import { NO_FONTS } from './testing/noFonts';
import { writePdfWith } from './writePdf';

const RUNS = 200;

/** The fewest decimals that spell `n` exactly. The writer may spell a large number with a digit past the
 *  double's own (`toFixed` writes `…1362` for the `…136` it reads back as), so a second write can be shorter
 *  than the first; the third is the same as the second. */
function decimalsOf(n: number): number {
  if (Math.abs(n) >= 1e21) return 0;
  let d = 0;
  while (d < 100 && Number(n.toFixed(d)) !== n) d++;
  return d;
}

/** What a reader found, as the value that writes it: a number to the decimals it was read with, a hex
 *  string as its bytes, a literal as text. */
function toPdf(v: Value): PdfValue {
  if (typeof v === 'number') return new PdfReal(v, decimalsOf(v));
  if (v instanceof Name) return name(v.value);
  if (v instanceof Ref) return new PdfRef(v.id);
  if (v instanceof Str) return v.hex ? bytes(v.bytes) : text(latin1(v.bytes));
  if (Array.isArray(v)) return v.map(toPdf);
  if (isDict(v)) {
    const out: Record<string, PdfValue> = {};
    for (const k of Object.keys(v)) Object.defineProperty(out, k, { value: toPdf(v[k]!), enumerable: true, writable: true, configurable: true });
    return out;
  }
  return v;
}

/** Any string but NUL, which a name cannot hold, and lone surrogates, which UTF-8 cannot. */
const nameText = fc.string({ unit: 'grapheme', maxLength: 6 }).filter((s) => !s.includes('\0'));
const key = fc.oneof(nameText, fc.constantFrom('__proto__', 'constructor', 'toString', 'hasOwnProperty', '0', '10', '#', ''));

function value(): fc.Arbitrary<PdfValue> {
  const { v } = fc.letrec<{ v: PdfValue }>((tie) => ({
    v: fc.oneof(
      { depthSize: 'small', withCrossShrink: true },
      anyFinite,
      fc.boolean(),
      fc.constant(null),
      nameText.map(name),
      fc.integer({ min: 0, max: 1e6 }).map((id) => new PdfRef(id)),
      fc.string({ unit: 'binary', maxLength: 10 }).map(text),
      fc.string({ unit: fc.constantFrom('(', ')', '\\', '\r', '\n', 'a', ' ', '%'), maxLength: 10 }).map(text),
      fc.uint8Array({ maxLength: 8 }).map(bytes),
      fc.array(tie('v'), { maxLength: 4 }),
      fc.dictionary(key, tie('v'), { maxKeys: 4 }),
    ),
  }));
  return v;
}

describe('values, written twice', () => {
  it('reads back as itself, and writes the same bytes from the second write on', () => {
    fc.assert(
      fc.property(fc.dictionary(key, value(), { maxKeys: 6 }), (d) => {
        const once = writeDict(d);
        const read = new Lexer(latin1Bytes(once));
        const value = read.value();
        expect(read.done()).toBe(true);
        const again = writeDict(toPdf(value) as PdfDict);
        expect(new Lexer(latin1Bytes(again)).value()).toEqual(value);
        expect(writeDict(toPdf(new Lexer(latin1Bytes(again)).value()) as PdfDict)).toBe(again);
      }),
      runs(RUNS),
    );
  }, timeoutFor(RUNS, 5));
});

/** `bytes` rebuilt from what `readPdf` finds: every object at its id, each stream from its stored bytes. */
function rebuild(file: Uint8Array): Uint8Array {
  const pdf = readPdf(file);
  const o = new PdfObjects();
  for (let id = 1; id <= pdf.objects.size; id++) {
    const ref = o.alloc();
    const { value: v, stream } = pdf.objects.get(id)!;
    if (!stream) {
      o.set(ref, toPdf(v));
      continue;
    }
    const { Length: _length, ...dict } = toPdf(v) as Record<string, PdfValue>;
    o.stream(ref, dict, stream.raw);
  }
  const root = pdf.trailer.Root as Ref;
  const info = pdf.trailer.Info as Ref | undefined;
  return o.serialize(new PdfRef(root.id), info && new PdfRef(info.id));
}

const texture = registerTexture(fc.sample(fakeImage, { numRuns: 1, seed: 11 })[0] as unknown as ImageBitmap);
afterAll(() => unregisterTexture(texture));
const zlib = async (d: Uint8Array) => new Uint8Array(deflateSync(d));

describe('whole files, written twice', () => {
  it('rebuilds any file object by object from its xref into the same objects, and the same bytes from then on', async () => {
    const seen = tally();
    const page = fc.record({
      width: fc.integer({ min: 1, max: 600 }),
      height: fc.integer({ min: 1, max: 600 }),
      commands: commands(coord, 2, texturePaint(texture.id)),
    });
    await fc.assert(
      fc.asyncProperty(
        fc.array(page, { minLength: 1, maxLength: 3 }),
        fc.boolean(),
        fc.option(fc.string({ unit: 'binary', maxLength: 12 }), { nil: undefined }),
        async (pages, compress, title) => {
          const { bytes: file } = await writePdfWith(pages, { fonts: NO_FONTS, readPixels: readFakePixels, compress, title }, zlib);
          const once = rebuild(file);
          expect(readPdf(once).objects).toEqual(readPdf(file).objects);
          expect(latin1(rebuild(once))).toBe(latin1(once));
          const n = readPdf(file).objects.size;
          seen.count(n > 10 ? 'many objects' : 'few objects');
          if (compress) seen.count('compressed');
        },
      ),
      runs(RUNS / 2),
    );
    seen.atLeast('many objects', 5);
    seen.atLeast('compressed', 10);
  }, timeoutFor(RUNS / 2, 400));
});
