/**
 * A solid under a group color matrix is mapped on the CPU and an image is
 * mapped by the shader. Against real WebGL2, both routes have to paint the
 * same pixel, and the solid must not also be mapped by the uniform.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';

const SIZE = 8;
const ORANGE = [200, 100, 50];

/** Halves the color, lifts red by a quarter, and swaps green with blue. */
const MATRIX = [
  0.5, 0, 0, 0, 0.25,
  0, 0, 0.5, 0, 0,
  0, 0.5, 0, 0, 0,
  0, 0, 0, 1, 0,
];
const MAPPED = [
  Math.round(ORANGE[0] * 0.5 + 0.25 * 255), Math.round(ORANGE[2] * 0.5), Math.round(ORANGE[1] * 0.5),
];

let renderer: WeaselRenderer | undefined;
afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
});

function paint(commands: DrawCommand[]): (x: number, y: number) => number[] {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer = new WeaselRenderer({ gl, width: SIZE, height: SIZE, dpr: 1 });
  renderer.render(commands);
  const px = new Uint8Array(SIZE * SIZE * 4);
  gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, px);
  return (x, y) => {
    const i = ((SIZE - 1 - y) * SIZE + x) * 4;
    return Array.from(px.slice(i, i + 4));
  };
}

const solid = (x: number): DrawCommand => ({
  kind: 'path',
  path: { kind: 'rect', x, y: 0, width: 4, height: SIZE },
  fill: { color: `rgb(${ORANGE.join(',')})` },
});

async function orangeBitmap(): Promise<ImageBitmap> {
  return createImageBitmap(new ImageData(new Uint8ClampedArray([...ORANGE, 255]), 1, 1));
}

function expectNear(got: number[], want: number[]): void {
  for (let k = 0; k < want.length; k++) expect(Math.abs(got[k] - want[k])).toBeLessThanOrEqual(1);
}

describe('a group color matrix, in a real context', () => {
  it('paints a solid the color the matrix maps it to, in the run with its neighbors', () => {
    const at = paint([solid(0), { kind: 'group', colorMatrix: MATRIX, children: [solid(4)] }]);
    expectNear(at(1, 4), [...ORANGE, 255]);
    expectNear(at(5, 4), [...MAPPED, 255]);
  });

  it('paints a solid and an image of one color alike, whichever opens the run', async () => {
    const image = await orangeBitmap();
    const img = (x: number): DrawCommand => ({ kind: 'image', image, x, y: 0, w: 4, h: SIZE });
    const solidFirst = paint([{ kind: 'group', colorMatrix: MATRIX, children: [solid(0), img(4)] }]);
    expectNear(solidFirst(1, 4), [...MAPPED, 255]);
    expectNear(solidFirst(5, 4), [...MAPPED, 255]);
    renderer!.dispose();
    const imageFirst = paint([{ kind: 'group', colorMatrix: MATRIX, children: [img(0), solid(4)] }]);
    expectNear(imageFirst(1, 4), [...MAPPED, 255]);
    expectNear(imageFirst(5, 4), [...MAPPED, 255]);
  });

  it('fades a mapped solid by the group alpha once', () => {
    const at = paint([{ kind: 'group', colorMatrix: MATRIX, alpha: 0.5, children: [solid(0)] }]);
    // Premultiplied in the framebuffer: half of each mapped channel.
    expectNear(at(1, 4), [...MAPPED.map((c) => c / 2), 128]);
  });
});
