import { describe, it, expect } from 'vitest';
import { makeGLRecorder } from '../testing/glRecorder';
import { GLTextureCache } from './GLTextureCache';

const fakeImage = { width: 4, height: 4, data: new Uint8ClampedArray(64) } as ImageData;

describe('GLTextureCache', () => {
  it('upload() returns an opaque handle string', () => {
    const { gl } = makeGLRecorder();
    const cache = new GLTextureCache(gl);
    const handle = cache.upload('inter', fakeImage);
    expect(typeof handle).toBe('string');
    expect(handle).toBe('inter');
  });

  it('upload() calls createTexture, texImage2D', () => {
    const { gl, calls } = makeGLRecorder();
    const cache = new GLTextureCache(gl);
    cache.upload('inter', fakeImage);
    expect(calls.some((c) => c.name === 'createTexture')).toBe(true);
    expect(calls.some((c) => c.name === 'texImage2D')).toBe(true);
  });

  it('bind() calls bindTexture + activeTexture', () => {
    const { gl, calls, reset } = makeGLRecorder();
    const cache = new GLTextureCache(gl);
    cache.upload('inter', fakeImage);
    reset();
    cache.bind('inter', 0);
    expect(calls.some((c) => c.name === 'activeTexture')).toBe(true);
    expect(calls.some((c) => c.name === 'bindTexture')).toBe(true);
  });

  it('upload() for the same id is a no-op on second call (cached)', () => {
    const { gl, calls } = makeGLRecorder();
    const cache = new GLTextureCache(gl);
    cache.upload('inter', fakeImage);
    const countAfterFirst = calls.filter((c) => c.name === 'createTexture').length;
    cache.upload('inter', fakeImage);
    const countAfterSecond = calls.filter((c) => c.name === 'createTexture').length;
    expect(countAfterFirst).toBe(countAfterSecond);
  });

  it('re-applies the wrap mode when an already-uploaded id is claimed with a different one', () => {
    const { gl, calls, reset } = makeGLRecorder();
    const cache = new GLTextureCache(gl);
    // A registered image used first as a clamped shader texture, then as a
    // repeating pattern tile: the tile must not inherit CLAMP_TO_EDGE.
    cache.upload('tex_1', fakeImage);
    reset();
    cache.upload('tex_1', fakeImage, 'repeat');
    const wraps = calls.filter(
      (c) => c.name === 'texParameteri'
        && (c.args[1] === gl.TEXTURE_WRAP_S || c.args[1] === gl.TEXTURE_WRAP_T),
    );
    expect(wraps.map((c) => c.args[2])).toEqual([gl.REPEAT, gl.REPEAT]);
    expect(calls.filter((c) => c.name === 'createTexture').length).toBe(0);
  });

  it('does not touch texture parameters when the wrap mode is unchanged', () => {
    const { gl, calls, reset } = makeGLRecorder();
    const cache = new GLTextureCache(gl);
    cache.upload('tile', fakeImage, 'repeat');
    reset();
    cache.upload('tile', fakeImage, 'repeat');
    expect(calls.filter((c) => c.name === 'texParameteri').length).toBe(0);
  });

  it('has() returns true after upload, false otherwise', () => {
    const { gl } = makeGLRecorder();
    const cache = new GLTextureCache(gl);
    expect(cache.has('inter')).toBe(false);
    cache.upload('inter', fakeImage);
    expect(cache.has('inter')).toBe(true);
  });

  it('free() deletes every uploaded texture and clears the cache', () => {
    const { gl, calls, reset } = makeGLRecorder();
    const cache = new GLTextureCache(gl);
    cache.upload('a', fakeImage);
    cache.upload('b', fakeImage);
    reset();
    cache.free();
    expect(calls.filter((c) => c.name === 'deleteTexture').length).toBe(2);
    expect(cache.has('a')).toBe(false);
    expect(cache.has('b')).toBe(false);
  });

  describe('a registered texture', () => {
    const other = { width: 4, height: 4, data: new Uint8ClampedArray(64) } as ImageData;
    const live = (ids: string[], version: number) => ({
      getVersion: () => version,
      has: (id: string) => ids.includes(id),
    });

    it('uploads its pixels again, into the same texture, when its source changes', () => {
      const { gl, calls, reset } = makeGLRecorder();
      const cache = new GLTextureCache(gl);
      cache.uploadRegistered('tex_1', fakeImage, 'repeat');
      reset();
      cache.uploadRegistered('tex_1', fakeImage, 'repeat');
      expect(calls.filter((c) => c.name === 'texImage2D').length).toBe(0);
      cache.uploadRegistered('tex_1', other, 'repeat');
      const uploads = calls.filter((c) => c.name === 'texImage2D');
      expect(uploads.length).toBe(1);
      expect(uploads[0].args.at(-1)).toBe(other);
      expect(calls.filter((c) => c.name === 'createTexture' || c.name === 'deleteTexture').length).toBe(0);
    });

    it('is deleted by a sweep once the registry no longer has its id', () => {
      const { gl, calls, reset } = makeGLRecorder();
      const cache = new GLTextureCache(gl);
      cache.uploadRegistered('tex_1', fakeImage);
      cache.uploadRegistered('tex_2', fakeImage);
      cache.upload('atlas', fakeImage);
      const made = calls.filter((c) => c.name === 'createTexture').map((c) => c.result);
      reset();
      cache.sweep(live(['tex_2'], 1));
      const deleted = calls.filter((c) => c.name === 'deleteTexture');
      expect(deleted.map((c) => c.args[0])).toEqual([made[0]]);
      expect(cache.has('tex_1')).toBe(false);
      expect(cache.has('tex_2')).toBe(true);
      // Never in the registry, so never the sweep's to judge.
      expect(cache.has('atlas')).toBe(true);
    });

    it('is not walked again until the registry changes', () => {
      const { gl } = makeGLRecorder();
      const cache = new GLTextureCache(gl);
      cache.uploadRegistered('tex_1', fakeImage);
      cache.sweep(live(['tex_1'], 1));
      let asked = 0;
      cache.sweep({ getVersion: () => 1, has: () => { asked++; return true; } });
      expect(asked).toBe(0);
    });
  });
});
