import { describe, it, expect, vi, afterEach } from 'vitest';
import { makeGLRecorder } from '../testing/glRecorder';
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
    b.reset();
    releaseImageSource(key);
    expect(a.calls.some((c) => c.name === 'deleteTexture')).toBe(true);
    expect(b.calls.some((c) => c.name === 'deleteTexture')).toBe(false);
    cacheA.dispose();
  });

  it('dispose() deletes every texture it uploaded, once', () => {
    const rec = makeGLRecorder();
    const cache = new GLImageCache(rec.gl);
    const t1 = cache.upload(fakeImg1, fakeImgData);
    const t2 = cache.upload(fakeImg2, fakeImgData);
    cache.release(fakeImg1);
    rec.reset();
    cache.dispose();
    cache.dispose();
    expect(rec.calls.filter((c) => c.name === 'deleteTexture').map((c) => c.args[0])).toEqual([t2]);
    expect(t1).not.toBe(t2);
  });

  it('abandon() forgets its textures without deleting them', () => {
    const rec = makeGLRecorder();
    const cache = new GLImageCache(rec.gl);
    cache.upload(fakeImg1, fakeImgData);
    rec.reset();
    cache.abandon();
    cache.dispose();
    expect(rec.calls.some((c) => c.name === 'deleteTexture')).toBe(false);
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
  const minFilters = (rec: ReturnType<typeof makeGLRecorder>): unknown[] => rec.calls
    .filter((c) => c.name === 'texParameteri' && c.args[1] === rec.gl.TEXTURE_MIN_FILTER)
    .map((c) => c.args[2]);

  it('generates mipmaps at upload, and a draw that asks for them samples through them', () => {
    const rec = makeGLRecorder();
    const cache = new GLImageCache(rec.gl, 'mipmap');
    const key = {};
    cache.upload(key, {} as ImageBitmap);
    expect(rec.calls.map((c) => c.name)).toContain('generateMipmap');
    cache.setMinFilter(key, true);
    expect(minFilters(rec).at(-1)).toBe(rec.gl.LINEAR_MIPMAP_LINEAR);
  });

  it('a draw that does not ask for them keeps one bilinear tap', () => {
    const rec = makeGLRecorder();
    const cache = new GLImageCache(rec.gl, 'mipmap');
    const key = {};
    cache.upload(key, {} as ImageBitmap);
    cache.setMinFilter(key, true);
    cache.setMinFilter(key, false);
    expect(minFilters(rec).at(-1)).toBe(rec.gl.LINEAR);
  });

  it("'linear' never builds them, whatever a draw asks", () => {
    const rec = makeGLRecorder();
    const cache = new GLImageCache(rec.gl, 'linear');
    const key = {};
    cache.upload(key, {} as ImageBitmap);
    cache.setMinFilter(key, true);
    expect(rec.calls.map((c) => c.name)).not.toContain('generateMipmap');
    const minFilter = rec.calls.find(
      (c) => c.name === 'texParameteri' && c.args[1] === rec.gl.TEXTURE_MIN_FILTER,
    );
    expect(minFilter?.args[2]).toBe(rec.gl.LINEAR);
  });
});

describe('GLImageCache — a source the garbage collector reclaimed', () => {
  /** Stands in for the engine: records what was registered and lets the test
   *  play the collector. */
  function stubFinalizers() {
    const held = new Map<object, WebGLTexture>();
    let collected: (tex: WebGLTexture) => void = () => {};
    vi.stubGlobal('FinalizationRegistry', class {
      constructor(cb: (tex: WebGLTexture) => void) { collected = cb; }
      register(key: object, tex: WebGLTexture) { held.set(key, tex); }
      unregister(key: object) { return held.delete(key); }
    });
    return {
      held,
      collect(key: object) {
        const tex = held.get(key);
        held.delete(key);
        if (tex) collected(tex);
      },
    };
  }

  afterEach(() => { vi.unstubAllGlobals(); });

  it('deletes the texture at the next drain', () => {
    const gc = stubFinalizers();
    const { gl, calls } = makeGLRecorder();
    const cache = new GLImageCache(gl);
    const tex = cache.upload(fakeImg1, fakeImgData);
    cache.upload(fakeImg2, fakeImgData);

    gc.collect(fakeImg1);
    expect(calls.filter((c) => c.name === 'deleteTexture')).toHaveLength(0);
    cache.drainPendingDeletes();
    const deletes = calls.filter((c) => c.name === 'deleteTexture');
    expect(deletes).toHaveLength(1);
    expect(deletes[0].args[0]).toBe(tex);

    cache.dispose();
    expect(calls.filter((c) => c.name === 'deleteTexture')).toHaveLength(2);
  });

  it('stops watching a source released by hand', () => {
    const gc = stubFinalizers();
    const { gl, calls } = makeGLRecorder();
    const cache = new GLImageCache(gl);
    cache.upload(fakeImg1, fakeImgData);
    cache.release(fakeImg1);
    expect(gc.held.has(fakeImg1)).toBe(false);
    cache.drainPendingDeletes();
    expect(calls.filter((c) => c.name === 'deleteTexture')).toHaveLength(1);
    cache.dispose();
  });
});
