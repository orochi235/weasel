/**
 * The dither effect against the CPU ditherer, pixel for pixel, in real WebGL2.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { WeaselRenderer, type DrawCommand } from '@weasel-js/renderer';
import { ditherPixels } from '../ditherPixels';
import { protectMask } from '../protectMask';
import { dither } from './dither';
import { protectTexture, type ProtectTexture } from './protectTexture';

// Large enough that the group's 64 px effects buffer is not pulled back to the
// canvas corner, so the shader must place the grid from `u_windowOrigin`.
const SIZE = 128;
const ORIGIN = 8;
const DOTS = 12;
// Each at least 4 from every Bayer cutoff ((m + 0.5) * 16) and from 128, so
// float rounding on the GPU cannot flip a dot.
const GRAYS = [60, 100, 140, 210];

const hex = (g: number) => `#${g.toString(16).padStart(2, '0').repeat(3)}`;
const grayOfDot = (x: number) => GRAYS[Math.floor(x / 3)]!;

/** Bands three dots wide, in device pixels at `k` pixels per dot. */
function bands(k: number): DrawCommand[] {
  return GRAYS.map((g, b) => ({
    kind: 'path',
    path: { kind: 'rect', x: ORIGIN + b * 3 * k, y: ORIGIN, width: 3 * k, height: DOTS * k },
    fill: { paint: { color: hex(g) } },
  }));
}

/** The same bands at one pixel per dot, as the CPU path sees an export. */
function dotImage() {
  const data = new Uint8ClampedArray(DOTS * DOTS * 4);
  for (let y = 0; y < DOTS; y++) {
    for (let x = 0; x < DOTS; x++) {
      const i = (y * DOTS + x) * 4;
      data.fill(grayOfDot(x), i, i + 3);
      data[i + 3] = 255;
    }
  }
  return { width: DOTS, height: DOTS, data };
}

let renderer: WeaselRenderer | undefined;
let held: ProtectTexture | undefined;
afterEach(() => {
  renderer?.dispose();
  renderer = undefined;
  held?.dispose();
  held = undefined;
});

/** Each dot's ink as the GPU drew it, read from the dot's top-left pixel. */
function render(commands: DrawCommand[], k: number): number[] {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const gl = canvas.getContext('webgl2', { stencil: true })!;
  renderer = new WeaselRenderer({ gl, width: SIZE, height: SIZE, dpr: 1 });
  renderer.render(commands);
  const px = new Uint8Array(SIZE * SIZE * 4);
  gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const ink: number[] = [];
  for (let y = 0; y < DOTS; y++) {
    for (let x = 0; x < DOTS; x++) {
      // Every pixel of a dot must agree; check them all, report the dot.
      const values = new Set<number>();
      for (let dy = 0; dy < k; dy++) {
        for (let dx = 0; dx < k; dx++) {
          const row = SIZE - 1 - (ORIGIN + y * k + dy);
          values.add(px[(row * SIZE + ORIGIN + x * k + dx) * 4]! < 128 ? 1 : 0);
        }
      }
      expect(values.size, `dot (${x}, ${y}) at ${k} px per dot`).toBe(1);
      ink.push([...values][0]!);
    }
  }
  return ink;
}

const options = (k: number) => ({
  ink: [0, 0, 0, 255] as const,
  blank: [255, 255, 255, 255] as const,
  grid: { pitch: [k, k] as const, origin: [ORIGIN, ORIGIN] as const },
});

describe('dither effect against ditherPixels', () => {
  for (const method of ['threshold', 'bayer'] as const) {
    for (const k of [1, 2, 3, 4]) {
      it(`${method}, ${k} device px per dot`, () => {
        const gpu = render([{ kind: 'group', effects: dither({ method, ...options(k) }), children: bands(k) }], k);
        expect(gpu).toEqual(Array.from(ditherPixels(dotImage(), { method })));
      });
    }
  }

  it('bayer with the right half protected', async () => {
    const mask = protectMask([{ x: 6, y: 0, width: 6, height: DOTS }], DOTS, DOTS);
    held = await protectTexture(mask, DOTS, DOTS);
    const k = 2;
    const effects = dither({ method: 'bayer', ...options(k), protect: held });
    const gpu = render([{ kind: 'group', effects, children: bands(k) }], k);
    expect(gpu).toEqual(Array.from(ditherPixels(dotImage(), { method: 'bayer', protect: mask })));
  });
});
