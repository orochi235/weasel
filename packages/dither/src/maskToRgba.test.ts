import { describe, expect, it } from 'vitest';
import { maskToRgba } from './maskToRgba';

describe('maskToRgba', () => {
  it('paints ink black and leaves blank transparent by default', () => {
    expect(Array.from(maskToRgba(new Uint8Array([1, 0]), 2, 1))).toEqual([0, 0, 0, 255, 0, 0, 0, 0]);
  });

  it('paints the colors given', () => {
    const out = maskToRgba(new Uint8Array([1, 0]), 2, 1, { ink: [200, 0, 0, 255], blank: [255, 255, 255, 255] });
    expect(Array.from(out)).toEqual([200, 0, 0, 255, 255, 255, 255, 255]);
  });

  it('refuses a mask of the wrong size', () => {
    expect(() => maskToRgba(new Uint8Array(3), 2, 2)).toThrow(RangeError);
  });
});
