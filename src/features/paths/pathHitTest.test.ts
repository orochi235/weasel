import { describe, it, expect } from 'vitest';
import {
  pathContainsPoint,
  pathContainsRect,
  pathIntersectsRect,
  pathContainsPolygon,
  pathIntersectsPolygon,
} from './pathHitTest';
import { rectPath, polygonFromPoints } from './builder';

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
});
