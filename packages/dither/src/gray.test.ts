import { describe, expect, it } from 'vitest';
import { toGray } from './gray';

function px(...rgba: number[]) {
  return { width: rgba.length / 4, height: 1, data: new Uint8ClampedArray(rgba) };
}

describe('toGray', () => {
  it('weights channels by Rec. 601 luma', () => {
    const [r, g, b] = toGray(px(255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255));
    expect(r).toBeCloseTo(0.299 * 255);
    expect(g).toBeCloseTo(0.587 * 255);
    expect(b).toBeCloseTo(0.114 * 255);
  });

  it('composites transparency over white by default', () => {
    expect(toGray(px(0, 0, 0, 0))[0]).toBeCloseTo(255);
    expect(toGray(px(0, 0, 0, 128))[0]).toBeCloseTo(255 * (1 - 128 / 255));
  });

  it('composites over the background given', () => {
    expect(toGray(px(0, 0, 0, 0), [0, 0, 0])[0]).toBe(0);
  });
});
