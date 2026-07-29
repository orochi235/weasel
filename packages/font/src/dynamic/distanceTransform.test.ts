import { describe, it, expect } from 'vitest';
import { alphaToSdf } from './distanceTransform';

/** w×h alpha bitmap with the rect [x0,x1)×[y0,y1) filled solid. */
function filledRect(
  w: number, h: number, x0: number, y0: number, x1: number, y1: number,
): Uint8ClampedArray {
  const a = new Uint8ClampedArray(w * h);
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) a[y * w + x] = 255;
  }
  return a;
}

describe('alphaToSdf', () => {
  it('returns all zeros for empty input', () => {
    const sdf = alphaToSdf(new Uint8ClampedArray(16 * 16), 16, 16, 8, 0.5);
    expect(sdf.length).toBe(16 * 16);
    expect(sdf.every((v) => v === 0)).toBe(true);
  });

  it('saturates deep inside and zeroes far outside a filled square', () => {
    const sdf = alphaToSdf(filledRect(32, 32, 8, 8, 24, 24), 32, 32, 8, 0.5);
    // Center of the 16×16 square is ~8px from the nearest edge:
    // value = 255 - 255*(-8/8 + 0.5) = 382 → clamps to 255.
    expect(sdf[16 * 32 + 16]).toBeGreaterThan(240);
    // Corner (1,1) is ~9.9px outside → negative → clamps to 0.
    expect(sdf[1 * 32 + 1]).toBe(0);
  });

  it('encodes the edge at ~0.5 (byte 128)', () => {
    const sdf = alphaToSdf(filledRect(32, 32, 8, 8, 24, 24), 32, 32, 8, 0.5);
    // Row through the middle: first filled column x=8 (inner dist 1 →
    // d=-1 → 159), last empty column x=7 (outer dist 1 → d=+1 → 96).
    expect(sdf[16 * 32 + 8]).toBeGreaterThan(128);
    expect(sdf[16 * 32 + 7]).toBeLessThan(128);
  });

  it('is monotonically non-decreasing approaching the shape', () => {
    const sdf = alphaToSdf(filledRect(32, 32, 8, 8, 24, 24), 32, 32, 8, 0.5);
    for (let x = 1; x <= 16; x++) {
      expect(sdf[16 * 32 + x]).toBeGreaterThanOrEqual(sdf[16 * 32 + x - 1]);
    }
  });

  it('is symmetric for a symmetric shape', () => {
    const sdf = alphaToSdf(filledRect(32, 32, 8, 8, 24, 24), 32, 32, 8, 0.5);
    // Square spans columns [8,24): column 7 mirrors column 24 across the
    // center line x=15.5.
    expect(sdf[16 * 32 + 7]).toBe(sdf[16 * 32 + 24]);
    expect(sdf[16 * 32 + 10]).toBe(sdf[16 * 32 + 21]);
  });
});
