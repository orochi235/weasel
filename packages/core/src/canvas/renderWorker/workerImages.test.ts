import { afterEach, describe, expect, it, vi } from 'vitest';
import { bitmapSrc, getImageBitmap, releaseImage, type ImageRasterSize } from '@weasel-js/renderer';
import { __setImageLoaderForTests, _resetImageCacheForTests } from '@weasel-js/renderer/test-seams';
import { answerImage } from './workerImages';

describe('answerImage', () => {
  it('answers at once for a bitmap name the page minted and has let go of', () => {
    const src = bitmapSrc({ width: 4, height: 4, close() {} } as ImageBitmap);
    releaseImage(src);
    const reply = vi.fn();
    answerImage({ type: 'image', src }, reply);
    expect(reply).toHaveBeenCalledWith({ type: 'image', src, error: expect.any(String) });
  });

  it('answers with the raster the page holds when the page will not raster one larger', async () => {
    const fake = (size?: ImageRasterSize) => ({ width: size?.width ?? 2000, height: size?.height ?? 200, close() {} }) as ImageBitmap;
    __setImageLoaderForTests(async (_src, size) => fake(size));
    vi.stubGlobal('createImageBitmap', async (b: ImageBitmap) => b);
    const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
    const src = 'wide.svg';
    getImageBitmap(src);
    await settle();
    // Rastered as large as the page's texture side allows.
    getImageBitmap(src, { width: 8000, height: 800 });
    await settle();
    const reply = vi.fn();
    answerImage({ type: 'image', src, size: { width: 12000, height: 1200 } }, reply);
    await settle();
    expect(reply).toHaveBeenCalledWith({ type: 'image', src, bitmap: expect.objectContaining({ width: 4096 }) });
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  _resetImageCacheForTests();
});
