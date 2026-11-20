import { describe, expect, it } from 'vitest';
import { difference } from './compareRaster';

const image = (bytes: number[]) => ({ width: bytes.length / 4, height: 1, data: Uint8ClampedArray.from(bytes) });

describe('difference', () => {
  it('measures two rasters of one size', () => {
    expect(difference(Uint8Array.of(1, 2, 3, 4, 0, 0, 0, 0), image([1, 2, 3, 9, 0, 0, 0, 0]))).toEqual({ pixels: 1, maxStep: 5 });
  });

  it('refuses rasters of different lengths rather than reading one as the same as the other', () => {
    expect(() => difference(new Uint8Array(0), image([1, 2, 3, 4]))).toThrow(/0 bytes.*4/);
    expect(() => difference(Uint8Array.of(1, 2, 3, 4, 5, 6, 7, 8), image([1, 2, 3, 4]))).toThrow(/8 bytes.*4/);
  });
});
