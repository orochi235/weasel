import { describe, it, expect, beforeEach } from 'vitest';
import {
  getImageBitmap,
  imageStatus,
  subscribeImageReady,
  __setImageLoaderForTests,
  _resetImageCacheForTests,
} from './imageCache';

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
