import { describe, it, expect, vi, afterEach } from 'vitest';
import { createGLRecorder } from '../testing/glRecorder';
import { webglDevice } from '../gpu/webgl/WebGLDevice';
import { GLTextureCache } from './GLTextureCache';

const image = { width: 4, height: 4, data: new Uint8ClampedArray(64) } as ImageData;
const page = new Uint8Array(8 * 8 * 4);

afterEach(() => vi.restoreAllMocks());

describe('GLTextureCache — an id naming both a glyph page and an image', () => {
  it.each([
    ['uploadR8', (c: GLTextureCache, id: string) => c.uploadR8(id, 8, 8, page.subarray(0, 64))],
    ['uploadRGBA', (c: GLTextureCache, id: string) => c.uploadRGBA(id, 8, 8, page)],
  ])('warns, and keeps the page made by %s, when an image is uploaded under its id', (name, makePage) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { gl, calls, reset } = createGLRecorder();
    const cache = new GLTextureCache(webglDevice(gl));
    const id = `page-then-image-${name}`;
    makePage(cache, id);
    const made = cache.texture(id);
    reset();
    cache.upload(id, image);
    cache.uploadRegistered(id, image);
    expect(calls.some((c) => c.name === 'texImage2D')).toBe(false);
    expect(warn.mock.calls.some(([m]) => String(m).includes(id))).toBe(true);
    // Nor may a sweep that never saw the id registered delete the page.
    cache.sweep({ getVersion: () => 1, has: () => false });
    expect(cache.texture(id)).toBe(made);
  });

  it('warns when a glyph page is asked for under an image\'s id', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { gl } = createGLRecorder();
    const cache = new GLTextureCache(webglDevice(gl));
    cache.upload('image-then-page', image);
    cache.uploadR8('image-then-page', 8, 8, page.subarray(0, 64));
    expect(warn.mock.calls.some(([m]) => String(m).includes('image-then-page'))).toBe(true);
  });
});
