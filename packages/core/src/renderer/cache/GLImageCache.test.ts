import { describe, it, expect } from 'vitest';
import { makeGLRecorder } from '../test-utils/glRecorder';
import { GLImageCache, maxImageTextureSide, releaseImageSource } from './GLImageCache';

const fakeImg1 = { width: 8, height: 8 } as ImageBitmap;
const fakeImg2 = { width: 4, height: 4 } as ImageBitmap;
// jsdom's vitest env may not have ImageData; use a duck-typed object.
const fakeImgData = { width: 8, height: 8, data: new Uint8ClampedArray(8 * 8 * 4) } as ImageData;

describe('GLImageCache', () => {
  it('upload() creates a texture and returns a GL texture handle', () => {
    const { gl, calls } = makeGLRecorder();
    const cache = new GLImageCache(gl);
    const tex = cache.upload(fakeImg1, fakeImgData);
    expect(tex).toBeTruthy();
    expect(calls.some((c) => c.name === 'createTexture')).toBe(true);
    expect(calls.some((c) => c.name === 'texImage2D')).toBe(true);
  });

  it('upload() is idempotent — second call for same identity skips createTexture', () => {
    const { gl, calls } = makeGLRecorder();
    const cache = new GLImageCache(gl);
    cache.upload(fakeImg1, fakeImgData);
    const countBefore = calls.filter((c) => c.name === 'createTexture').length;
    cache.upload(fakeImg1, fakeImgData);
    const countAfter = calls.filter((c) => c.name === 'createTexture').length;
    expect(countBefore).toBe(countAfter);
  });

  it('upload() for different identity creates separate textures', () => {
    const { gl, calls } = makeGLRecorder();
    const cache = new GLImageCache(gl);
    cache.upload(fakeImg1, fakeImgData);
    cache.upload(fakeImg2, fakeImgData);
    expect(calls.filter((c) => c.name === 'createTexture').length).toBe(2);
  });

  it('bind() calls activeTexture + bindTexture', () => {
    const { gl, calls, reset } = makeGLRecorder();
    const cache = new GLImageCache(gl);
    cache.upload(fakeImg1, fakeImgData);
    reset();
    cache.bind(fakeImg1, 0);
    expect(calls.some((c) => c.name === 'activeTexture')).toBe(true);
    expect(calls.some((c) => c.name === 'bindTexture')).toBe(true);
  });

  it('sets CLAMP_TO_EDGE wrap by default', () => {
    const { gl, calls } = makeGLRecorder();
    const cache = new GLImageCache(gl);
    cache.upload(fakeImg1, fakeImgData);
    const wrapCalls = calls.filter((c) => c.name === 'texParameteri');
    const hasClamp = wrapCalls.some((c) => c.args[2] === gl.CLAMP_TO_EDGE);
    expect(hasClamp).toBe(true);
  });

  it('sets REPEAT wrap when repetition is "repeat"', () => {
    const { gl, calls } = makeGLRecorder();
    const cache = new GLImageCache(gl);
    cache.upload(fakeImg1, fakeImgData, 'repeat');
    const wrapCalls = calls.filter((c) => c.name === 'texParameteri');
    const hasRepeat = wrapCalls.some((c) => c.args[2] === gl.REPEAT);
    expect(hasRepeat).toBe(true);
  });
});

describe('releasing a source', () => {
  it('release() deletes the texture, and a later draw re-uploads', () => {
    const { gl, calls } = makeGLRecorder();
    const cache = new GLImageCache(gl);
    const tex = cache.upload(fakeImg1, fakeImgData);
    cache.release(fakeImg1);
    expect(calls.filter((c) => c.name === 'deleteTexture').map((c) => c.args[0])).toEqual([tex]);
    cache.upload(fakeImg1, fakeImgData);
    expect(calls.filter((c) => c.name === 'createTexture')).toHaveLength(2);
    cache.dispose();
  });

  it('releaseImageSource() reaches every live cache, and none that is disposed', () => {
    const a = makeGLRecorder();
    const b = makeGLRecorder();
    const cacheA = new GLImageCache(a.gl);
    const cacheB = new GLImageCache(b.gl);
    const key = {};
    cacheA.upload(key, fakeImgData);
    cacheB.upload(key, fakeImgData);
    cacheB.dispose();
    releaseImageSource(key);
    expect(a.calls.some((c) => c.name === 'deleteTexture')).toBe(true);
    expect(b.calls.some((c) => c.name === 'deleteTexture')).toBe(false);
    cacheA.dispose();
  });
});

describe('maxImageTextureSide', () => {
  it('is the smallest MAX_TEXTURE_SIZE among live caches', () => {
    const rec = makeGLRecorder();
    const asked: unknown[] = [];
    const gl = new Proxy(rec.gl, {
      get: (t, p) => (p === 'getParameter'
        ? (pname: unknown) => { asked.push(pname); return 1024; }
        : Reflect.get(t, p)),
    });
    const small = new GLImageCache(gl);
    expect(asked).toEqual([rec.gl.MAX_TEXTURE_SIZE]);
    expect(maxImageTextureSide()).toBe(1024);
    small.dispose();
    expect(maxImageTextureSide()).toBeGreaterThan(1024);
  });
});

describe('minification: mipmap', () => {
  it('uploads with LINEAR_MIPMAP_LINEAR and generates mipmaps', () => {
    const rec = makeGLRecorder();
    const cache = new GLImageCache(rec.gl, 'mipmap');
    cache.upload({}, {} as ImageBitmap);
    const names = rec.calls.map((c) => c.name);
    expect(names).toContain('generateMipmap');
    const minFilter = rec.calls.find(
      (c) => c.name === 'texParameteri' && c.args[1] === rec.gl.TEXTURE_MIN_FILTER,
    );
    expect(minFilter?.args[2]).toBe(rec.gl.LINEAR_MIPMAP_LINEAR);
  });

  it("default 'linear' behavior is unchanged (no mipmap calls)", () => {
    const rec = makeGLRecorder();
    const cache = new GLImageCache(rec.gl);
    cache.upload({}, {} as ImageBitmap);
    expect(rec.calls.map((c) => c.name)).not.toContain('generateMipmap');
    const minFilter = rec.calls.find(
      (c) => c.name === 'texParameteri' && c.args[1] === rec.gl.TEXTURE_MIN_FILTER,
    );
    expect(minFilter?.args[2]).toBe(rec.gl.LINEAR);
  });
});
