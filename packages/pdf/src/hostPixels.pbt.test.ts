/**
 * Property test of the pixels a host hands back, through `readPixels` for an image and `rasterize` for
 * a group only the renderer can draw: whatever size and data they hold, the file is well formed, a
 * bitmap whose data fits its size is drawn, and one that does not is left out and reported.
 */
import fc from 'fast-check';
import type { DrawCommand } from '@weasel-js/renderer';
import { describe, expect, it } from 'vitest';
import { checkPdf } from './pdfCheck.fixture';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { NO_FONTS } from './testing/noFonts';
import type { RasterPixels } from './writePdf';
import { writePdf } from './writePdf';

const RUNS = 200;

const side = fc.oneof(
  { weight: 4, arbitrary: fc.integer({ min: 1, max: 5 }) },
  { weight: 1, arbitrary: fc.constantFrom(0, -1, 1.5, NaN, Infinity, 2 ** 31) },
);

/** Pixels of the size given, their data the right length, or now and then not. */
const pixels: fc.Arbitrary<RasterPixels> = fc
  .record({ width: side, height: side, off: fc.oneof({ weight: 4, arbitrary: fc.constant(0) }, { weight: 1, arbitrary: fc.integer({ min: -8, max: 8 }) }) })
  .map(({ width, height, off }) => {
    const want = Number.isSafeInteger(width * height) && width * height > 0 && width * height < 1e4 ? width * height * 4 : 16;
    return { width, height, data: new Uint8ClampedArray(Math.max(0, want + off)).fill(255) };
  });

/** Whether `px` is a bitmap: a whole number of pixels each way, at least one, and four bytes for each. */
const fits = (px: RasterPixels) =>
  Number.isSafeInteger(px.width) && Number.isSafeInteger(px.height) && px.width > 0 && px.height > 0 && px.data.length === px.width * px.height * 4;

const image = (n: number): DrawCommand => ({
  kind: 'image', image: { width: 2, height: 2, n } as unknown as ImageBitmap, x: 10, y: 10, w: 20, h: 20,
} as DrawCommand);

const blurred: DrawCommand = {
  kind: 'group',
  effects: [{ kind: 'blur', radius: 2 }],
  children: [{ kind: 'path', path: { kind: 'rect', x: 5, y: 5, width: 20, height: 20 }, fill: { paint: { color: '#00f' } } }],
} as DrawCommand;

describe('pixels from the host', () => {
  it('draws a bitmap whose data fits its size, and leaves out and reports one that does not', async () => {
    const seen = tally();
    await fc.assert(
      fc.asyncProperty(pixels, pixels, async (read, raster) => {
        const { bytes, skipped } = await writePdf([{ width: 100, height: 100, commands: [image(1), blurred] }], {
          fonts: NO_FONTS,
          compress: false,
          readPixels: () => read,
          rasterize: async () => raster,
        });
        const { images } = checkPdf(bytes).seen;
        const expected = (fits(read) ? 1 : 0) + (fits(raster) ? 1 : 0);
        // An image with translucent pixels carries a mask image too; these are opaque.
        expect(images).toBe(expected);
        expect(skipped.length, JSON.stringify(skipped)).toBe(2 - expected);
        for (const k of skipped) expect(k.detail).toMatch(/wrong number of pixels/);
        seen.count(fits(read) ? 'image drawn' : 'image left out');
        seen.count(fits(raster) ? 'raster drawn' : 'raster left out');
      }),
      runs(RUNS),
    );
    for (const what of ['image drawn', 'image left out', 'raster drawn', 'raster left out']) seen.atLeast(what, 10);
  }, timeoutFor(RUNS, 30));
});
