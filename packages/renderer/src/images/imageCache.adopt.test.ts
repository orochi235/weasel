import { afterEach, describe, expect, it, vi } from 'vitest';
import { releaseImageSource } from '../cache/GLImageCache';
import {
  __setImageLoaderForTests, _resetImageCacheForTests, adoptBitmapSrc, bitmapSrc, getImageBitmap, imageStatus, isBitmapSrc,
} from './imageCache';

vi.mock('../cache/GLImageCache', async (original) => ({
  ...(await original<typeof import('../cache/GLImageCache')>()),
  releaseImageSource: vi.fn(),
}));

const bitmap = (w = 2) => ({ width: w, height: w, close() {} }) as unknown as ImageBitmap;
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('a bitmap name another realm minted', () => {
  afterEach(() => _resetImageCacheForTests());

  it('is held once adopted, and a name minted here cannot be', () => {
    const mine = bitmapSrc(bitmap());
    expect(isBitmapSrc(mine)).toBe(true);
    expect(() => adoptBitmapSrc(mine, bitmap())).toThrow();
    const foreign = 'weasel-bitmap:elsewhere.1';
    const b = bitmap();
    adoptBitmapSrc(foreign, b);
    expect(getImageBitmap(foreign)).toBe(b);
    expect(imageStatus(foreign)).toBe('ready');
  });

  it('goes to the loader when it is not held, where a name minted here never does', async () => {
    const asked: string[] = [];
    const b = bitmap();
    __setImageLoaderForTests(async (src) => { asked.push(src); return b; });
    const mine = bitmapSrc(bitmap());
    getImageBitmap(mine);
    const foreign = 'weasel-bitmap:elsewhere.2';
    expect(getImageBitmap(foreign)).toBeUndefined();
    await flush();
    expect(asked).toEqual([foreign]);
    expect(getImageBitmap(foreign)).toBe(b);
  });

  it('frees the bitmap a name held when it is adopted again', () => {
    const foreign = 'weasel-bitmap:elsewhere.3';
    const first = bitmap();
    adoptBitmapSrc(foreign, first);
    adoptBitmapSrc(foreign, first);
    expect(releaseImageSource).not.toHaveBeenCalled();
    adoptBitmapSrc(foreign, bitmap());
    expect(releaseImageSource).toHaveBeenCalledWith(first);
  });
});
