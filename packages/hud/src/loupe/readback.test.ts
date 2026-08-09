import { describe, it, expect } from 'vitest';
import { readbackRegion } from './readback';

function fakeGl(calls: unknown[][]) {
  return {
    RGBA: 0x1908, UNSIGNED_BYTE: 0x1401,
    readPixels: (...args: unknown[]) => { calls.push(args); },
  } as unknown as WebGL2RenderingContext;
}

describe('readbackRegion', () => {
  it('centers the read on the pointer, in device pixels, y-flipped', () => {
    const calls: unknown[][] = [];
    readbackRegion(fakeGl(calls), { width: 800, height: 600 }, { x: 100, y: 50 }, 2, 40, 20);
    // device center = (200, 100); region 40x20 → gx = 180
    // top-down y = 90, so gy = 600 - 90 - 20 = 490
    expect(calls[0].slice(0, 4)).toEqual([180, 490, 40, 20]);
  });

  it('clamps the region to the drawing buffer', () => {
    const calls: unknown[][] = [];
    readbackRegion(fakeGl(calls), { width: 800, height: 600 }, { x: 0, y: 0 }, 1, 40, 20);
    expect(calls[0][0]).toBe(0);
    expect(calls[0][1]).toBe(580);
  });

  it('returns ImageData whose rows are flipped back to top-down', () => {
    const gl = {
      RGBA: 0x1908, UNSIGNED_BYTE: 0x1401,
      readPixels: (_x: number, _y: number, w: number, h: number, _f: number, _t: number, buf: Uint8Array) => {
        // GL row 0 (bottom) red; GL row h-1 (top) blue.
        for (let row = 0; row < h; row++) {
          for (let col = 0; col < w; col++) {
            const i = (row * w + col) * 4;
            buf[i] = row === 0 ? 255 : 0;
            buf[i + 2] = row === h - 1 ? 255 : 0;
            buf[i + 3] = 255;
          }
        }
      },
    } as unknown as WebGL2RenderingContext;
    const img = readbackRegion(gl, { width: 8, height: 8 }, { x: 4, y: 4 }, 1, 2, 2);
    // ImageData row 0 must be GL row h-1 → blue.
    expect(img.data[2]).toBe(255);
    expect(img.data[0]).toBe(0);
  });
});
