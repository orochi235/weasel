import { describe, expect, it } from 'vitest';
import { polygonContainsPath, polygonIntersectsPath } from './pathHitTest';
import { PATH_L, PATH_M, PATH_Z } from './commands';
import type { Path } from './path';

const SQUARE = [
  { x: 0, y: 0 },
  { x: 10, y: 0 },
  { x: 10, y: 10 },
  { x: 0, y: 10 },
];

const rect = (x: number, y: number, width: number, height: number): Path =>
  ({ kind: 'rect', x, y, width, height });

describe('polygonContainsPath — rect paths', () => {
  it('takes a rect whose four corners are inside', () => {
    expect(polygonContainsPath(SQUARE, rect(2, 2, 4, 4))).toBe(true);
  });
  it('refuses a rect with a corner outside', () => {
    expect(polygonContainsPath(SQUARE, rect(8, 8, 4, 4))).toBe(false);
  });
  it('refuses a rect spanning the concavity of a non-convex polygon', () => {
    // L-shape: outer corners at (0,0)(10,0)(10,4)(4,4)(4,10)(0,10). A rect
    // centered at (6, 6) sits outside the L's filled region.
    const L = [
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 },
      { x: 4, y: 4 }, { x: 4, y: 10 }, { x: 0, y: 10 },
    ];
    expect(polygonContainsPath(L, rect(5, 5, 2, 2))).toBe(false);
  });
  it('refuses a degenerate polygon (< 3 vertices)', () => {
    expect(polygonContainsPath([{ x: 0, y: 0 }, { x: 1, y: 1 }], rect(0, 0, 1, 1))).toBe(false);
  });
});

describe('polygonIntersectsPath — rect paths', () => {
  it('meets a rect fully inside the polygon', () => {
    expect(polygonIntersectsPath(SQUARE, rect(2, 2, 4, 4))).toBe(true);
  });
  it('meets a rect that swallows the polygon', () => {
    expect(polygonIntersectsPath(SQUARE, rect(-5, -5, 30, 30))).toBe(true);
  });
  it('meets a rect straddling an edge', () => {
    expect(polygonIntersectsPath(SQUARE, rect(8, 4, 6, 2))).toBe(true);
  });
  it('misses a disjoint rect', () => {
    expect(polygonIntersectsPath(SQUARE, rect(20, 20, 4, 4))).toBe(false);
  });
  it('misses on a degenerate polygon (< 3 vertices)', () => {
    expect(polygonIntersectsPath([{ x: 0, y: 0 }, { x: 1, y: 1 }], rect(0, 0, 1, 1))).toBe(false);
  });
});

describe('polygonIntersectsPath — a path nothing fills', () => {
  const INNER = [{ x: 4, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 6 }, { x: 4, y: 6 }];
  const ACROSS = [{ x: 8, y: 4 }, { x: 14, y: 4 }, { x: 14, y: 6 }, { x: 8, y: 6 }];
  const AROUND = [{ x: -5, y: -5 }, { x: 25, y: -5 }, { x: 25, y: 25 }, { x: -5, y: 25 }];
  const square: Path = {
    kind: 'polygon',
    commands: Uint8Array.of(PATH_M, PATH_L, PATH_L, PATH_L, PATH_Z),
    coords: Float32Array.of(0, 0, 10, 0, 10, 10, 0, 10),
    fillRule: 'nonzero',
  };

  for (const [name, path] of [['rect', rect(0, 0, 10, 10)], ['polygon', square]] as const) {
    it(`${name}: a polygon wholly inside meets a filled one only`, () => {
      expect(polygonIntersectsPath(INNER, path)).toBe(true);
      expect(polygonIntersectsPath(INNER, path, { filled: false })).toBe(false);
    });
    it(`${name}: a polygon across the outline or around it still meets it`, () => {
      expect(polygonIntersectsPath(ACROSS, path, { filled: false })).toBe(true);
      expect(polygonIntersectsPath(AROUND, path, { filled: false })).toBe(true);
    });
  }
});
