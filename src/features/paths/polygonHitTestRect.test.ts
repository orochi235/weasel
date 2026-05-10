import { describe, expect, it } from 'vitest';
import {
  polygonContainsRectCenter,
  polygonContainsRect,
  polygonIntersectsRect,
} from './polygonHitTestRect';

const SQUARE = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

describe('polygonContainsRectCenter', () => {
  it('returns true when rect center is inside polygon', () => {
    expect(polygonContainsRectCenter(SQUARE, { x: 4, y: 4, width: 2, height: 2 })).toBe(true);
  });
  it('returns false when rect center is outside polygon', () => {
    expect(polygonContainsRectCenter(SQUARE, { x: 20, y: 20, width: 2, height: 2 })).toBe(false);
  });
  it('returns false on degenerate polygon (< 3 vertices)', () => {
    expect(polygonContainsRectCenter([{ x: 0, y: 0 }, { x: 1, y: 1 }], { x: 0, y: 0, width: 1, height: 1 })).toBe(false);
  });
});

describe('polygonContainsRect', () => {
  it('returns true when all four rect corners are inside polygon', () => {
    expect(polygonContainsRect(SQUARE, { x: 2, y: 2, width: 4, height: 4 })).toBe(true);
  });
  it('returns false when any corner is outside polygon', () => {
    expect(polygonContainsRect(SQUARE, { x: 8, y: 8, width: 4, height: 4 })).toBe(false);
  });
  it('returns false on a non-convex polygon when rect spans the concavity', () => {
    // L-shape: outer corners at (0,0)(10,0)(10,4)(4,4)(4,10)(0,10).
    const L = [
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 },
      { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 },
    ];
    // A rect centered at (6, 6) is outside the L's filled region.
    expect(polygonContainsRect(L, { x: 5, y: 5, width: 2, height: 2 })).toBe(false);
  });
});

describe('polygonIntersectsRect', () => {
  it('returns true when rect is fully inside polygon', () => {
    expect(polygonIntersectsRect(SQUARE, { x: 2, y: 2, width: 4, height: 4 })).toBe(true);
  });
  it('returns true when polygon is fully inside rect', () => {
    expect(polygonIntersectsRect(SQUARE, { x: -5, y: -5, width: 30, height: 30 })).toBe(true);
  });
  it('returns true when an edge crosses', () => {
    // Rect straddles the right edge of the square.
    expect(polygonIntersectsRect(SQUARE, { x: 8, y: 4, width: 6, height: 2 })).toBe(true);
  });
  it('returns false when fully outside and disjoint', () => {
    expect(polygonIntersectsRect(SQUARE, { x: 20, y: 20, width: 4, height: 4 })).toBe(false);
  });
  it('returns false on degenerate polygon (< 3 vertices)', () => {
    expect(polygonIntersectsRect([{ x: 0, y: 0 }, { x: 1, y: 1 }], { x: 0, y: 0, width: 1, height: 1 })).toBe(false);
  });
});
