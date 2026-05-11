import { describe, it, expect } from 'vitest';
import { pathUnion } from './booleans';
import { pointInPath } from './hitTest';
import type { RectPath } from './types';

const r = (x: number, y: number, w: number, h: number): RectPath => ({
  kind: 'rect', x, y, width: w, height: h,
});

describe('pathUnion', () => {
  it('combines two overlapping rects into a single shape covering both', () => {
    const a = r(0, 0, 10, 10);
    const b = r(5, 5, 10, 10);
    const u = pathUnion(a, b);
    expect(pointInPath(u, 2, 2)).toBe(true);
    expect(pointInPath(u, 12, 12)).toBe(true);
    expect(pointInPath(u, 7, 7)).toBe(true);
    expect(pointInPath(u, 20, 20)).toBe(false);
  });

  it('disjoint inputs union to a multi-contour PolygonPath', () => {
    const a = r(0, 0, 5, 5);
    const b = r(10, 10, 5, 5);
    const u = pathUnion(a, b);
    expect(pointInPath(u, 2, 2)).toBe(true);
    expect(pointInPath(u, 12, 12)).toBe(true);
    expect(pointInPath(u, 7, 7)).toBe(false);
  });
});

import { pathIntersect } from './booleans';

describe('pathIntersect', () => {
  it('returns only the overlapping region of two overlapping rects', () => {
    const a = r(0, 0, 10, 10);
    const b = r(5, 5, 10, 10);
    const i = pathIntersect(a, b);
    expect(pointInPath(i, 7, 7)).toBe(true);
    expect(pointInPath(i, 2, 2)).toBe(false);
    expect(pointInPath(i, 12, 12)).toBe(false);
  });

  it('returns an empty path when inputs are disjoint', () => {
    const a = r(0, 0, 5, 5);
    const b = r(10, 10, 5, 5);
    const i = pathIntersect(a, b);
    expect(i.commands.length).toBe(0);
    expect(i.coords.length).toBe(0);
  });
});
