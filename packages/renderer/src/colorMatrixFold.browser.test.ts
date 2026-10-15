/**
 * A solid under a group color matrix is mapped on the CPU, and so is an image
 * or a gradient under one that only scales channels down; any other texel is
 * mapped by the shader, by the matrix its vertices name among the several a
 * run draws under. Against real WebGL2, every route has to paint the same
 * pixel, and nothing mapped on the CPU may also be mapped by a uniform.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { WeaselRenderer } from './WeaselRenderer';
import type { DrawCommand } from './DrawCommand';
import { colorFolding } from './draw';

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

/** `drawElements` calls the last `paint` made. */
let draws = 0;

function paint(commands: DrawCommand[]): (x: number, y: number) => number[] {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer = new WeaselRenderer({ gl, width: SIZE, height: SIZE, dpr: 1 });
  draws = 0;
  const drawElements = gl.drawElements.bind(gl);
  gl.drawElements = (...args: Parameters<typeof drawElements>): void => {
    draws++;
    drawElements(...args);
  };
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
  fill: { paint: { color: `rgb(${ORANGE.join(',')})` } },
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

  it('paints an image under a matrix that only scales channels down as the shader would', async () => {
    const image = await createImageBitmap(new ImageData(new Uint8ClampedArray([200, 100, 50, 128]), 1, 1));
    const scaled = [
      0.5, 0, 0, 0, 0,
      0, 0.25, 0, 0, 0,
      0, 0, 1, 0, 0,
      0, 0, 0, 0.5, 0,
    ];
    const commands: DrawCommand[] = [{
      kind: 'group', colorMatrix: scaled, alpha: 0.5,
      children: [{ kind: 'image', image, x: 0, y: 0, w: SIZE, h: SIZE }],
    }];
    const tinted = paint(commands)(4, 4);
    renderer!.dispose();
    colorFolding.enabled = false;
    let byShader: number[];
    try {
      byShader = paint(commands)(4, 4);
    } finally {
      colorFolding.enabled = true;
    }
    expectNear(tinted, byShader);
    // Alpha 128/255 by the matrix's half and the group's half; color premultiplied by it.
    const a = (128 / 255) * 0.25;
    expectNear(tinted, [200 * 0.5 * a, 100 * 0.25 * a, 50 * a, 255 * a]);
  });

  it('paints images under two matrices and under none in one draw, each by its own', async () => {
    const image = await orangeBitmap();
    const img = (x: number): DrawCommand => ({ kind: 'image', image, x, y: 0, w: 2, h: SIZE });
    // Lifts blue by a half and leaves the rest: a second matrix no tint expresses.
    const other = [
      1, 0, 0, 0, 0,
      0, 1, 0, 0, 0,
      0, 0, 1, 0, 0.5,
      0, 0, 0, 1, 0,
    ];
    const at = paint([
      img(0),
      { kind: 'group', colorMatrix: MATRIX, children: [img(2)] },
      { kind: 'group', colorMatrix: other, children: [img(4)] },
      img(6),
    ]);
    expect(draws).toBe(1);
    expectNear(at(0, 4), [...ORANGE, 255]);
    expectNear(at(2, 4), [...MAPPED, 255]);
    expectNear(at(4, 4), [ORANGE[0], ORANGE[1], Math.round(ORANGE[2] + 0.5 * 255), 255]);
    expectNear(at(6, 4), [...ORANGE, 255]);
  });

  it('carries group alpha on an image under a matrix as the uniform did', async () => {
    const image = await orangeBitmap();
    const commands: DrawCommand[] = [{
      kind: 'group', colorMatrix: MATRIX, alpha: 0.5,
      children: [{ kind: 'image', image, x: 0, y: 0, w: SIZE, h: SIZE, opacity: 0.5 }],
    }];
    const at = paint(commands);
    // Premultiplied by a quarter: the group's half and the image's.
    expectNear(at(4, 4), [...MAPPED.map((c) => c / 4), 64]);
  });

  describe('a gradient under a matrix', () => {
    /** One color end to end, so any pixel of it reads as that color mapped. */
    const flat = (x: number, opacity?: number): DrawCommand => ({
      kind: 'path',
      path: { kind: 'rect', x, y: 0, width: 4, height: SIZE },
      fill: { paint: {
        kind: 'linear-gradient', from: { x: 0, y: 0 }, to: { x: SIZE, y: 0 }, opacity,
        stops: [
          { offset: 0, color: `rgb(${ORANGE.join(',')})` },
          { offset: 1, color: `rgb(${ORANGE.join(',')})` },
        ],
      } },
    });

    it('is mapped by the shader in the run with its neighbors, and faded once', () => {
      const at = paint([
        solid(0),
        { kind: 'group', colorMatrix: MATRIX, alpha: 0.5, children: [flat(4, 0.5)] },
      ]);
      expect(draws).toBe(1);
      expectNear(at(1, 4), [...ORANGE, 255]);
      expectNear(at(5, 4), [...MAPPED.map((c) => c / 4), 64]);
    });

    it('paints the pixel it does with a run of its own', () => {
      const commands: DrawCommand[] = [
        solid(0),
        { kind: 'group', colorMatrix: MATRIX, alpha: 0.5, children: [flat(4, 0.5)] },
      ];
      const shared = paint(commands)(5, 4);
      renderer!.dispose();
      colorFolding.enabled = false;
      let alone: number[];
      try {
        alone = paint(commands)(5, 4);
        expect(draws).toBe(2);
      } finally {
        colorFolding.enabled = true;
      }
      expectNear(shared, alone);
    });

    it('takes a matrix that only scales channels down as a tint, as the shader would', () => {
      const scaled = [
        0.5, 0, 0, 0, 0,
        0, 0.25, 0, 0, 0,
        0, 0, 1, 0, 0,
        0, 0, 0, 0.5, 0,
      ];
      const at = paint([{ kind: 'group', colorMatrix: scaled, alpha: 0.5, children: [flat(0)] }]);
      const a = 0.25;
      expectNear(at(1, 4), [ORANGE[0] * 0.5 * a, ORANGE[1] * 0.25 * a, ORANGE[2] * a, 255 * a]);
    });
  });

  it('fades a mapped solid by the group alpha once', () => {
    const at = paint([{ kind: 'group', colorMatrix: MATRIX, alpha: 0.5, children: [solid(0)] }]);
    // Premultiplied in the framebuffer: half of each mapped channel.
    expectNear(at(1, 4), [...MAPPED.map((c) => c / 2), 128]);
  });
});
