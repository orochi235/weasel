import { describe, it, expect } from 'vitest';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { SPRITE_STRIDE } from './DrawCommand';

/** What a closed `ImageBitmap` reads as: no pixels at all. */
const closed = { width: 0, height: 0, close: () => {} } as unknown as ImageBitmap;

describe('WeaselRenderer.render — a bitmap the image cache has closed', () => {
  it('draws nothing for an image or sprites command still holding it, rather than uploading it', () => {
    const recorder = makeGLRecorder();
    const r = new WeaselRenderer({ gl: recorder.gl, width: 100, height: 100, dpr: 1 });
    recorder.reset();
    r.render([
      { kind: 'image', image: closed, x: 0, y: 0, w: 10, h: 10 },
      { kind: 'sprites', image: closed, sprites: new Float32Array(SPRITE_STRIDE).fill(1) },
    ]);
    const names = recorder.calls.map((c) => c.name);
    expect(names).not.toContain('texImage2D');
    expect(names).not.toContain('drawElements');
  });
});
