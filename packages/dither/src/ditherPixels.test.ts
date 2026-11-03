import { describe, expect, it } from 'vitest';
import { ditherPixels } from './ditherPixels';
import { grayImage } from './testing/grayImage';

const rows = (m: Uint8Array, w: number) =>
  Array.from({ length: m.length / w }, (_, y) => Array.from(m.slice(y * w, y * w + w)).join(''));

describe('ditherPixels: threshold', () => {
  it('inks gray below the threshold and nothing at or above it', () => {
    expect(Array.from(ditherPixels(grayImage(3, 1, (x) => [127, 128, 255][x]!)))).toEqual([1, 0, 0]);
  });

  it('takes the threshold given', () => {
    expect(Array.from(ditherPixels(grayImage(1, 1, () => 150), { threshold: 160 }))).toEqual([1]);
  });

  it('reads transparency against the background', () => {
    const clear = { width: 1, height: 1, data: new Uint8ClampedArray(4) };
    expect(Array.from(ditherPixels(clear))).toEqual([0]);
    expect(Array.from(ditherPixels(clear, { background: [0, 0, 0] }))).toEqual([1]);
  });

  it('refuses a protect mask of the wrong size', () => {
    expect(() => ditherPixels(grayImage(2, 2, () => 0), { protect: new Uint8Array(3) })).toThrow(RangeError);
  });
});

describe('ditherPixels: bayer', () => {
  it('inks a flat gray 100 where the matrix cutoff is above it', () => {
    // Cutoffs are (m + 0.5) * 16; above 100 means m >= 6.
    expect(rows(ditherPixels(grayImage(4, 4, () => 100), { method: 'bayer' }), 4))
      .toEqual(['0101', '1011', '0101', '1110']);
  });

  it('tiles every 4 pixels', () => {
    const m = rows(ditherPixels(grayImage(8, 8, () => 100), { method: 'bayer' }), 8);
    expect(m[0]).toBe('01010101');
    expect(m[4]).toBe(m[0]);
  });

  it('quantizes protected pixels at the plain threshold, the same on every row', () => {
    const image = grayImage(8, 4, (x) => x * 32);
    const protect = new Uint8Array(8 * 4).fill(1);
    const m = rows(ditherPixels(image, { method: 'bayer', protect }), 8);
    expect(m).toEqual(['11110000', '11110000', '11110000', '11110000']);
  });
});
