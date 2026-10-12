/**
 * A translucent image's alpha, read back channel by channel from a real
 * context. Every source of an image texture has to land the same pixels, and
 * what shares a draw with the image has to keep its own: neither shows in a
 * screenshot of a scene whose images are opaque.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { registerTexture, unregisterTexture, type TextureHandle } from './textures/registerTexture';

const W = 48;
const H = 16;
/** Half-transparent orange: unequal channels, so a swapped or twice-multiplied one reads as itself. */
const ORANGE = [255, 128, 0, 128] as const;
/** `ORANGE` as the framebuffer holds it, premultiplied. */
const ORANGE_DRAWN = [128, 64, 0, 128];
/** A 2D canvas keeps premultiplied bytes, so a source that went through one is a unit off. */
const SLACK = 3;

function pixels(side: number, [r, g, b, a]: readonly number[]): ImageData {
  const data = new ImageData(side, side);
  for (let p = 0; p < data.data.length; p += 4) data.data.set([r, g, b, a], p);
  return data;
}

function canvasOf(color: readonly number[]): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 8;
  canvas.getContext('2d')!.putImageData(pixels(8, color), 0, 0);
  return canvas;
}

const pngOf = (color: readonly number[]) =>
  new Promise<Blob>((done) => canvasOf(color).toBlob((blob) => done(blob!), 'image/png'));

async function imgOf(color: readonly number[]): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = URL.createObjectURL(await pngOf(color));
  await img.decode();
  return img;
}

const BITMAPS: Record<string, (color: readonly number[]) => Promise<ImageBitmap>> = {
  'ImageData': (color) => createImageBitmap(pixels(8, color)),
  'a PNG blob': async (color) => createImageBitmap(await pngOf(color)),
  'a canvas': (color) => createImageBitmap(canvasOf(color)),
  'an <img>': async (color) => createImageBitmap(await imgOf(color)),
};

let renderer: WeaselRenderer | undefined;
const registered: TextureHandle[] = [];

afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
  for (const handle of registered.splice(0)) unregisterTexture(handle);
});

/** Render `commands` onto a cleared canvas; the reader answers the raw
 *  (premultiplied) framebuffer bytes of one pixel, top-left origin. */
function paint(commands: DrawCommand[]): (x: number, y: number) => number[] {
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer = new WeaselRenderer({ gl, width: W, height: H, dpr: 1 });
  renderer.render(commands);
  const px = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return (x, y) => {
    const i = ((H - 1 - y) * W + x) * 4;
    return Array.from(px.slice(i, i + 4));
  };
}

function expectNear(got: number[], want: readonly number[]): void {
  got.forEach((channel, i) => {
    expect(Math.abs(channel - want[i]), `channel ${i} of [${got}], wanted [${want}]`).toBeLessThanOrEqual(SLACK);
  });
}

const image = (bitmap: ImageBitmap, x = 0, opacity?: number): DrawCommand =>
  ({ kind: 'image', image: bitmap, x, y: 0, w: 16, h: 16, ...(opacity === undefined ? {} : { opacity }) });

const filled = (x: number, fill: unknown): DrawCommand =>
  ({ kind: 'path', path: { kind: 'rect', x, y: 0, width: 16, height: 16 }, fill } as DrawCommand);

describe('a translucent image, in a real context', () => {
  for (const [source, make] of Object.entries(BITMAPS)) {
    it(`multiplies a bitmap made from ${source} by its alpha once`, async () => {
      const at = paint([image(await make(ORANGE))]);
      expectNear(at(8, 8), ORANGE_DRAWN);
      expect(at(24, 8)).toEqual([0, 0, 0, 0]);
    });
  }

  it('fades with its opacity', async () => {
    const at = paint([image(await BITMAPS.ImageData(ORANGE), 0, 0.5)]);
    expectNear(at(8, 8), [64, 32, 0, 64]);
  });

  it('leaves an opaque image as it is', async () => {
    const at = paint([image(await BITMAPS.ImageData([255, 128, 0, 255]))]);
    expect(at(8, 8)).toEqual([255, 128, 0, 255]);
  });

  it('shares a draw with a solid and a translucent gradient, each keeping its own pixels', async () => {
    const at = paint([
      filled(0, { kind: 'solid', color: '#0000ff' }),
      filled(16, {
        kind: 'linear-gradient', units: 'local', from: { x: 16, y: 0 }, to: { x: 32, y: 0 },
        stops: [{ offset: 0, color: 'rgba(0, 255, 0, 0.5)' }, { offset: 1, color: 'rgba(0, 255, 0, 0.5)' }],
      }),
      image(await BITMAPS.ImageData(ORANGE), 32),
    ]);
    expect(at(8, 8)).toEqual([0, 0, 255, 255]);
    expectNear(at(24, 8), [0, 128, 0, 128]);
    expectNear(at(40, 8), ORANGE_DRAWN);
  });

  it('leaves a gradient baked after an image upload straight', async () => {
    // The ramp atlas is a typed-array upload, which the premultiply flag would reach if it leaked.
    const at = paint([
      image(await BITMAPS.ImageData(ORANGE)),
      filled(16, {
        kind: 'linear-gradient', units: 'local', from: { x: 16, y: 0 }, to: { x: 32, y: 0 },
        stops: [{ offset: 0, color: 'rgba(0, 255, 0, 0.5)' }, { offset: 1, color: 'rgba(0, 255, 0, 0.5)' }],
      }),
    ]);
    expectNear(at(8, 8), ORANGE_DRAWN);
    expectNear(at(24, 8), [0, 128, 0, 128]);
  });

  it('hands a color matrix the straight color, not the premultiplied one', async () => {
    // Red and green trade places. On premultiplied input the result would be
    // multiplied by alpha a second time and read [32, 64, 0, 128].
    const swap = [0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0];
    const at = paint([{ kind: 'group', colorMatrix: swap, children: [image(await BITMAPS.ImageData(ORANGE))] }]);
    expectNear(at(8, 8), [64, 128, 0, 128]);
  });
});

describe('a translucent pattern tile, in a real context', () => {
  const pattern = (handle: TextureHandle) => {
    registered.push(handle);
    return filled(0, { kind: 'pattern', pattern: handle, units: 'local' });
  };

  it('paints the same from a bitmap as from an <img>', async () => {
    const fromBitmap = paint([pattern(registerTexture(await BITMAPS.ImageData(ORANGE)))])(8, 8);
    renderer?.dispose();
    const fromImg = paint([pattern(registerTexture(await imgOf(ORANGE)))])(8, 8);
    expectNear(fromBitmap, ORANGE_DRAWN);
    expectNear(fromImg, ORANGE_DRAWN);
  });
});
