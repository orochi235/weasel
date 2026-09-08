import { describe, it, expect } from 'vitest';
import {
  pathContainsPoint,
  pathContainsRect,
  pathIntersectsRect,
  pathContainsPolygon,
  pathIntersectsPolygon,
} from './pathHitTest';
import { rectPath, polygonFromPoints } from './builder';
import { pathFromD } from './pathFromD';
import type { PolygonPath } from './types';

const rect = rectPath(0, 0, 10, 10);
const tri = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }]);

describe('pathContainsPoint', () => {
  it('rect path: inside', () => {
    expect(pathContainsPoint(rect, 5, 5)).toBe(true);
  });
  it('rect path: outside', () => {
    expect(pathContainsPoint(rect, 15, 5)).toBe(false);
  });
  it('rect path: on edge counts as inside', () => {
    expect(pathContainsPoint(rect, 0, 0)).toBe(true);
    expect(pathContainsPoint(rect, 10, 10)).toBe(true);
  });
  it('polygon path: inside triangle', () => {
    expect(pathContainsPoint(tri, 5, 3)).toBe(true);
  });
  it('polygon path: outside triangle', () => {
    expect(pathContainsPoint(tri, 8, 8)).toBe(false);
  });
});

describe('pathContainsRect', () => {
  it('rect path fully contains rect', () => {
    expect(pathContainsRect(rect, { x: 2, y: 2, width: 4, height: 4 })).toBe(true);
  });
  it('rect path partially overlaps rect', () => {
    expect(pathContainsRect(rect, { x: 8, y: 2, width: 4, height: 4 })).toBe(false);
  });
  it('rect path completely misses rect', () => {
    expect(pathContainsRect(rect, { x: 100, y: 100, width: 4, height: 4 })).toBe(false);
  });
  it('polygon path fully contains rect', () => {
    expect(pathContainsRect(tri, { x: 4, y: 1, width: 2, height: 2 })).toBe(true);
  });
});

describe('pathIntersectsRect', () => {
  it('rect path: rect overlapping → true', () => {
    expect(pathIntersectsRect(rect, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
  });
  it('rect path: rect outside → false', () => {
    expect(pathIntersectsRect(rect, { x: 100, y: 100, width: 5, height: 5 })).toBe(false);
  });
  it('polygon path: rect overlapping → true', () => {
    expect(pathIntersectsRect(tri, { x: 4, y: 5, width: 4, height: 4 })).toBe(true);
  });
});

describe('pathContainsPolygon', () => {
  it('rect path contains triangle', () => {
    const poly = [{ x: 1, y: 1 }, { x: 5, y: 1 }, { x: 3, y: 5 }];
    expect(pathContainsPolygon(rect, poly)).toBe(true);
  });
  it('rect path does not contain triangle that extends outside', () => {
    const poly = [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 10, y: 15 }];
    expect(pathContainsPolygon(rect, poly)).toBe(false);
  });
  it('polygon path contains an inner polygon', () => {
    const big = polygonFromPoints([
      { x: 0, y: 0 }, { x: 20, y: 0 }, { x: 10, y: 20 },
    ]);
    const small = [{ x: 8, y: 4 }, { x: 12, y: 4 }, { x: 10, y: 8 }];
    expect(pathContainsPolygon(big, small)).toBe(true);
  });
  it('polygon path does not contain a polygon that extends outside', () => {
    const triPath = polygonFromPoints([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 },
    ]);
    const spill = [{ x: 5, y: 1 }, { x: 100, y: 1 }, { x: 50, y: 50 }];
    expect(pathContainsPolygon(triPath, spill)).toBe(false);
  });
  it('pathContainsPolygon returns false for empty polygon argument', () => {
    expect(pathContainsPolygon(rect, [])).toBe(false);
    const triPath = polygonFromPoints([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }]);
    expect(pathContainsPolygon(triPath, [])).toBe(false);
  });
});

describe('pathIntersectsPolygon', () => {
  it('rect path intersects polygon that crosses its edge', () => {
    const poly = [{ x: 5, y: 5 }, { x: 15, y: 5 }, { x: 10, y: 15 }];
    expect(pathIntersectsPolygon(rect, poly)).toBe(true);
  });
  it('rect path does not intersect polygon entirely outside', () => {
    const poly = [{ x: 50, y: 50 }, { x: 60, y: 50 }, { x: 55, y: 60 }];
    expect(pathIntersectsPolygon(rect, poly)).toBe(false);
  });
  it('polygon path intersects polygon that crosses its edge', () => {
    const triPath = polygonFromPoints([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 },
    ]);
    const crossing = [{ x: -5, y: 5 }, { x: 15, y: 5 }, { x: 5, y: -5 }];
    expect(pathIntersectsPolygon(triPath, crossing)).toBe(true);
  });
  it('polygon path does not intersect polygon entirely outside', () => {
    const triPath = polygonFromPoints([
      { x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 },
    ]);
    const far = [{ x: 100, y: 100 }, { x: 110, y: 100 }, { x: 105, y: 110 }];
    expect(pathIntersectsPolygon(triPath, far)).toBe(false);
  });
  it('pathIntersectsPolygon returns false for empty polygon argument', () => {
    expect(pathIntersectsPolygon(rect, [])).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Curves and multi-contour paths
// ---------------------------------------------------------------------------

const curved = pathFromD('M0 0 C 0 10 10 10 10 0 Z');

/** Outer square 0..10 with a square hole 3..7, both wound the same way. */
const donutD = 'M0 0 H10 V10 H0 Z M3 3 H7 V7 H3 Z';
const donutEvenOdd: PolygonPath = { ...pathFromD(donutD), fillRule: 'evenodd' };
const donutNonzero: PolygonPath = { ...pathFromD(donutD), fillRule: 'nonzero' };

describe('curved subpaths', () => {
  it('pathIntersectsRect does not throw on a bezier command', () => {
    expect(pathIntersectsRect(curved, { x: 4, y: 1, width: 2, height: 2 })).toBe(true);
  });
  it('pathIntersectsRect answers false for a rect clear of the curve', () => {
    expect(pathIntersectsRect(curved, { x: 40, y: 40, width: 2, height: 2 })).toBe(false);
  });
  it('pathContainsRect does not throw on a bezier command', () => {
    expect(pathContainsRect(curved, { x: 4, y: 1, width: 2, height: 2 })).toBe(true);
  });
  it('pathContainsPolygon does not throw on a bezier command', () => {
    const poly = [{ x: 4, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 3 }, { x: 4, y: 3 }];
    expect(pathContainsPolygon(curved, poly)).toBe(true);
  });
  it('pathIntersectsPolygon does not throw on a bezier command', () => {
    const poly = [{ x: 4, y: 1 }, { x: 6, y: 1 }, { x: 6, y: 3 }, { x: 4, y: 3 }];
    expect(pathIntersectsPolygon(curved, poly)).toBe(true);
  });
});

describe('multi-contour paths', () => {
  const inHole = { x: 4, y: 4, width: 2, height: 2 };
  const spanningHole = { x: 1, y: 1, width: 8, height: 8 };

  it('a rect inside an even-odd hole is not contained', () => {
    expect(pathContainsRect(donutEvenOdd, inHole)).toBe(false);
  });
  it('a rect inside an even-odd hole does not intersect', () => {
    expect(pathIntersectsRect(donutEvenOdd, inHole)).toBe(false);
  });
  it('a rect enclosing the hole is not contained', () => {
    expect(pathContainsRect(donutEvenOdd, spanningHole)).toBe(false);
  });
  it('the same hole is filled under nonzero, so the rect is contained', () => {
    expect(pathContainsRect(donutNonzero, inHole)).toBe(true);
  });
  it('pathContainsRect and pathContainsPoint agree on the fill rule', () => {
    const center = { x: 5, y: 5 };
    expect(pathContainsRect(donutEvenOdd, inHole))
      .toBe(pathContainsPoint(donutEvenOdd, center.x, center.y));
    expect(pathContainsRect(donutNonzero, inHole))
      .toBe(pathContainsPoint(donutNonzero, center.x, center.y));
  });
  it('a polygon inside an even-odd hole is not contained', () => {
    const poly = [{ x: 4, y: 4 }, { x: 6, y: 4 }, { x: 6, y: 6 }, { x: 4, y: 6 }];
    expect(pathContainsPolygon(donutEvenOdd, poly)).toBe(false);
    expect(pathIntersectsPolygon(donutEvenOdd, poly)).toBe(false);
  });
});
