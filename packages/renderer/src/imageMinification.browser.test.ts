/**
 * What `imageMinification` does to an image drawn at an eighth of its size,
 * against real WebGL2. Each destination pixel covers eight texels, white at
 * both ends and black between: a bilinear tap at the middle reads black, and
 * a mipmap reads their average.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { WeaselRenderer } from './WeaselRenderer';
import type { ImageMinification } from './cache/GLImageCache';

const SOURCE = 64;
const DRAWN = 8;

let renderer: WeaselRenderer | undefined;
afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
});

async function edgedBitmap(): Promise<ImageBitmap> {
  const data = new Uint8ClampedArray(SOURCE * SOURCE * 4);
  for (let y = 0; y < SOURCE; y++) {
    for (let x = 0; x < SOURCE; x++) {
      const edge = x % 8 === 0 || x % 8 === 7 || y % 8 === 0 || y % 8 === 7;
      const i = (y * SOURCE + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = edge ? 255 : 0;
      data[i + 3] = 255;
    }
  }
  return createImageBitmap(new ImageData(data, SOURCE, SOURCE));
}

async function redAtCenter(imageMinification: ImageMinification): Promise<number> {
  const canvas = document.createElement('canvas');
  canvas.width = DRAWN;
  canvas.height = DRAWN;
  const gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer = new WeaselRenderer({ gl, width: DRAWN, height: DRAWN, dpr: 1, imageMinification });
  renderer.render([{ kind: 'image', image: await edgedBitmap(), x: 0, y: 0, w: DRAWN, h: DRAWN }]);
  const px = new Uint8Array(4);
  gl.readPixels(4, 4, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return px[0];
}

describe('an image drawn at an eighth of its size', () => {
  it("reads one tap under 'linear', missing the white edges", async () => {
    expect(await redAtCenter('linear')).toBeLessThan(16);
  });

  it("reads the average under 'auto'", async () => {
    // 28 of each 64 texels are white.
    const red = await redAtCenter('auto');
    expect(red).toBeGreaterThan(90);
    expect(red).toBeLessThan(135);
  });

  it("reads the same average under 'mipmap'", async () => {
    const red = await redAtCenter('mipmap');
    expect(red).toBeGreaterThan(90);
    expect(red).toBeLessThan(135);
  });
});
