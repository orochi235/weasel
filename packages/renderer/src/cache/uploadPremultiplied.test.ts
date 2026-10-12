/**
 * Which uploads ask the browser to premultiply. A proxy: the recorder has no
 * pixels, so this pins the calls and `imageAlpha.browser.test.ts` reads what
 * they paint.
 */
import { describe, expect, it } from 'vitest';
import { makeGLRecorder } from '../testing/glRecorder';
import { GLImageCache } from './GLImageCache';
import { GLTextureCache } from './GLTextureCache';

const source = { width: 4, height: 4, data: new Uint8ClampedArray(64) } as ImageData;

/** The premultiply flag's value at each `texImage2D`, replayed from `pixelStorei`. */
function flagAtUploads(recorder: ReturnType<typeof makeGLRecorder>): { atUpload: unknown[]; after: unknown } {
  const { gl, calls } = recorder;
  // A constant the recorder does not carry reads 0, the same as every other missing one.
  expect(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL).toBe(0x9241);
  const atUpload: unknown[] = [];
  let flag: unknown = false;
  for (const c of calls) {
    if (c.name === 'pixelStorei' && c.args[0] === gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL) flag = c.args[1];
    else if (c.name === 'texImage2D') atUpload.push(flag);
  }
  return { atUpload, after: flag };
}

describe('which uploads premultiply', () => {
  it('an image upload does, and puts the flag back', () => {
    const recorder = makeGLRecorder();
    new GLImageCache(recorder.gl).upload({}, source);
    expect(flagAtUploads(recorder)).toEqual({ atUpload: [true], after: false });
  });

  it('a registered texture does, on its first upload and on a replaced source', () => {
    const recorder = makeGLRecorder();
    const cache = new GLTextureCache(recorder.gl);
    cache.uploadRegistered('tex_1', source);
    cache.uploadRegistered('tex_1', { ...source });
    expect(flagAtUploads(recorder)).toEqual({ atUpload: [true, true], after: false });
  });

  it('a font atlas does not: its channels are a distance field', () => {
    const recorder = makeGLRecorder();
    new GLTextureCache(recorder.gl).upload('inter', source);
    expect(flagAtUploads(recorder)).toEqual({ atUpload: [false], after: false });
  });
});
