import { describe, it, expect, beforeEach } from 'vitest';
import { makeGLRecorder } from './testing/glRecorder';
import { WeaselRenderer } from './WeaselRenderer';
import { FLOATS_PER_VERTEX } from './drawBatch';

describe('WeaselRenderer.render — kind: image, source rect and flip', () => {
  let recorder: ReturnType<typeof makeGLRecorder>;
  let r: WeaselRenderer;

  beforeEach(() => {
    recorder = makeGLRecorder();
    r = new WeaselRenderer({ gl: recorder.gl, width: 800, height: 600, dpr: 1 });
    recorder.reset();
  });

  const bitmap = (width: number, height: number) =>
    ({ width, height, close: () => {} }) as unknown as ImageBitmap;

  /** One staged image quad: four `drawBatch.ts` vertices, wound top-left,
   *  top-right, bottom-right, bottom-left. The batch stages into an array
   *  sized past the run and uploads a prefix of it, so this reads the first
   *  upload's first quad — one quad per render throughout. */
  const UV = 6;

  function imageQuad(): Float32Array {
    const call = recorder.calls.find(
      (c) => c.name === 'bufferSubData'
        && c.args[2] instanceof Float32Array
        && (c.args[2] as Float32Array).length >= FLOATS_PER_VERTEX * 4,
    );
    if (!call) throw new Error('no image quad upload recorded');
    return Float32Array.from(
      (call.args[2] as Float32Array).subarray(0, FLOATS_PER_VERTEX * 4),
    );
  }

  /** [u0, v0, u1, v1] — the UVs of the top-left and bottom-right corners. */
  function uvs(): [number, number, number, number] {
    const v = imageQuad();
    return [v[UV], v[UV + 1], v[2 * FLOATS_PER_VERTEX + UV], v[2 * FLOATS_PER_VERTEX + UV + 1]];
  }

  it('samples the whole bitmap when no source rect is given', () => {
    r.render([{ kind: 'image', image: bitmap(64, 32), x: 0, y: 0, w: 64, h: 32 }]);
    expect(uvs()).toEqual([0, 0, 1, 1]);
  });

  it('normalizes a source rect by the bitmap dimensions', () => {
    r.render([{
      kind: 'image', image: bitmap(64, 32), x: 0, y: 0, w: 16, h: 16,
      source: { x: 16, y: 8, w: 16, h: 16 },
    }]);
    expect(uvs()).toEqual([16 / 64, 8 / 32, 32 / 64, 24 / 32]);
  });

  it('swaps the horizontal UVs for flipX', () => {
    r.render([{
      kind: 'image', image: bitmap(64, 32), x: 0, y: 0, w: 64, h: 32, flipX: true,
    }]);
    expect(uvs()).toEqual([1, 0, 0, 1]);
  });

  it('swaps the vertical UVs for flipY', () => {
    r.render([{
      kind: 'image', image: bitmap(64, 32), x: 0, y: 0, w: 64, h: 32, flipY: true,
    }]);
    expect(uvs()).toEqual([0, 1, 1, 0]);
  });

  it('swaps both axes for flipX + flipY', () => {
    r.render([{
      kind: 'image', image: bitmap(64, 32), x: 0, y: 0, w: 64, h: 32,
      flipX: true, flipY: true,
    }]);
    expect(uvs()).toEqual([1, 1, 0, 0]);
  });

  it('mirrors within the source rect, not the whole bitmap', () => {
    r.render([{
      kind: 'image', image: bitmap(64, 32), x: 0, y: 0, w: 16, h: 16,
      source: { x: 16, y: 8, w: 16, h: 16 }, flipX: true,
    }]);
    expect(uvs()).toEqual([32 / 64, 8 / 32, 16 / 64, 24 / 32]);
  });

  it('leaves the destination quad alone when flipping', () => {
    r.render([{ kind: 'image', image: bitmap(64, 32), x: 10, y: 20, w: 64, h: 32 }]);
    const plain = imageQuad();
    recorder.reset();
    r.render([{
      kind: 'image', image: bitmap(64, 32), x: 10, y: 20, w: 64, h: 32,
      flipX: true, flipY: true,
    }]);
    const flipped = imageQuad();
    // Positions are the first two floats of each interleaved vertex.
    for (let v = 0; v < 4; v++) {
      const at = v * FLOATS_PER_VERTEX;
      expect([flipped[at], flipped[at + 1]]).toEqual([plain[at], plain[at + 1]]);
    }
  });

  it('passes a source rect past the bitmap edge through unclamped', () => {
    r.render([{
      kind: 'image', image: bitmap(64, 32), x: 0, y: 0, w: 16, h: 16,
      source: { x: 56, y: 24, w: 16, h: 16 },
    }]);
    expect(uvs()).toEqual([56 / 64, 24 / 32, 72 / 64, 40 / 32]);
  });
});
