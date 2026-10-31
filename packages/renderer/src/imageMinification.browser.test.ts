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

/** A sheet of a red cell 30 texels wide and a blue one beside it, with no
 *  gutter: the case a mipmap would bleed across. 30 is off the grid of every
 *  mip level, so each level has a texel holding both colors. */
const CELL = 30;

async function twoCellSheet(): Promise<ImageBitmap> {
  const w = 64, h = 32;
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      data[i] = x < CELL ? 255 : 0;
      data[i + 2] = x < CELL ? 0 : 255;
      data[i + 3] = 255;
    }
  }
  return createImageBitmap(new ImageData(data, w, h));
}

describe('a sheet cell drawn at about an eighth of its size', () => {
  it.each(['auto', 'mipmap'] as const)("takes none of its neighbor's color under '%s'", async (mode) => {
    const canvas = document.createElement('canvas');
    canvas.width = 4;
    canvas.height = 4;
    const gl = canvas.getContext('webgl2', { stencil: true })!;
    renderer = new WeaselRenderer({ gl, width: 4, height: 4, dpr: 1, imageMinification: mode });
    const sheet = await twoCellSheet();
    // The whole sheet first, so its mipmaps exist before the cell is drawn.
    renderer.render([
      { kind: 'image', image: sheet, x: 0, y: 0, w: 2, h: 1 },
      { kind: 'image', image: sheet, x: 0, y: 0, w: 4, h: 4, source: { x: 0, y: 0, w: CELL, h: CELL } },
    ]);
    const px = new Uint8Array(4);
    gl.readPixels(3, 2, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    expect(px[0]).toBeGreaterThan(240);
    expect(px[2]).toBeLessThan(16);
  });
});
