import { describe, expect, it } from 'vitest';
import { diffPixels } from './difference';

/** A `w`×`h` image of one opaque color. */
function solid(w: number, h: number, rgb: readonly [number, number, number]): ImageData {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i += 1) data.set([...rgb, 255], i * 4);
  return new ImageData(data, w, h);
}

const at = (image: ImageData, i: number) => [...image.data.slice(i * 4, i * 4 + 4)];
const alphaAt = (image: ImageData, i: number) => image.data[i * 4 + 3] as number;

describe('diffPixels', () => {
  const a = solid(2, 2, [10, 20, 30]);
  const b = solid(2, 2, [10, 20, 30]);
  b.data.set([10, 21, 30, 255], 3 * 4);
  const same = 0;
  const changed = 3;

  it('lights only differing pixels and dims the rest', () => {
    const r = diffPixels(a, b);
    expect(r.changed).toBe(1);
    expect(alphaAt(r.image, same)).toBeLessThan(255 * 0.3);
    expect(at(r.image, same).slice(0, 3)).toEqual([10, 20, 30]);
    expect(alphaAt(r.image, changed)).toBe(255);
  });

  it('lights a differing pixel in the color asked for', () => {
    const r = diffPixels(a, b, { lit: [0, 255, 0] });
    expect(at(r.image, changed)).toEqual([0, 255, 0, 255]);
  });

  it('counts a pixel within the tolerance as the same', () => {
    expect(diffPixels(a, b, { tolerance: 1 }).changed).toBe(0);
  });

  it('dims by the factor asked for', () => {
    expect(alphaAt(diffPixels(a, b, { dim: 0.5 }).image, same)).toBe(128);
  });

  it('throws on mismatched sizes', () => {
    const small = solid(1, 2, [10, 20, 30]);
    expect(() => diffPixels(a, small)).toThrow(/size/);
  });
});
