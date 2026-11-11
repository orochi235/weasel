/**
 * Property tests of the whole writer: any draw commands, finite or not, give a file whose xref points at
 * every object, whose references all resolve, and whose content streams hold only well-formed operators
 * with operands in range, balanced q/Q, and resources the stream names.
 */
import { deflateSync } from 'node:zlib';
import fc from 'fast-check';
import { afterAll, describe, expect, it } from 'vitest';
import { type DrawCommand, registerTexture, unregisterTexture } from '@weasel-js/renderer';
import { checkPdf } from './pdfCheck.fixture';
import { commands, coord, fakeImage, readFakePixels, runs, tally, texturePaint, timeoutFor, wildCoord } from './pbt.fixture';
import { NO_FONTS } from './testing/noFonts';
import { type PdfPage, writePdfWith, type WritePdfOptions } from './writePdf';

const RUNS = 120;
const texture = registerTexture(fc.sample(fakeImage, { numRuns: 1, seed: 7 })[0] as unknown as ImageBitmap);
afterAll(() => unregisterTexture(texture));
const fills = texturePaint(texture.id);
const zlib = async (d: Uint8Array) => new Uint8Array(deflateSync(d));

const page = (cmds: fc.Arbitrary<DrawCommand[]>) =>
  fc.record({
    width: fc.integer({ min: 1, max: 600 }),
    height: fc.integer({ min: 1, max: 600 }),
    commands: cmds,
  });

const options: fc.Arbitrary<Partial<WritePdfOptions>> = fc.record({
  compress: fc.boolean(),
  title: fc.option(fc.string({ unit: 'binary', maxLength: 12 }), { nil: undefined }),
  lang: fc.option(fc.constantFrom('en', 'de-CH', 'ar', '(x)'), { nil: undefined }),
});

async function write(pages: PdfPage[], opts: Partial<WritePdfOptions>) {
  return writePdfWith(pages, { fonts: NO_FONTS, readPixels: readFakePixels, ...opts }, zlib);
}

describe('writePdf', () => {
  it('writes a well-formed file for any finite drawing, and drops nothing as non-finite', async () => {
    const seen = tally();
    await fc.assert(
      fc.asyncProperty(fc.array(page(commands(coord, 2, fills)), { minLength: 1, maxLength: 2 }), options, async (pages, opts) => {
        const { bytes, skipped } = await write(pages, opts);
        const { seen: s } = checkPdf(bytes);
        expect(skipped.filter((k) => k.detail.includes('non-finite'))).toEqual([]);
        if (s.forms) seen.count('form');
        if (s.images) seen.count('image');
        if (s.shadings) seen.count('shading');
        if (s.patterns) seen.count('pattern');
        for (const op of ['S', 'f', 'f*', 'W', 'W*', 'd', 'sh', 'Do', 'cm']) if (s.ops.has(op)) seen.count(op);
      }),
      runs(RUNS),
    );
    for (const what of ['form', 'image', 'shading', 'pattern', 'S', 'f', 'f*', 'W', 'W*', 'd', 'sh', 'Do', 'cm']) seen.atLeast(what, 5);
  }, timeoutFor(RUNS, 400));

  it('writes a well-formed file when coordinates are not finite, dropping and reporting the commands that hold them', async () => {
    const seen = tally();
    await fc.assert(
      fc.asyncProperty(fc.array(page(commands(wildCoord, 2, texturePaint(texture.id, wildCoord))), { minLength: 1, maxLength: 2 }), options, async (pages, opts) => {
        const { bytes, skipped } = await write(pages, opts);
        checkPdf(bytes);
        if (skipped.some((k) => k.detail.includes('non-finite'))) seen.count('dropped');
        else seen.count('kept');
      }),
      runs(RUNS),
    );
    seen.atLeast('dropped', 5);
    seen.atLeast('kept', 5);
  }, timeoutFor(RUNS, 400));
});
