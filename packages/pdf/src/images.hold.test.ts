import { adoptBitmapSrc, getImageBitmap, releaseImage, type DrawCommand } from '@weasel-js/renderer';
import { describe, expect, it } from 'vitest';
import { NO_FONTS } from './testing/noFonts';
import { type PdfPage, writePdf } from './writePdf';

/** A bitmap that counts its `close()` calls. */
function counted(): ImageBitmap & { closes: number } {
  const b = { width: 1, height: 1, closes: 0, close() { b.closes++; } };
  return b as unknown as ImageBitmap & { closes: number };
}

const page = (image: ImageBitmap): PdfPage => ({
  width: 10, height: 10,
  commands: [{ kind: 'image', image, x: 0, y: 0, w: 10, h: 10 } satisfies DrawCommand],
});

describe('writePdf and the image cache', () => {
  it('keeps a bitmap its pages hold open while it writes, though the cache drops it meanwhile', async () => {
    const first = 'weasel-bitmap:pdf-test.1', second = 'weasel-bitmap:pdf-test.2';
    adoptBitmapSrc(first, counted());
    adoptBitmapSrc(second, counted());
    const a = getImageBitmap(first)!, b = getImageBitmap(second)! as ImageBitmap & { closes: number };
    const closedWhenRead: number[] = [];
    await writePdf([page(a), page(b)], {
      fonts: NO_FONTS,
      compress: false,
      readPixels: (img) => {
        // Reading the first page's image drops the second's from the cache.
        if (img === a) releaseImage(second);
        else closedWhenRead.push((img as ImageBitmap & { closes: number }).closes);
        return { width: 1, height: 1, data: new Uint8ClampedArray(4).fill(255) };
      },
    });
    expect(closedWhenRead).toEqual([0]);
    expect(b.closes).toBe(1);
    releaseImage(first);
  });
});
