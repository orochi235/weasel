import { describe, expect, it } from 'vitest';
import type { GpuDevice } from './gpu/types';
import { readPixels, readPixelsSync } from './readPixels';

/** A 4×4 canvas whose read hands back the bytes a WebGL read would size. */
const gpu = {
  canvasSize: () => ({ width: 4, height: 4 }),
  readCanvasSync: (r: { width: number; height: number }) => new Uint8Array(Math.trunc(r.width) * Math.trunc(r.height) * 4),
  readCanvas: (r: { width: number; height: number }) => Promise.resolve(new Uint8Array(Math.trunc(r.width) * Math.trunc(r.height) * 4)),
} as unknown as GpuDevice;

describe('readPixels', () => {
  it('reads a rect of whole device pixels', () => {
    expect(readPixelsSync(gpu, { x: 1, y: 1, width: 2, height: 3 })).toHaveLength(24);
  });

  it('refuses a rect that is not whole device pixels, which would come back with its rows misplaced', async () => {
    for (const rect of [
      { x: 0, y: 0, width: 1.5, height: 2 },
      { x: 0.5, y: 0, width: 1, height: 1 },
      { x: 0, y: 0, width: NaN, height: 1 },
      { x: NaN, y: 0, width: 1, height: 1 },
    ]) {
      expect(() => readPixelsSync(gpu, rect)).toThrow(RangeError);
      expect(() => readPixels(gpu, rect)).toThrow(RangeError);
    }
  });
});
