import { describe, it, expect } from 'vitest';
import { boundsOfCoords, unionBox, boxContainsPoint, boxContainsBox, rectToContour, type Box } from './box';

describe('box', () => {
  it('boundsOfCoords sweeps interleaved coords', () => {
    const b = boundsOfCoords([1, 2, 5, 1, 3, 9]);
    expect(b).toEqual([1, 1, 5, 9]);
  });
  it('boundsOfCoords of empty input is null', () => {
    expect(boundsOfCoords([])).toBeNull();
  });
  it('unionBox spans both', () => {
    const a: Box = [0, 0, 5, 5];
    const c: Box = [3, -2, 10, 4];
    expect(unionBox(a, c)).toEqual([0, -2, 10, 5]);
  });
  it('boxContainsPoint is inclusive of edges', () => {
    const b: Box = [0, 0, 10, 10];
    expect(boxContainsPoint(b, 0, 10)).toBe(true);
    expect(boxContainsPoint(b, 11, 5)).toBe(false);
  });
  it('boxContainsBox takes a box touching the edges and refuses one that overlaps', () => {
    const b: Box = [0, 0, 10, 10];
    expect(boxContainsBox(b, [0, 0, 10, 10])).toBe(true);
    expect(boxContainsBox(b, [2, 2, 4, 4])).toBe(true);
    expect(boxContainsBox(b, [5, 5, 11, 8])).toBe(false);
    expect(boxContainsBox([2, 2, 4, 4], b)).toBe(false);
  });
  it('rectToContour emits the four corners with the closing edge implicit', () => {
    expect(Array.from(rectToContour(0, 0, 2, 3))).toEqual([0, 0, 2, 0, 2, 3, 0, 3]);
  });
});
