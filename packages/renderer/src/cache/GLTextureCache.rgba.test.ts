import { describe, it, expect } from 'vitest';
import { makeGLRecorder } from '../testing/glRecorder';
import { GLTextureCache } from './GLTextureCache';

describe('GLTextureCache — a texture of color texels sent as bytes', () => {
  const texels = new Uint8Array(8 * 8 * 4);

  it('uploads them as RGBA as held, minified through mipmaps', () => {
    const { gl, calls } = makeGLRecorder();
    const cache = new GLTextureCache(gl);
    cache.uploadRGBA('page', 8, 8, texels);

    const upload = calls.find((c) => c.name === 'texImage2D')!;
    expect(upload.args.slice(0, 8)).toEqual([gl.TEXTURE_2D, 0, gl.RGBA, 8, 8, 0, gl.RGBA, gl.UNSIGNED_BYTE]);
    // Already premultiplied: asking GL to do it too would do it twice.
    expect(calls.some((c) => c.name === 'pixelStorei' && c.args[0] === gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL)).toBe(false);
    const min = calls.find((c) => c.name === 'texParameteri' && c.args[1] === gl.TEXTURE_MIN_FILTER)!;
    expect(min.args[2]).toBe(gl.LINEAR_MIPMAP_LINEAR);
    expect(calls.filter((c) => c.name === 'generateMipmap').map((c) => c.args)).toEqual([[gl.TEXTURE_2D]]);
    expect(cache.has('page')).toBe(true);
  });

  it('patches a rect and builds the mipmaps again', () => {
    const { gl, calls, reset } = makeGLRecorder();
    const cache = new GLTextureCache(gl);
    cache.uploadRGBA('page', 8, 8, texels);
    const texture = calls.find((c) => c.name === 'createTexture')!.result;
    reset();

    cache.subImageRGBA('page', 2, 3, 2, 1, new Uint8Array(8));
    expect(calls.find((c) => c.name === 'bindTexture')!.args).toEqual([gl.TEXTURE_2D, texture]);
    const patch = calls.find((c) => c.name === 'texSubImage2D')!;
    expect(patch.args.slice(0, 8)).toEqual([gl.TEXTURE_2D, 0, 2, 3, 2, 1, gl.RGBA, gl.UNSIGNED_BYTE]);
    expect(calls.filter((c) => c.name === 'generateMipmap')).toHaveLength(1);
    expect(calls.filter((c) => c.name === 'createTexture')).toHaveLength(0);
  });
});
