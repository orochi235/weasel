import { describe, it, expect } from 'vitest';
import { makeGLRecorder } from '../test-utils/glRecorder';
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
});
