import { describe, expect, it } from 'vitest';
import { BAYER_4X4, bayerCutoff } from './shared';
import { ditherPixels } from './ditherPixels';
import { maskToRgba } from './maskToRgba';
import { protectMask } from './protectMask';
import { protectTexture } from './gpu/protectTexture';

describe('an image size that is not a whole number of pixels', () => {
  const sizes: [number, number][] = [[-1, -1], [-2, 2], [1.5, 2], [NaN, 1], [Infinity, 0]];

  it.each(sizes)('is refused everywhere a size is taken: %d×%d', async (w, h) => {
    const want = /a .*×.* image is not a whole number of pixels/;
    expect(() => ditherPixels({ width: w, height: h, data: new Uint8ClampedArray(Math.abs(w * h * 4) || 0) }))
      .toThrow(want);
    expect(() => maskToRgba(new Uint8Array(0), w, h)).toThrow(want);
    expect(() => protectMask([], w, h)).toThrow(want);
    await expect(protectTexture(new Uint8Array(0), w, h)).rejects.toThrow(want);
  });

  it('takes zero', () => {
    expect(ditherPixels({ width: 0, height: 3, data: new Uint8ClampedArray(0) })).toHaveLength(0);
    expect(protectMask([], 0, 0)).toHaveLength(0);
  });
});

describe('bayerCutoff', () => {
  it('reads the matrix at (m + 0.5) * 16 for the default threshold', () => {
    expect(bayerCutoff(0, 0, 128)).toBe(8);
    expect(bayerCutoff(1, 0, 128)).toBe((8 + 0.5) * 16);
    expect(bayerCutoff(0, 1, 128)).toBe((12 + 0.5) * 16);
  });

  it('shifts every cell by the threshold offset', () => {
    expect(bayerCutoff(0, 0, 138)).toBe(18);
  });

  it('wraps every 4 dots, negative indexes included', () => {
    expect(bayerCutoff(5, 6, 128)).toBe(bayerCutoff(1, 2, 128));
    expect(bayerCutoff(-1, -1, 128)).toBe(bayerCutoff(3, 3, 128));
  });

  it('holds each of 0–15 once', () => {
    expect([...BAYER_4X4].sort((a, b) => a - b)).toEqual([...Array(16).keys()]);
  });
});
