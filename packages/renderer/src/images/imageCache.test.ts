import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getImageBitmap,
  imageStatus,
  subscribeImageReady,
  isVectorImageSrc,
  releaseImage,
  retryImage,
  __setImageLoaderForTests,
  setImageCacheBudget,
  _resetImageCacheForTests,
  bitmapSrc,
} from './imageCache';
import { GLImageCache } from '../cache/GLImageCache';
import { makeGLRecorder } from '../testing/glRecorder';

const fakeBitmap = (): ImageBitmap =>
  ({ width: 2, height: 2, close() {} } as unknown as ImageBitmap);

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0));

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('imageCache', () => {
  beforeEach(() => _resetImageCacheForTests());

  it('returns undefined while loading, then the bitmap after resolve + notifies', async () => {
    const d = deferred<ImageBitmap>();
    let calls = 0;
    __setImageLoaderForTests(() => { calls++; return d.promise; });
    let notified = 0;
    subscribeImageReady(() => { notified++; });

    expect(getImageBitmap('a')).toBeUndefined();
    expect(imageStatus('a')).toBe('loading');
    expect(calls).toBe(1);

    const bmp = fakeBitmap();
    d.resolve(bmp);
    await flush();

    expect(notified).toBe(1);
    expect(imageStatus('a')).toBe('ready');
    expect(getImageBitmap('a')).toBe(bmp);
    expect(calls).toBe(1); // no reload after ready
  });

  it('de-dupes concurrent gets for the same src', () => {
    let calls = 0;
    __setImageLoaderForTests(() => { calls++; return new Promise<ImageBitmap>(() => {}); });
    getImageBitmap('x');
    getImageBitmap('x');
    getImageBitmap('x');
    expect(calls).toBe(1);
  });

  it('runs the subscribers after one that throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const d = deferred<ImageBitmap>();
    __setImageLoaderForTests(() => d.promise);
    const later = vi.fn();
    subscribeImageReady(() => {
      throw new Error('boom');
    });
    subscribeImageReady(later);

    getImageBitmap('a');
    d.resolve(fakeBitmap());
    await flush();

    expect(later).toHaveBeenCalledTimes(1);
    expect(imageStatus('a')).toBe('ready');
    error.mockRestore();
  });

  it('caches errors and does not retry', async () => {
    const d = deferred<ImageBitmap>();
    let calls = 0;
    __setImageLoaderForTests(() => { calls++; return d.promise; });
    let notified = 0;
    subscribeImageReady(() => { notified++; });

    getImageBitmap('bad');
    d.reject(new Error('boom'));
    await flush();

    expect(notified).toBe(1);
    expect(imageStatus('bad')).toBe('error');
    expect(getImageBitmap('bad')).toBeUndefined();
    expect(calls).toBe(1); // no retry on a cached error
  });

  it('reset clears cache + subscribers', () => {
    __setImageLoaderForTests(() => new Promise<ImageBitmap>(() => {}));
    getImageBitmap('y');
    expect(imageStatus('y')).toBe('loading');
    _resetImageCacheForTests();
    expect(imageStatus('y')).toBe('idle');
  });
});

describe('isVectorImageSrc', () => {
  it('recognizes SVG data URIs and .svg URLs', () => {
    expect(isVectorImageSrc('data:image/svg+xml;base64,PHN2Zz4=')).toBe(true);
    expect(isVectorImageSrc('data:image/svg+xml,%3Csvg%3E')).toBe(true);
    expect(isVectorImageSrc('DATA:IMAGE/SVG+XML;utf8,<svg>')).toBe(true);
    expect(isVectorImageSrc('https://x.test/a/logo.svg')).toBe(true);
    expect(isVectorImageSrc('logo.SVG?v=2')).toBe(true);
    expect(isVectorImageSrc('logo.svg#frag')).toBe(true);
  });

  it('rejects raster sources', () => {
    expect(isVectorImageSrc('data:image/png;base64,AAAA')).toBe(false);
    expect(isVectorImageSrc('https://x.test/photo.png')).toBe(false);
    expect(isVectorImageSrc('https://x.test/svg/photo.png')).toBe(false);
    expect(isVectorImageSrc('https://x.test/photo.png?as=.svg')).toBe(false);
    expect(isVectorImageSrc('blob:https://x.test/1234')).toBe(false);
  });
});

describe('imageCache — vector sources re-raster at their drawn size', () => {
  beforeEach(() => _resetImageCacheForTests());

  const SVG = 'data:image/svg+xml,%3Csvg%3E';
  const sized = (width: number, height: number): ImageBitmap =>
    ({ width, height, close() {} } as unknown as ImageBitmap);

  type Request = { size?: { width: number; height: number }; d: ReturnType<typeof deferred<ImageBitmap>> };

  /** Loader whose every call is recorded and resolved by hand. */
  function manualLoader(): Request[] {
    const requests: Request[] = [];
    __setImageLoaderForTests((_src, size) => {
      const d = deferred<ImageBitmap>();
      requests.push({ size, d });
      return d.promise;
    });
    return requests;
  }

  async function primeNatural(requests: Request[], w: number, h: number): Promise<ImageBitmap> {
    getImageBitmap(SVG, { width: w, height: h });
    const bmp = sized(w, h);
    requests[0].d.resolve(bmp);
    await flush();
    return bmp;
  }

  it('leaves raster sources alone whatever size they are drawn at', async () => {
    const requests = manualLoader();
    getImageBitmap('photo.png', { width: 5000, height: 5000 });
    requests[0].d.resolve(sized(10, 10));
    await flush();
    getImageBitmap('photo.png', { width: 5000, height: 5000 });
    expect(requests).toHaveLength(1);
    expect(requests[0].size).toBeUndefined();
  });

  it('first load is at natural size, then re-rasters to the next power-of-two bucket', async () => {
    const requests = manualLoader();
    const natural = await primeNatural(requests, 100, 50);
    expect(requests[0].size).toBeUndefined();

    expect(getImageBitmap(SVG, { width: 150, height: 75 })).toBe(natural);
    expect(requests).toHaveLength(2);
    expect(requests[1].size).toEqual({ width: 200, height: 100 });
  });

  it('keeps painting the previous raster until the new one resolves', async () => {
    const requests = manualLoader();
    const natural = await primeNatural(requests, 100, 50);
    let notified = 0;
    subscribeImageReady(() => { notified++; });

    expect(getImageBitmap(SVG, { width: 300, height: 150 })).toBe(natural);
    expect(imageStatus(SVG)).toBe('ready');
    expect(getImageBitmap(SVG, { width: 300, height: 150 })).toBe(natural);

    const big = sized(400, 200);
    requests[1].d.resolve(big);
    await flush();
    expect(notified).toBe(1);
    expect(getImageBitmap(SVG, { width: 300, height: 150 })).toBe(big);
  });

  it('does not re-raster inside a bucket', async () => {
    const requests = manualLoader();
    await primeNatural(requests, 100, 50);
    getImageBitmap(SVG, { width: 120, height: 60 });
    requests[1].d.resolve(sized(200, 100));
    await flush();

    for (const w of [101, 150, 199, 200]) getImageBitmap(SVG, { width: w, height: w / 2 });
    getImageBitmap(SVG);
    expect(requests).toHaveLength(2);

    getImageBitmap(SVG, { width: 201, height: 100 });
    expect(requests).toHaveLength(3);
    expect(requests[2].size).toEqual({ width: 400, height: 200 });
  });

  it('keeps one raster in flight per src and asks for the latest bucket once it lands', async () => {
    const requests = manualLoader();
    await primeNatural(requests, 100, 50);
    getImageBitmap(SVG, { width: 150, height: 75 });
    getImageBitmap(SVG, { width: 700, height: 350 });
    expect(requests).toHaveLength(2);

    requests[1].d.resolve(sized(200, 100));
    await flush();
    getImageBitmap(SVG, { width: 700, height: 350 });
    expect(requests).toHaveLength(3);
    expect(requests[2].size).toEqual({ width: 800, height: 400 });
  });

  it('caps the raster at the texture-size limit and does not retry once capped', async () => {
    const requests = manualLoader();
    await primeNatural(requests, 1000, 10);
    getImageBitmap(SVG, { width: 100_000, height: 1000 });
    expect(requests[1].size).toEqual({ width: 4096, height: 41 });
    requests[1].d.resolve(sized(4096, 41));
    await flush();
    getImageBitmap(SVG, { width: 200_000, height: 2000 });
    expect(requests).toHaveLength(2);
  });

  it('caps the raster at the pixel-count ceiling', async () => {
    const requests = manualLoader();
    await primeNatural(requests, 1000, 1000);
    getImageBitmap(SVG, { width: 100_000, height: 100_000 });
    const { width, height } = requests[1].size!;
    expect(width).toBeLessThanOrEqual(4096);
    expect(width * height).toBeLessThanOrEqual(4096 * 4096);
  });

  it('re-rasters down once the drawn size falls two buckets below the raster', async () => {
    const requests = manualLoader();
    await primeNatural(requests, 100, 50);
    getImageBitmap(SVG, { width: 800, height: 400 });
    requests[1].d.resolve(sized(800, 400));
    await flush();

    getImageBitmap(SVG, { width: 300, height: 150 }); // bucket 4 under an 8x raster: kept
    expect(requests).toHaveLength(2);
    getImageBitmap(SVG, { width: 200, height: 100 }); // bucket 2 under an 8x raster: shrink
    expect(requests).toHaveLength(3);
    expect(requests[2].size).toEqual({ width: 200, height: 100 });
  });

  it('settles on the larger raster when the source is drawn at two sizes', async () => {
    const requests = manualLoader();
    await primeNatural(requests, 100, 50);
    // A main view and a minimap, each asking for its own size every frame.
    for (let frame = 0; frame < 12; frame++) {
      getImageBitmap(SVG, { width: 20, height: 10 });
      getImageBitmap(SVG, { width: 800, height: 400 });
      const open = requests[requests.length - 1];
      open.d.resolve(sized(open.size?.width ?? 100, open.size?.height ?? 50));
      await flush();
    }
    expect(requests.length).toBeLessThanOrEqual(5);
    expect(getImageBitmap(SVG)).toMatchObject({ width: 800, height: 400 });
  });

  it('still shrinks a regrown raster down to the size that regrew it', async () => {
    const requests = manualLoader();
    await primeNatural(requests, 100, 50);
    const draw = async (width: number, height: number): Promise<void> => {
      const before = requests.length;
      getImageBitmap(SVG, { width, height });
      if (requests.length === before) return;
      requests[before].d.resolve(sized(requests[before].size!.width, requests[before].size!.height));
      await flush();
    };
    await draw(800, 400);
    await draw(100, 50);
    await draw(800, 400);
    await draw(6400, 3200);
    await draw(100, 50);
    expect(getImageBitmap(SVG)).toMatchObject({ width: 800, height: 400 });
  });

  it('keeps the old raster when a re-raster fails, and does not retry that bucket', async () => {
    const requests = manualLoader();
    const natural = await primeNatural(requests, 100, 50);
    getImageBitmap(SVG, { width: 300, height: 150 });
    requests[1].d.reject(new Error('too big'));
    await flush();

    expect(imageStatus(SVG)).toBe('ready');
    expect(getImageBitmap(SVG, { width: 300, height: 150 })).toBe(natural);
    expect(requests).toHaveLength(2);
  });

  it('frees the replaced raster’s GL texture when the new one lands', async () => {
    const { gl, calls } = makeGLRecorder();
    const glCache = new GLImageCache(gl);
    const requests = manualLoader();
    const natural = await primeNatural(requests, 100, 50);
    glCache.upload(natural, natural);
    const deletes = () => calls.filter((c) => c.name === 'deleteTexture').length;
    const before = deletes();

    getImageBitmap(SVG, { width: 300, height: 150 });
    expect(deletes()).toBe(before);
    requests[1].d.resolve(sized(400, 200));
    await flush();
    expect(deletes()).toBe(before + 1);
    glCache.dispose();
  });
});

describe('imageCache — default vector loader', () => {
  beforeEach(() => _resetImageCacheForTests());
  afterEach(() => vi.unstubAllGlobals());

  it('decodes the SVG once and draws each raster at its requested size', async () => {
    let decodes = 0;
    const drawn: number[][] = [];
    class FakeImage {
      src = '';
      crossOrigin: string | null = null;
      naturalWidth = 100;
      naturalHeight = 50;
      decode() { decodes++; return Promise.resolve(); }
    }
    class FakeOffscreenCanvas {
      constructor(public width: number, public height: number) {}
      getContext() {
        return {
          drawImage: (_img: unknown, x: number, y: number, w: number, h: number) => { drawn.push([x, y, w, h]); },
        };
      }
    }
    vi.stubGlobal('Image', FakeImage);
    vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
    vi.stubGlobal('createImageBitmap', (c: FakeOffscreenCanvas) =>
      Promise.resolve({ width: c.width, height: c.height, close() {} }));

    const SVG = 'data:image/svg+xml,%3Csvg%3E';
    getImageBitmap(SVG);
    await flush();
    expect(getImageBitmap(SVG)).toMatchObject({ width: 100, height: 50 });
    getImageBitmap(SVG, { width: 350, height: 175 });
    await flush();
    expect(getImageBitmap(SVG)).toMatchObject({ width: 400, height: 200 });
    expect(decodes).toBe(1);
    expect(drawn).toEqual([[0, 0, 100, 50], [0, 0, 400, 200]]);
  });
});

describe('imageCache — release and retry', () => {
  beforeEach(() => _resetImageCacheForTests());

  it('releaseImage forgets a src, frees its texture, and lets a later read load again', async () => {
    const bmp = fakeBitmap();
    let calls = 0;
    __setImageLoaderForTests(() => { calls++; return Promise.resolve(bmp); });
    getImageBitmap('a');
    await flush();
    const rec = makeGLRecorder();
    const gl = new GLImageCache(rec.gl);
    gl.upload(bmp, bmp);
    rec.reset();

    releaseImage('a');
    expect(imageStatus('a')).toBe('idle');
    expect(rec.calls.some((c) => c.name === 'deleteTexture')).toBe(true);

    expect(getImageBitmap('a')).toBeUndefined();
    expect(calls).toBe(2);
    gl.dispose();
  });

  it('releaseImage drops a load in flight, whose result is then ignored', async () => {
    const d = deferred<ImageBitmap>();
    __setImageLoaderForTests(() => d.promise);
    getImageBitmap('a');
    releaseImage('a');
    d.resolve(fakeBitmap());
    await flush();
    expect(imageStatus('a')).toBe('idle');
  });

  it('retryImage reloads a failed src and tells subscribers it is loading', async () => {
    let fail = true;
    const bmp = fakeBitmap();
    __setImageLoaderForTests(() => (fail ? Promise.reject(new Error('offline')) : Promise.resolve(bmp)));
    getImageBitmap('a');
    await flush();
    expect(imageStatus('a')).toBe('error');

    let notified = 0;
    subscribeImageReady(() => { notified++; });
    fail = false;
    retryImage('a');
    expect(imageStatus('a')).toBe('loading');
    expect(notified).toBe(1);
    await flush();
    expect(imageStatus('a')).toBe('ready');
    expect(getImageBitmap('a')).toBe(bmp);
  });

  it('retryImage leaves a src that has not failed alone', async () => {
    let calls = 0;
    __setImageLoaderForTests(() => { calls++; return Promise.resolve(fakeBitmap()); });
    retryImage('never-asked');
    expect(imageStatus('never-asked')).toBe('idle');
    getImageBitmap('a');
    await flush();
    retryImage('a');
    expect(imageStatus('a')).toBe('ready');
    expect(calls).toBe(1);
  });
});

describe('the image cache byte budget', () => {
  beforeEach(() => _resetImageCacheForTests());

  // A 2x2 bitmap decodes to 16 bytes of RGBA.
  const BUDGET_FOR_ONE = 20;

  async function load(src: string): Promise<ImageBitmap> {
    const bmp = fakeBitmap();
    __setImageLoaderForTests(async () => bmp);
    getImageBitmap(src);
    await flush();
    return bmp;
  }

  it('drops the least recently read image once a load takes the cache past it', async () => {
    setImageCacheBudget(BUDGET_FOR_ONE);
    await load('a');
    await load('b');
    expect(imageStatus('a')).toBe('idle');
    expect(imageStatus('b')).toBe('ready');
  });

  it('keeps everything under the default budget', async () => {
    await load('a');
    await load('b');
    expect(imageStatus('a')).toBe('ready');
  });

  it('spares an image a live renderer drew in its latest frame', async () => {
    setImageCacheBudget(BUDGET_FOR_ONE);
    const gl = makeGLRecorder().gl;
    const textures = new GLImageCache(gl);
    const a = await load('a');
    textures.beginFrame();
    textures.upload(a, a);
    await load('b');
    expect(imageStatus('a')).toBe('ready');

    // A frame that leaves it out is what releases it.
    textures.beginFrame();
    await load('c');
    expect(imageStatus('a')).toBe('idle');
    textures.dispose();
  });

  it('spares an image read since the last load landed, drawn through GL or not', async () => {
    setImageCacheBudget(BUDGET_FOR_ONE);
    await load('a');
    const d = deferred<ImageBitmap>();
    __setImageLoaderForTests(() => d.promise);
    getImageBitmap('b');
    getImageBitmap('a');
    d.resolve(fakeBitmap());
    await flush();
    expect(imageStatus('a')).toBe('ready');
    expect(imageStatus('b')).toBe('ready');
  });

  it('frees the texture of an image it drops', async () => {
    setImageCacheBudget(BUDGET_FOR_ONE);
    const recorder = makeGLRecorder();
    const textures = new GLImageCache(recorder.gl);
    const a = await load('a');
    textures.beginFrame();
    textures.upload(a, a);
    textures.beginFrame();
    recorder.reset();
    await load('b');
    expect(recorder.calls.filter((c) => c.name === 'deleteTexture')).toHaveLength(1);
    textures.dispose();
  });
});

describe('bitmapSrc', () => {
  beforeEach(() => _resetImageCacheForTests());

  it('names a bitmap so an image node draws it with no load', () => {
    let calls = 0;
    __setImageLoaderForTests(() => { calls++; return new Promise<ImageBitmap>(() => {}); });
    const bmp = fakeBitmap();
    const src = bitmapSrc(bmp);
    expect(getImageBitmap(src)).toBe(bmp);
    expect(imageStatus(src)).toBe('ready');
    expect(calls).toBe(0);
  });

  it('gives the same bitmap the same src and another bitmap another', () => {
    const a = fakeBitmap();
    expect(bitmapSrc(a)).toBe(bitmapSrc(a));
    expect(bitmapSrc(fakeBitmap())).not.toBe(bitmapSrc(a));
  });

  it('frees the texture and the name on releaseImage, and a later read does not try to load it', () => {
    let calls = 0;
    __setImageLoaderForTests(() => { calls++; return new Promise<ImageBitmap>(() => {}); });
    const recorder = makeGLRecorder();
    const textures = new GLImageCache(recorder.gl);
    const bmp = fakeBitmap();
    const src = bitmapSrc(bmp);
    textures.upload(bmp, bmp);
    recorder.reset();
    releaseImage(src);
    expect(recorder.calls.filter((c) => c.name === 'deleteTexture')).toHaveLength(1);
    expect(getImageBitmap(src)).toBeUndefined();
    expect(calls).toBe(0);
    expect(bitmapSrc(bmp)).not.toBe(src);
    textures.dispose();
  });

  it('is never dropped to fit the budget', async () => {
    setImageCacheBudget(1);
    const bmp = fakeBitmap();
    const src = bitmapSrc(bmp);
    __setImageLoaderForTests(() => Promise.resolve(fakeBitmap()));
    getImageBitmap('other');
    await flush();
    expect(getImageBitmap(src)).toBe(bmp);
  });
});
