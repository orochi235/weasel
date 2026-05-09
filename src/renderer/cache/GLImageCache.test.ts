import { describe, it, expect } from 'vitest';
import { makeGLRecorder } from '../test-utils/glRecorder';
import { GLImageCache } from './GLImageCache';

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
