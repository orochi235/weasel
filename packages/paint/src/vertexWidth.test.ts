import { describe, expect, it } from 'vitest';
import { scaleVertexWidth, vertexHalfWidths, vertexWidthFromSides, widestHalfWidth } from './vertexWidth';

describe('vertexHalfWidths', () => {
  it('splits a number evenly either side of the path', () => {
    expect(vertexHalfWidths(10, 4)).toEqual({ left: 5, right: 5 });
  });

  it('reads a pair as the distance to each edge', () => {
    expect(vertexHalfWidths({ left: 1, right: 7 }, 4)).toEqual({ left: 1, right: 7 });
  });

  it('takes half the fallback for a missing, non-finite, or negative entry, side by side', () => {
    expect(vertexHalfWidths(undefined, 4)).toEqual({ left: 2, right: 2 });
    expect(vertexHalfWidths(NaN, 4)).toEqual({ left: 2, right: 2 });
    expect(vertexHalfWidths(-3, 4)).toEqual({ left: 2, right: 2 });
    expect(vertexHalfWidths({ left: NaN, right: 6 }, 4)).toEqual({ left: 2, right: 6 });
  });

  it('keeps a zero as a zero', () => {
    expect(vertexHalfWidths(0, 4)).toEqual({ left: 0, right: 0 });
    expect(vertexHalfWidths({ left: 0, right: 3 }, 4)).toEqual({ left: 0, right: 3 });
  });
});

describe('vertexWidthFromSides', () => {
  it('writes equal sides as a number and unequal ones as a pair', () => {
    expect(vertexWidthFromSides(3, 3)).toBe(6);
    expect(vertexWidthFromSides(2, 5)).toEqual({ left: 2, right: 5 });
  });
});

describe('scaleVertexWidth', () => {
  it('scales a number and each side of a pair', () => {
    expect(scaleVertexWidth(3, 2)).toBe(6);
    expect(scaleVertexWidth({ left: 1, right: 4 }, 2)).toEqual({ left: 2, right: 8 });
  });
});

describe('widestHalfWidth', () => {
  it('is the farthest any edge sits from the path', () => {
    expect(widestHalfWidth(4, undefined)).toBe(2);
    expect(widestHalfWidth(4, [6, { left: 1, right: 9 }])).toBe(9);
    expect(widestHalfWidth(30, [6, { left: 1, right: 9 }])).toBe(15);
  });
});
