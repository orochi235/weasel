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

import { pathSubtract } from './booleans';

describe('pathSubtract', () => {
  it('returns `a` with `b` punched out where they overlap', () => {
    const a = r(0, 0, 10, 10);
    const b = r(5, 5, 10, 10);
    const s = pathSubtract(a, b);
    expect(pointInPath(s, 2, 2)).toBe(true);
    expect(pointInPath(s, 7, 7)).toBe(false);
    expect(pointInPath(s, 12, 12)).toBe(false);
  });

  it('inner-contained subtract produces an annulus (multi-contour)', () => {
    const outer = r(0, 0, 20, 20);
    const inner = r(5, 5, 10, 10);
    const ann = pathSubtract(outer, inner);
    expect(pointInPath(ann, 2, 2)).toBe(true);
    expect(pointInPath(ann, 10, 10)).toBe(false);
    expect(pointInPath(ann, 25, 25)).toBe(false);
  });

  it('full subtraction produces an empty path', () => {
    const a = r(2, 2, 5, 5);
    const b = r(0, 0, 10, 10);
    const s = pathSubtract(a, b);
    expect(s.commands.length).toBe(0);
  });
});

import { pathExclude } from './booleans';

describe('pathExclude', () => {
  it('returns symmetric difference (in one or the other, not both)', () => {
    const a = r(0, 0, 10, 10);
    const b = r(5, 5, 10, 10);
    const x = pathExclude(a, b);
    expect(pointInPath(x, 2, 2)).toBe(true);
    expect(pointInPath(x, 12, 12)).toBe(true);
    expect(pointInPath(x, 7, 7)).toBe(false);
  });
});

import { pathDivide } from './booleans';
import type { PolygonPath } from './types';

describe('pathDivide', () => {
  it('two overlapping rects → three non-empty regions (A-only, B-only, A∩B)', () => {
    const a = r(0, 0, 10, 10);
    const b = r(5, 5, 10, 10);
    const parts = pathDivide(a, b);
    expect(parts).toHaveLength(3);
    for (const p of parts) {
      expect(p.commands.length).toBeGreaterThan(0);
    }
    const inside = (path: PolygonPath, x: number, y: number) => pointInPath(path, x, y);
    const counts = [2, 7, 12].map((c) =>
      parts.filter((p) => inside(p, c, c)).length,
    );
    for (const k of counts) expect(k).toBe(1);
  });

  it('two disjoint rects → two regions (just the inputs)', () => {
    const a = r(0, 0, 5, 5);
    const b = r(10, 10, 5, 5);
    const parts = pathDivide(a, b);
    expect(parts).toHaveLength(2);
  });
});
