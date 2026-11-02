import { describe, it, expect } from 'vitest';
import {
  boundsOfCoords, unionBox, boxContainsPoint, boxContainsBox, boxesIntersect, rectToContour,
  rectsOverlap, rectsIntersect, rectContainsPoint, rectContainsPointHalfOpen, unionRects, type Box,
} from './box';

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

describe('rect (object form)', () => {
  const a = { x: 0, y: 0, width: 10, height: 10 };
  const right = { x: 10, y: 0, width: 5, height: 5 };   // shares a's right edge
  const corner = { x: 10, y: 10, width: 5, height: 5 }; // shares a's corner
  const inside = { x: 2, y: 2, width: 3, height: 3 };
  const apart = { x: 11, y: 0, width: 5, height: 5 };

  it('rectsOverlap counts shared interior only', () => {
    expect(rectsOverlap(a, inside)).toBe(true);
    expect(rectsOverlap(a, { x: 9, y: 9, width: 5, height: 5 })).toBe(true);
    expect(rectsOverlap(a, right)).toBe(false);
    expect(rectsOverlap(a, corner)).toBe(false);
    expect(rectsOverlap(a, apart)).toBe(false);
    expect(rectsOverlap(a, { x: 10, y: 5, width: 0, height: 0 })).toBe(false);
  });

  it('rectsIntersect counts touching edges and corners', () => {
    expect(rectsIntersect(a, inside)).toBe(true);
    expect(rectsIntersect(a, right)).toBe(true);
    expect(rectsIntersect(a, corner)).toBe(true);
    expect(rectsIntersect(a, apart)).toBe(false);
    expect(rectsIntersect(a, { x: 5, y: 5, width: 0, height: 0 })).toBe(true);
  });

  it('boxesIntersect is the tuple form of rectsIntersect', () => {
    expect(boxesIntersect([0, 0, 10, 10], [10, 10, 15, 15])).toBe(true);
    expect(boxesIntersect([0, 0, 10, 10], [11, 0, 16, 5])).toBe(false);
  });

  it('rectContainsPoint takes every edge', () => {
    expect(rectContainsPoint(a, 0, 0)).toBe(true);
    expect(rectContainsPoint(a, 10, 10)).toBe(true);
    expect(rectContainsPoint(a, 10.01, 5)).toBe(false);
    expect(rectContainsPoint(a, NaN, 5)).toBe(false);
  });

  it('rectContainsPointHalfOpen takes the left and top edges, not the right and bottom', () => {
    expect(rectContainsPointHalfOpen(a, 0, 0)).toBe(true);
    expect(rectContainsPointHalfOpen(a, 10, 5)).toBe(false);
    expect(rectContainsPointHalfOpen(a, 5, 10)).toBe(false);
    expect(rectContainsPointHalfOpen(right, 10, 0)).toBe(true);
  });

  it('unionRects spans every rect, and is null for none', () => {
    expect(unionRects([a, { x: -2, y: 3, width: 1, height: 20 }])).toEqual({ x: -2, y: 0, width: 12, height: 23 });
    expect(unionRects([inside])).toEqual(inside);
    expect(unionRects([])).toBeNull();
  });

  it('unionRects lets NaN through', () => {
    expect(unionRects([a, { x: NaN, y: 0, width: 1, height: 1 }])!.x).toBeNaN();
  });
});
