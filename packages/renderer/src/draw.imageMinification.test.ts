/**
 * `imageMinification: 'auto'`: mipmaps are built for the images a frame draws
 * small, and for no others. The recorder shows when `generateMipmap` runs;
 * `imageMinification.browser.test.ts` shows what it does to the pixels.
 */
import { describe, it, expect } from 'vitest';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { SPRITE_STRIDE, type DrawCommand } from './DrawCommand';

const bitmap = (side: number): ImageBitmap =>
  ({ width: side, height: side, close: () => {} }) as unknown as ImageBitmap;

function setup(dpr = 1) {
  const recorder = makeGLRecorder();
  const renderer = new WeaselRenderer({
    gl: recorder.gl, width: 200, height: 200, dpr, imageMinification: 'auto',
  });
  const mipmaps = (): number => recorder.calls.filter((c) => c.name === 'generateMipmap').length;
  return { recorder, renderer, mipmaps };
}

const image = (img: ImageBitmap, side: number): DrawCommand =>
  ({ kind: 'image', image: img, x: 0, y: 0, w: side, h: side });

describe("imageMinification: 'auto'", () => {
  it('builds no mipmaps for an image drawn at its own size or larger', () => {
    const { renderer, mipmaps } = setup();
    renderer.render([image(bitmap(64), 64), image(bitmap(64), 128)]);
    expect(mipmaps()).toBe(0);
  });

  it('builds them once for an image drawn at half size or smaller', () => {
    const { recorder, renderer, mipmaps } = setup();
    const img = bitmap(64);
    renderer.render([image(img, 32)]);
    expect(mipmaps()).toBe(1);
    const gl = recorder.gl;
    expect(recorder.calls.some((c) => c.name === 'texParameteri'
      && c.args[1] === gl.TEXTURE_MIN_FILTER && c.args[2] === gl.LINEAR_MIPMAP_LINEAR)).toBe(true);
    renderer.render([image(img, 32)]);
    expect(mipmaps()).toBe(1);
  });

  it('counts device pixels, so a 2x display halves how small an image is drawn', () => {
    const { renderer, mipmaps } = setup(2);
    renderer.render([image(bitmap(64), 32)]);
    expect(mipmaps()).toBe(0);
  });

  it('counts the group transform', () => {
    const { renderer, mipmaps } = setup();
    renderer.render([{
      kind: 'group',
      transform: new Float32Array([0.25, 0, 0, 0, 0.25, 0, 0, 0, 1]),
      children: [image(bitmap(64), 64)],
    }]);
    expect(mipmaps()).toBe(1);
  });

  it('builds none for a source rect drawn small, which would blend in the cells around it', () => {
    const { renderer, mipmaps } = setup();
    const cmd: DrawCommand = {
      kind: 'image', image: bitmap(64), x: 0, y: 0, w: 4, h: 4, source: { x: 0, y: 0, w: 16, h: 16 },
    };
    renderer.render([cmd]);
    expect(mipmaps()).toBe(0);
  });

  it('treats a source rect covering the whole bitmap as the whole bitmap', () => {
    const { renderer, mipmaps } = setup();
    renderer.render([{
      kind: 'image', image: bitmap(64), x: 0, y: 0, w: 8, h: 8, source: { x: 0, y: 0, w: 64, h: 64 },
    }]);
    expect(mipmaps()).toBe(1);
  });

  it('builds none for a sprite run, however small its sprites', () => {
    const { renderer, mipmaps } = setup();
    const sprites = new Float32Array(SPRITE_STRIDE);
    sprites.set([20, 0, 4, 4, 0, 0, 16, 16, 1], 0);
    renderer.render([{ kind: 'sprites', image: bitmap(64), sprites }]);
    expect(mipmaps()).toBe(0);
  });

  it('samples a mipmapped bitmap through one tap where a later draw shows only part of it', () => {
    const { recorder, renderer } = setup();
    const img = bitmap(64);
    renderer.render([image(img, 8)]);
    renderer.render([{ kind: 'image', image: img, x: 0, y: 0, w: 4, h: 4, source: { x: 0, y: 0, w: 16, h: 16 } }]);
    const gl = recorder.gl;
    const mins = recorder.calls
      .filter((c) => c.name === 'texParameteri' && c.args[1] === gl.TEXTURE_MIN_FILTER)
      .map((c) => c.args[2]);
    expect(mins.at(-1)).toBe(gl.LINEAR);
    expect(mins).toContain(gl.LINEAR_MIPMAP_LINEAR);
  });

  it('is the default', () => {
    const recorder = makeGLRecorder();
    const renderer = new WeaselRenderer({ gl: recorder.gl, width: 200, height: 200, dpr: 1 });
    renderer.render([image(bitmap(64), 8)]);
    expect(recorder.calls.map((c) => c.name)).toContain('generateMipmap');
  });
});

describe("imageMinification: 'linear'", () => {
  it('builds none', () => {
    const recorder = makeGLRecorder();
    const renderer = new WeaselRenderer({ gl: recorder.gl, width: 200, height: 200, dpr: 1, imageMinification: 'linear' });
    renderer.render([image(bitmap(64), 8)]);
    expect(recorder.calls.map((c) => c.name)).not.toContain('generateMipmap');
  });
});

describe('setImageMinification', () => {
  it("switches a 'linear' renderer to 'auto' from the next draw", () => {
    const recorder = makeGLRecorder();
    const renderer = new WeaselRenderer({ gl: recorder.gl, width: 200, height: 200, dpr: 1, imageMinification: 'linear' });
    const img = bitmap(64);
    renderer.render([image(img, 8)]);
    renderer.setImageMinification('auto');
    renderer.render([image(img, 8)]);
    expect(recorder.calls.filter((c) => c.name === 'generateMipmap')).toHaveLength(1);
  });

  it('frees the textures uploaded under the old strategy, and undefined restores the default', () => {
    const recorder = makeGLRecorder();
    const renderer = new WeaselRenderer({ gl: recorder.gl, width: 200, height: 200, dpr: 1, imageMinification: 'linear' });
    const mipmaps = (): number => recorder.calls.filter((c) => c.name === 'generateMipmap').length;
    const img = bitmap(64);
    renderer.render([image(img, 8)]);
    const deletes = (): number => recorder.calls.filter((c) => c.name === 'deleteTexture').length;
    const before = deletes();
    renderer.setImageMinification(undefined);
    expect(deletes()).toBe(before + 1);
    renderer.render([image(img, 8)]);
    expect(mipmaps()).toBe(1);
  });

  it('keeps its textures when handed the strategy it already has', () => {
    const { recorder, renderer } = setup();
    renderer.render([image(bitmap(64), 8)]);
    const before = recorder.calls.length;
    renderer.setImageMinification('auto');
    expect(recorder.calls.length).toBe(before);
  });
});
