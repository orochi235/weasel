/**
 * The dither effect against the CPU ditherer, pixel for pixel, in real WebGL2.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { WeaselRenderer, type DrawCommand } from '@weasel-js/renderer';
import { dither, ditherPixels, protectMask, protectTexture, type GpuDitherOptions, type ProtectTexture } from '@weasel-js/dither';
import type { DitherOptions } from '../types';

// Large enough that the group's 64 px effects buffer is not pulled back to the
// canvas corner, so the shader must place the grid from `u_windowOrigin`.
const SIZE = 128;
const ORIGIN = 8;
const DOTS = 12;
// Each at least 4 from every Bayer cutoff ((m + 0.5) * 16) and from 128, so
// float rounding on the GPU cannot flip a dot.
const GRAYS = [60, 100, 140, 210];

const hex = (g: number) => `#${g.toString(16).padStart(2, '0').repeat(3)}`;

/** Bands three dots wide, in device pixels at `k` pixels per dot, starting
 *  `offset` device pixels right of and below the grid's origin. */
function bands(k: number, offset = 0): DrawCommand[] {
  return GRAYS.map((g, b) => ({
    kind: 'path',
    path: { kind: 'rect', x: ORIGIN + offset + b * 3 * k, y: ORIGIN + offset, width: 3 * k, height: DOTS * k },
    fill: { paint: { color: hex(g) } },
  }));
}

/** The same content as the CPU path sees an export at one pixel per dot:
 *  each dot the mean of its k×k device pixels, over a transparent background. */
function dotImage(k = 1, offset = 0) {
  const data = new Uint8ClampedArray(DOTS * DOTS * 4);
  for (let y = 0; y < DOTS; y++) {
    for (let x = 0; x < DOTS; x++) {
      let covered = 0;
      let sum = 0;
      for (let dy = 0; dy < k; dy++) {
        for (let dx = 0; dx < k; dx++) {
          const cx = x * k + dx - offset;
          const cy = y * k + dy - offset;
          if (cx < 0 || cy < 0 || cx >= DOTS * k || cy >= DOTS * k) continue;
          covered++;
          sum += GRAYS[Math.floor(cx / (3 * k))]!;
        }
      }
      const i = (y * DOTS + x) * 4;
      data.fill(covered ? sum / covered : 0, i, i + 3);
      data[i + 3] = (255 * covered) / (k * k);
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

/** The ink of each `k`×`k` cell of device pixels from the grid's origin, as
 *  the GPU drew it. Every pixel of a cell must agree. */
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

const options = (pitch: number) => ({
  ink: [0, 0, 0, 255] as const,
  blank: [255, 255, 255, 255] as const,
  grid: { pitch: [pitch, pitch] as const, origin: [ORIGIN, ORIGIN] as const },
});

const group = (effects: GpuDitherOptions, children: DrawCommand[]): DrawCommand[] =>
  [{ kind: 'group', effects: dither(effects), children }];

const cpu = (image: ReturnType<typeof dotImage>, opts: DitherOptions) => Array.from(ditherPixels(image, opts));

describe('dither effect against ditherPixels', () => {
  for (const method of ['threshold', 'bayer'] as const) {
    // 6 takes 4×4 taps that fall between pixels; a flat dot still averages exactly.
    for (const k of [1, 2, 3, 4, 6]) {
      it(`${method}, ${k} device px per dot`, () => {
        expect(render(group({ method, ...options(k) }, bands(k)), k)).toEqual(cpu(dotImage(), { method }));
      });
    }
  }

  // The content starts 2 px into the first dots, and the effects buffer 1 px
  // before the content, so those dots' first taps lie outside the buffer and
  // must count as transparent. At 175 every one of the edge dots turns on it.
  for (const [method, threshold] of [['threshold', 175], ['bayer', 128]] as const) {
    it(`${method}, content off the dot boundaries`, () => {
      const k = 3;
      const gpu = render(group({ method, threshold, ...options(k) }, bands(k, 2)), k);
      expect(gpu).toEqual(cpu(dotImage(k, 2), { method, threshold }));
    });
  }

  it('threshold, dots finer than a device pixel', () => {
    // Each device pixel quantizes alone, as the CPU does at one dot per pixel.
    expect(render(group({ method: 'threshold', ...options(0.5) }, bands(1)), 1))
      .toEqual(cpu(dotImage(), { method: 'threshold' }));
  });

  it('bayer with the top right protected', async () => {
    // Not symmetric in y, so a protect texture read upside down fails.
    const mask = protectMask([{ x: 6, y: 0, width: 6, height: 5 }], DOTS, DOTS);
    held = await protectTexture(mask, DOTS, DOTS);
    const k = 2;
    const gpu = render(group({ method: 'bayer', ...options(k), protect: held }, bands(k)), k);
    expect(gpu).toEqual(cpu(dotImage(), { method: 'bayer', protect: mask }));
  });
});
