/**
 * Fifteen bitmaps in one draw, each on a texture slot of its own. The batch
 * shader reaches a slot through a tree of compares over constant sampler
 * indices, and only a real compile says the tree is legal GLSL and that each
 * leaf samples the unit its slot names. The recorder sees slot numbers on the
 * vertices and never a texel.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { BATCH_TEXTURE_SLOTS } from './shaders/batchFill';

/** One bitmap per slot past the white texel. */
const COUNT = BATCH_TEXTURE_SLOTS - 1;
const CELL = 4;
const W = COUNT * CELL;
const H = CELL;

let renderer: WeaselRenderer | undefined;
afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
});

/** A color no other index shares in any channel. */
const colorOf = (i: number): number[] => [16 * (i + 1), 255 - 16 * (i + 1), 8 * (i + 1)];

describe('a run sampling every texture slot, in a real context', () => {
  it('paints each bitmap from its own slot, in one draw', async () => {
    const bitmaps = await Promise.all(Array.from({ length: COUNT }, (_, i) =>
      createImageBitmap(new ImageData(new Uint8ClampedArray([...colorOf(i), 255]), 1, 1))));
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const gl = canvas.getContext('webgl2', { stencil: true })!;
    renderer = new WeaselRenderer({ gl, width: W, height: H, dpr: 1 });
    let draws = 0;
    const drawElements = gl.drawElements.bind(gl);
    gl.drawElements = (...args: Parameters<typeof drawElements>): void => {
      draws++;
      drawElements(...args);
    };
    // A solid behind them, so slot 0 is sampled in the same draw.
    const commands: DrawCommand[] = [
      { kind: 'path', path: { kind: 'rect', x: 0, y: 0, width: W, height: H }, fill: { paint: { color: '#000000' } } },
      ...bitmaps.map((image, i): DrawCommand => ({
        kind: 'image', image, x: i * CELL + 1, y: 0, w: CELL - 1, h: H, sampling: 'nearest',
      })),
    ];
    renderer.render(commands);
    expect(draws).toBe(1);
    const px = new Uint8Array(W * H * 4);
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    const at = (x: number): number[] => Array.from(px.slice((2 * W + x) * 4, (2 * W + x) * 4 + 3));
    for (let i = 0; i < COUNT; i++) {
      // The cell's first column is the solid, the rest its bitmap.
      expect(at(i * CELL), `ground left of bitmap ${i}`).toEqual([0, 0, 0]);
      expect(at(i * CELL + 2), `bitmap ${i}`).toEqual(colorOf(i));
    }
  });
});
