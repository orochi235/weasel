import { describe, it, expect } from 'vitest';
import { anyCrossing, type FlattenedContours } from './crossings';

const contours = (...rings: number[][]): FlattenedContours => {
  const flat: FlattenedContours = { coords: [], contourStarts: [], anchorA: [], anchorB: [], anchorT: [] };
  for (const ring of rings) {
    flat.contourStarts.push(flat.coords.length / 2);
    flat.coords.push(...ring);
    for (let i = 0; i < ring.length / 2; i++) {
      flat.anchorA.push(0);
      flat.anchorB.push(0);
      flat.anchorT.push(0);
    }
  }
  return flat;
};

describe('anyCrossing', () => {
  it('finds a figure eight crossing itself', () => {
    expect(anyCrossing(contours([0, 0, 10, 10, 10, 0, 0, 10]))).toBe(true);
  });

  it('finds two outlines crossing each other', () => {
    expect(anyCrossing(contours([0, 0, 10, 0, 10, 10, 0, 10], [5, 5, 15, 5, 15, 15, 5, 15]))).toBe(true);
  });

  it('finds no crossing in a square, or in a hole inside it', () => {
    expect(anyCrossing(contours([0, 0, 10, 0, 10, 10, 0, 10]))).toBe(false);
    expect(anyCrossing(contours([0, 0, 10, 0, 10, 10, 0, 10], [3, 3, 3, 7, 7, 7, 7, 3]))).toBe(false);
  });

  it('counts neither a shared vertex nor a shared edge as a crossing', () => {
    expect(anyCrossing(contours([0, 0, 10, 0, 10, 10, 0, 10], [10, 10, 20, 10, 20, 20, 10, 20]))).toBe(false);
    expect(anyCrossing(contours([0, 0, 10, 0, 10, 10, 0, 10], [10, 0, 20, 0, 20, 10, 10, 10]))).toBe(false);
  });

  it('skips a repeated vertex', () => {
    expect(anyCrossing(contours([0, 0, 10, 0, 10, 0, 10, 10, 0, 10]))).toBe(false);
  });
});
