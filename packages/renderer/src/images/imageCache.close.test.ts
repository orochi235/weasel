import { beforeEach, describe, expect, it } from 'vitest';
import {
  __setImageLoaderForTests, _resetImageCacheForTests, adoptBitmapSrc, bitmapSrc, getImageBitmap, holdImageBitmaps,
  imageStatus, releaseImage, setImageCacheBudget,
} from './imageCache';

/** A bitmap that counts its `close()` calls and reads 0×0 once closed, as a real one does. */
function counted(side = 2): ImageBitmap & { closes: number } {
  const b = {
    width: side, height: side, closes: 0,
    close() { b.closes++; b.width = 0; b.height = 0; },
  };
  return b as unknown as ImageBitmap & { closes: number };
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function deferred<T>() {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

async function load(src: string, bitmap: ImageBitmap): Promise<void> {
  __setImageLoaderForTests(async () => bitmap);
  getImageBitmap(src);
  await flush();
}

// A 2x2 bitmap decodes to 16 bytes of RGBA.
const BUDGET_FOR_ONE = 20;

describe('the image cache closes the bitmaps it drops', () => {
  beforeEach(() => _resetImageCacheForTests());

  it('closes one dropped to fit its budget, and only that one', async () => {
    setImageCacheBudget(BUDGET_FOR_ONE);
    const a = counted(), b = counted();
    await load('a', a);
    await load('b', b);
    expect(imageStatus('a')).toBe('idle');
    expect(a.closes).toBe(1);
    expect(b.closes).toBe(0);
  });

  it('closes one released, and one that lands after its load was released', async () => {
    const a = counted();
    await load('a', a);
    releaseImage('a');
    expect(a.closes).toBe(1);

    const d = deferred<ImageBitmap>();
    __setImageLoaderForTests(() => d.promise);
    getImageBitmap('late');
    releaseImage('late');
    const late = counted();
    d.resolve(late);
    await flush();
    expect(late.closes).toBe(1);
    expect(imageStatus('late')).toBe('idle');
  });

  it('closes a vector raster a sharper one replaces, and one landing for a src released meanwhile', async () => {
    const SVG = 'data:image/svg+xml,%3Csvg%3E';
    const asked: ReturnType<typeof deferred<ImageBitmap>>[] = [];
    __setImageLoaderForTests(() => {
      const d = deferred<ImageBitmap>();
      asked.push(d);
      return d.promise;
    });
    getImageBitmap(SVG);
    const natural = counted(100);
    asked[0]!.resolve(natural);
    await flush();
    getImageBitmap(SVG, { width: 400, height: 400 });
    const sharp = counted(400);
    asked[1]!.resolve(sharp);
    await flush();
    expect(getImageBitmap(SVG)).toBe(sharp);
    expect(natural.closes).toBe(1);

    getImageBitmap(SVG, { width: 1600, height: 1600 });
    releaseImage(SVG);
    expect(sharp.closes).toBe(1);
    const stale = counted(1600);
    asked[2]!.resolve(stale);
    await flush();
    expect(stale.closes).toBe(1);
  });

  it('closes an adopted bitmap another adoption replaces', () => {
    const first = counted(), second = counted();
    adoptBitmapSrc('weasel-bitmap:elsewhere.1', first);
    adoptBitmapSrc('weasel-bitmap:elsewhere.1', second);
    expect(first.closes).toBe(1);
    expect(second.closes).toBe(0);
  });

  it('never closes a bitmap it named but does not own', () => {
    const mine = counted();
    releaseImage(bitmapSrc(mine));
    expect(mine.closes).toBe(0);
  });

  it('keeps what it drops open while a hold is open, and closes it when the last one goes', async () => {
    setImageCacheBudget(BUDGET_FOR_ONE);
    const a = counted(), b = counted();
    const outer = holdImageBitmaps();
    const inner = holdImageBitmaps();
    await load('a', a);
    await load('b', b);
    expect(imageStatus('a')).toBe('idle');
    expect(a.closes).toBe(0);
    inner();
    inner();
    expect(a.closes).toBe(0);
    outer();
    expect(a.closes).toBe(1);
    expect(b.closes).toBe(0);
  });
});
