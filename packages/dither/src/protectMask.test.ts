import { describe, expect, it } from 'vitest';
import { protectMask } from './protectMask';

const rows = (m: Uint8Array, w: number) =>
  Array.from({ length: m.length / w }, (_, y) => Array.from(m.slice(y * w, y * w + w)).join(''));

describe('protectMask', () => {
  it('marks every pixel a rect covers', () => {
    expect(rows(protectMask([{ x: 1, y: 1, width: 2, height: 1 }], 4, 3), 4)).toEqual(['0000', '0110', '0000']);
  });

  it('rounds a fractional rect outward', () => {
    expect(rows(protectMask([{ x: 0.5, y: 0, width: 1, height: 1 }], 4, 1), 4)).toEqual(['1100']);
  });

  it('clips to the image', () => {
    expect(rows(protectMask([{ x: -2, y: -2, width: 3, height: 3 }], 2, 2), 2)).toEqual(['10', '00']);
  });

  it('is all zero for no rects', () => {
    expect(protectMask([], 3, 1)).toEqual(new Uint8Array(3));
  });
});
