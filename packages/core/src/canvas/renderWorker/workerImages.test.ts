import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  bitmapSrc, getImageBitmap, releaseImage, setImageLoader, type ImageRasterSize,
} from '@weasel-js/renderer';
import { __setImageLoaderForTests, _resetImageCacheForTests } from '@weasel-js/renderer/test-seams';
import { answerImage, loadFromPage } from './workerImages';
import type { FromWorker } from './protocol';

describe('answerImage', () => {
  it('answers at once for a bitmap name the page minted and has let go of', () => {
    const src = bitmapSrc({ width: 4, height: 4, close() {} } as ImageBitmap);
    releaseImage(src);
    const reply = vi.fn();
    answerImage({ type: 'image', id: 1, src }, reply);
    expect(reply).toHaveBeenCalledWith({ type: 'image', id: 1, src, error: expect.any(String) });
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
    answerImage({ type: 'image', id: 1, src, size: { width: 12000, height: 1200 } }, reply);
    await settle();
    expect(reply).toHaveBeenCalledWith({ type: 'image', id: 1, src, bitmap: expect.objectContaining({ width: 4096 }) });
  });

  it('answers with the raster the page holds when the page fails to raster one larger', async () => {
    __setImageLoaderForTests(async (_src, size) => {
      if (size) throw new Error('too big');
      return { width: 200, height: 200, close() {} } as ImageBitmap;
    });
    vi.stubGlobal('createImageBitmap', async (b: ImageBitmap) => b);
    const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
    const src = 'square.svg';
    getImageBitmap(src);
    await settle();
    const reply = vi.fn();
    answerImage({ type: 'image', id: 1, src, size: { width: 800, height: 800 } }, reply);
    await settle();
    expect(reply).toHaveBeenCalledWith({ type: 'image', id: 1, src, bitmap: expect.objectContaining({ width: 200 }) });
  });
});

describe('loadFromPage', () => {
  it('hands each answer to the request it answers, whatever order the page answers in', async () => {
    const asked: Extract<FromWorker, { type: 'image' }>[] = [];
    const answer = loadFromPage((request) => asked.push(request));
    const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };
    const raster = (side: number) => ({ width: side, height: side, close() {} }) as ImageBitmap;
    const src = 'shape.svg';
    getImageBitmap(src);
    answer({ type: 'image', id: asked[0]!.id, src, bitmap: raster(10) });
    await settle();
    // A sharper raster goes out, and the picture is dropped and asked for again before it lands.
    getImageBitmap(src, { width: 40, height: 40 });
    releaseImage(src);
    getImageBitmap(src);
    const [, sharp, again] = asked;
    // The page holds the natural raster already and answers the later request first.
    answer({ type: 'image', id: again!.id, src, bitmap: raster(10) });
    answer({ type: 'image', id: sharp!.id, src, bitmap: raster(40) });
    await settle();
    // Natural size: what a vector raster's later scales are measured against.
    expect(getImageBitmap(src)?.width).toBe(10);
    setImageLoader(null);
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  _resetImageCacheForTests();
});
